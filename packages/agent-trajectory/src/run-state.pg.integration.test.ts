// Integration proof for the PG-backed `RunStateStore` (ADR-0360 U-3). Runs the REAL
// `0002_agent_run_state.sql` migration against PGlite. Proves the CAS contract over a real
// Postgres: park -> approve -> claimResume survives FRESH store objects (the store-layer analogue
// of a process restart — the ai-kit-level "real process boundary" proof lives in
// `packages/ai-kit/src/approval.test.ts`, which drives the SAME stores through the loop);
// double-approval idempotent; a second concurrent claimResume can never also execute; tenant
// isolation; and the migration's RLS matches `buildTenantPolicySql` exactly (this table is NOT
// append-only, so no narrowed grant).
//
// The store is constructed with the RAW `tp.pg` and opens its OWN short-lived `withTenant`
// transaction per call (see run-state.pg.ts's file header) — tests call it directly, no outer
// `withTenant` wrapping.
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
import { buildTenantPolicySql } from "@caisson/tenancy-rls";
import { ConflictError, NotFoundError } from "@caisson/kernel";
import { createPgRunStateStore } from "./run-state.pg.ts";

let tp: TestPg;
let migrationSql: string;

beforeAll(async () => {
  migrationSql = await Bun.file(
    new URL("./migrations/0002_agent_run_state.sql", import.meta.url),
  ).text();
  tp = await newTestPg();
  await tp.exec(migrationSql);
});

afterAll(async () => {
  await tp.close();
});

describe("createPgRunStateStore — CAS transitions over a real Postgres", () => {
  test("park -> approve -> claimResume survives FRESH store objects (real-restart shape)", async () => {
    const acct = randomUUID();
    const runId = randomUUID();

    // "process 1": park.
    await createPgRunStateStore(tp.pg, acct).park({
      runId,
      toolCallId: "call-1",
      resumeSeq: 4,
      parkedState: { messages: ["hello"] },
    });

    // "process 2" (a brand-new store instance): approve.
    const approved = await createPgRunStateStore(tp.pg, acct).approve(
      runId,
      "call-1",
    );
    expect(approved.status).toBe("running");

    // "process 3" (yet another fresh instance, e.g. the resume worker): claim + resume material.
    const material = await createPgRunStateStore(tp.pg, acct).claimResume(
      runId,
      "call-1",
    );
    expect(material.resumeSeq).toBe(4);
    expect(material.parkedState).toEqual({ messages: ["hello"] });
  });

  test("double-approval is idempotent — a racing second approve never re-mutates", async () => {
    const acct = randomUUID();
    const runId = randomUUID();
    await createPgRunStateStore(tp.pg, acct).park({
      runId,
      toolCallId: "call-1",
      resumeSeq: 0,
      parkedState: null,
    });
    const [a, b] = await Promise.all([
      createPgRunStateStore(tp.pg, acct).approve(runId, "call-1"),
      createPgRunStateStore(tp.pg, acct).approve(runId, "call-1"),
    ]);
    expect(a.status).toBe("running");
    expect(b.status).toBe("running");
  });

  test("two concurrent resume claims: exactly one wins, the other is rejected (never both execute)", async () => {
    const acct = randomUUID();
    const runId = randomUUID();
    await createPgRunStateStore(tp.pg, acct).park({
      runId,
      toolCallId: "call-1",
      resumeSeq: 0,
      parkedState: null,
    });
    await createPgRunStateStore(tp.pg, acct).approve(runId, "call-1");

    const results = await Promise.allSettled([
      createPgRunStateStore(tp.pg, acct).claimResume(runId, "call-1"),
      createPgRunStateStore(tp.pg, acct).claimResume(runId, "call-1"),
    ]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    if (rejected[0]?.status === "rejected") {
      expect(rejected[0].reason).toBeInstanceOf(ConflictError);
    }
  });

  test("deny finishes the run; a later approve of the same toolCallId is rejected", async () => {
    const acct = randomUUID();
    const runId = randomUUID();
    await createPgRunStateStore(tp.pg, acct).park({
      runId,
      toolCallId: "call-1",
      resumeSeq: 0,
      parkedState: null,
    });
    const denied = await createPgRunStateStore(tp.pg, acct).deny(
      runId,
      "call-1",
    );
    expect(denied.status).toBe("finished");
    await expect(
      createPgRunStateStore(tp.pg, acct).approve(runId, "call-1"),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  test("RETENTION (security audit finding 1): deny clears parked_state in the row", async () => {
    const acct = randomUUID();
    const runId = randomUUID();
    await createPgRunStateStore(tp.pg, acct).park({
      runId,
      toolCallId: "call-1",
      resumeSeq: 0,
      parkedState: { messages: ["sensitive conversation content"] },
    });
    await createPgRunStateStore(tp.pg, acct).deny(runId, "call-1");
    const rows = await tp.query<{ parked_state: unknown }>(
      `SELECT parked_state FROM agent_run_state WHERE run_id = $1`,
      [runId],
    );
    expect(rows[0]?.parked_state).toBeNull();
  });

  test("RETENTION (security audit finding 1): finish clears parked_state in the row", async () => {
    const acct = randomUUID();
    const runId = randomUUID();
    await createPgRunStateStore(tp.pg, acct).park({
      runId,
      toolCallId: "call-1",
      resumeSeq: 0,
      parkedState: { messages: ["sensitive conversation content"] },
    });
    await createPgRunStateStore(tp.pg, acct).finish(runId);
    const rows = await tp.query<{ parked_state: unknown }>(
      `SELECT parked_state FROM agent_run_state WHERE run_id = $1`,
      [runId],
    );
    expect(rows[0]?.parked_state).toBeNull();
  });

  test("unknown runId/toolCallId fail closed", async () => {
    const acct = randomUUID();
    await expect(
      createPgRunStateStore(tp.pg, acct).approve(randomUUID(), "call-1"),
    ).rejects.toBeInstanceOf(NotFoundError);

    const runId = randomUUID();
    await createPgRunStateStore(tp.pg, acct).park({
      runId,
      toolCallId: "call-1",
      resumeSeq: 0,
      parkedState: null,
    });
    await expect(
      createPgRunStateStore(tp.pg, acct).approve(runId, "wrong-call"),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  test("tenant isolation: one account's run-state never bleeds into another", async () => {
    const a = randomUUID();
    const b = randomUUID();
    const runId = randomUUID();
    await createPgRunStateStore(tp.pg, a).park({
      runId,
      toolCallId: "call-1",
      resumeSeq: 0,
      parkedState: null,
    });
    const seenByB = await createPgRunStateStore(tp.pg, b).read(runId);
    expect(seenByB).toBeUndefined();
    const seenByA = await createPgRunStateStore(tp.pg, a).read(runId);
    expect(seenByA?.status).toBe("parked");
  });

  test("migration RLS is byte-identical to buildTenantPolicySql (mutable table, no narrowed grant)", () => {
    for (const line of buildTenantPolicySql("agent_run_state").split("\n")) {
      expect(migrationSql).toContain(line);
    }
  });
});
