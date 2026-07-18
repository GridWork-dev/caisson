// Exit-gate proof for `caisson run approve|deny|status` (ADR-0360 U-2/U-3). Runs the REAL
// `agent_run_state`/`trajectory_event` migrations (the SAME files @caisson/agent-trajectory ships —
// this package's SQL is a deliberate hand-kept mirror of theirs, see run.ts's file header) against
// PGlite, proving the service functions' CAS + idempotent-append + fail-closed contract WITHOUT
// importing the commercial package (the open↔commercial boundary this file exists to respect).
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test";
setDefaultTimeout(30_000);
import { randomUUID } from "node:crypto";
import { newTestPg, type TestPg } from "@caisson/testing";
import { ConfigError, ValidationError } from "@caisson/kernel";
import {
  approveRun,
  denyRun,
  readRunStatus,
  type RunServiceDeps,
} from "./run.ts";

let tp: TestPg;

function capturingJobs(): {
  jobs: RunServiceDeps["jobs"];
  enqueued: Array<{ name: string; payload: unknown; singletonKey?: string }>;
} {
  const enqueued: Array<{
    name: string;
    payload: unknown;
    singletonKey?: string;
  }> = [];
  return {
    enqueued,
    jobs: {
      async enqueue(name, payload, options) {
        enqueued.push({
          name,
          payload,
          ...(options?.singletonKey !== undefined
            ? { singletonKey: options.singletonKey }
            : {}),
        });
      },
    },
  };
}

async function park(
  accountId: string,
  runId: string,
  toolCallId: string,
  resumeSeq = 0,
): Promise<void> {
  await tp.exec(
    `INSERT INTO agent_run_state (run_id, account_id, status, pending_tool_call_id, decision, claimed, resume_seq, parked_state, updated_at)
     VALUES ('${runId}', '${accountId}', 'parked', '${toolCallId}', NULL, false, ${String(resumeSeq)}, '{}'::jsonb, now())`,
  );
}

beforeAll(async () => {
  tp = await newTestPg();
  const m1 = await Bun.file(
    new URL(
      "../../agent-trajectory/src/migrations/0001_trajectory_event.sql",
      import.meta.url,
    ),
  ).text();
  const m2 = await Bun.file(
    new URL(
      "../../agent-trajectory/src/migrations/0002_agent_run_state.sql",
      import.meta.url,
    ),
  ).text();
  await tp.exec(m1);
  await tp.exec(m2);
});

afterAll(async () => {
  await tp.close();
});

function deps(accountId: string, jobs: RunServiceDeps["jobs"]): RunServiceDeps {
  return { tx: tp.pg, accountId, jobs };
}

describe("approveRun", () => {
  test("CAS parked -> running, appends tool.approved once, enqueues the resume job", async () => {
    const acct = randomUUID();
    const runId = randomUUID();
    await park(acct, runId, "call-1");
    const { jobs, enqueued } = capturingJobs();

    const outcome = await approveRun(
      deps(acct, jobs),
      runId,
      "call-1",
      "operator@example.com",
    );
    expect(outcome.status).toBe("running");
    expect(enqueued).toEqual([
      { name: "agent-run.resume", payload: { runId }, singletonKey: runId },
    ]);

    const rows = await tp.query<{ event: { kind: string; payload: unknown } }>(
      `SELECT event FROM trajectory_event WHERE run_id = $1 ORDER BY seq ASC`,
      [runId],
    );
    expect(rows.map((r) => r.event.kind)).toEqual(["tool.approved"]);
    expect(rows[0]?.event.payload).toMatchObject({
      toolCallId: "call-1",
      actor: "operator@example.com",
    });
  });

  test("double-approval is idempotent: never re-appends tool.approved", async () => {
    const acct = randomUUID();
    const runId = randomUUID();
    await park(acct, runId, "call-1");
    const { jobs } = capturingJobs();
    await approveRun(deps(acct, jobs), runId, "call-1", "op");
    await approveRun(deps(acct, jobs), runId, "call-1", "op");
    const rows = await tp.query(
      `SELECT * FROM trajectory_event WHERE run_id = $1`,
      [runId],
    );
    expect(rows).toHaveLength(1);
  });

  test("requires a non-empty --actor", async () => {
    const acct = randomUUID();
    const runId = randomUUID();
    await park(acct, runId, "call-1");
    const { jobs } = capturingJobs();
    await expect(
      approveRun(deps(acct, jobs), runId, "call-1", ""),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  test("unknown runId / mismatched toolCallId fail closed", async () => {
    const acct = randomUUID();
    const { jobs } = capturingJobs();
    await expect(
      approveRun(deps(acct, jobs), randomUUID(), "call-1", "op"),
    ).rejects.toBeInstanceOf(ConfigError);

    const runId = randomUUID();
    await park(acct, runId, "call-1");
    await expect(
      approveRun(deps(acct, jobs), runId, "call-wrong", "op"),
    ).rejects.toBeInstanceOf(ConfigError);
  });
});

describe("denyRun", () => {
  test("CAS parked -> finished, appends tool.denied + run.finished(failed), never enqueues", async () => {
    const acct = randomUUID();
    const runId = randomUUID();
    await park(acct, runId, "call-1");
    const { jobs, enqueued } = capturingJobs();

    const outcome = await denyRun(
      deps(acct, jobs),
      runId,
      "call-1",
      "op",
      "unsafe",
    );
    expect(outcome.status).toBe("finished");
    expect(enqueued).toHaveLength(0);

    const rows = await tp.query<{ event: { kind: string; payload: unknown } }>(
      `SELECT event FROM trajectory_event WHERE run_id = $1 ORDER BY seq ASC`,
      [runId],
    );
    expect(rows.map((r) => r.event.kind)).toEqual([
      "tool.denied",
      "run.finished",
    ]);
    expect(rows[0]?.event.payload).toMatchObject({
      toolCallId: "call-1",
      actor: "op",
      reason: "unsafe",
    });
    expect(rows[1]?.event.payload).toMatchObject({ status: "failed" });
  });

  test("idempotent on retry — never double-appends", async () => {
    const acct = randomUUID();
    const runId = randomUUID();
    await park(acct, runId, "call-1");
    const { jobs } = capturingJobs();
    await denyRun(deps(acct, jobs), runId, "call-1", "op");
    await denyRun(deps(acct, jobs), runId, "call-1", "op");
    const rows = await tp.query(
      `SELECT * FROM trajectory_event WHERE run_id = $1`,
      [runId],
    );
    expect(rows).toHaveLength(2);
  });
});

describe("readRunStatus", () => {
  test("returns the parked snapshot, undefined for a never-parked run", async () => {
    const acct = randomUUID();
    const runId = randomUUID();
    await park(acct, runId, "call-1", 3);
    const { jobs } = capturingJobs();
    const status = await readRunStatus(deps(acct, jobs), runId);
    expect(status).toMatchObject({
      status: "parked",
      pendingToolCallId: "call-1",
      resumeSeq: 3,
    });
    expect(await readRunStatus(deps(acct, jobs), randomUUID())).toBeUndefined();
  });

  test("tenant isolation: one account never reads another's run-state", async () => {
    const a = randomUUID();
    const b = randomUUID();
    const runId = randomUUID();
    await park(a, runId, "call-1");
    const { jobs } = capturingJobs();
    expect(await readRunStatus(deps(b, jobs), runId)).toBeUndefined();
    expect((await readRunStatus(deps(a, jobs), runId))?.status).toBe("parked");
  });
});
