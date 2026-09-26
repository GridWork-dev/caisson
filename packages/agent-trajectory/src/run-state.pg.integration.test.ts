// Integration proof for the PG-backed `RunStateStore` (ADR-0360 U-3, encRef wrap ADR-0361). Runs
// the REAL `0002_agent_run_state.sql` + `0003_agent_run_state_parked_state_encrypted.sql`
// migrations against PGlite. Proves the CAS contract over a real Postgres: park -> approve ->
// claimResume survives FRESH store objects (the store-layer analogue of a process restart — the
// ai-kit-level "real process boundary" proof lives in `packages/ai-kit/src/approval.test.ts`, which
// drives the SAME stores through the loop); double-approval idempotent; a second concurrent
// claimResume can never also execute; tenant isolation; the migration's RLS matches
// `buildTenantPolicySql` exactly (this table is NOT append-only, so no narrowed grant); and (ADR-0361)
// a raw SQL read of the column never yields plaintext.
//
// The store is constructed with the RAW `tp.pg` and opens its OWN short-lived `withTenant`
// transaction per call (see run-state.pg.ts's file header) — tests call it directly, no outer
// `withTenant` wrapping. `cryptoCtxFor` mirrors `@caisson-sh/ai-kit`'s `byok-store.integration.test.ts`
// helper: a fixed `DerivedKeyProvider` + `derivedContext(provider, accountId)` per account, so two
// "fresh" store instances constructed for the SAME account (simulating separate processes) derive
// the SAME key deterministically — no shared in-memory state required.
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
import { newTestPg, type TestPg } from "@caisson-sh/testing";
import {
  buildTenantPolicySql,
  type TenantExecutor,
  type Transactor,
} from "@caisson-sh/tenancy-rls";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@caisson-sh/kernel";
import {
  DerivedKeyProvider,
  derivedContext,
  type FieldCryptoContext,
} from "@caisson-sh/field-crypto";
import { createPgRunStateStore } from "./run-state.pg.ts";

const MASTER = Buffer.alloc(32, 7);
const SALT = Buffer.alloc(32, 9);
const KEY_PROVIDER = new DerivedKeyProvider(MASTER, SALT);
const cryptoCtxFor = (accountId: string): FieldCryptoContext =>
  derivedContext(KEY_PROVIDER, accountId);

/** A fresh `RunStateStore` for `accountId` — the test-suite's stand-in for "a brand-new store
 *  instance, possibly in another process" (see the file header on why `cryptoCtxFor` is safe to
 *  re-derive per call). */
function stateStore(
  tp: TestPg,
  accountId: string,
): ReturnType<typeof createPgRunStateStore> {
  return createPgRunStateStore(tp.pg, accountId, cryptoCtxFor(accountId));
}

let tp: TestPg;
let migrationSql: string;

beforeAll(async () => {
  migrationSql = await Bun.file(
    new URL("./migrations/0002_agent_run_state.sql", import.meta.url),
  ).text();
  const encryptedColumnSql = await Bun.file(
    new URL(
      "./migrations/0003_agent_run_state_parked_state_encrypted.sql",
      import.meta.url,
    ),
  ).text();
  tp = await newTestPg();
  await tp.exec(migrationSql);
  await tp.exec(encryptedColumnSql);
});

afterAll(async () => {
  await tp.close();
});

describe("createPgRunStateStore — CAS transitions over a real Postgres", () => {
  test("rejects direct and lazy crypto contexts for a different tenant before SQL mutation", async () => {
    const accountId = randomUUID();
    const otherAccountId = randomUUID();

    const directRunId = randomUUID();
    const direct = createPgRunStateStore(
      tp.pg,
      accountId,
      cryptoCtxFor(otherAccountId),
    );
    await expect(
      direct.park({
        runId: directRunId,
        toolCallId: "call-direct",
        resumeSeq: 0,
        parkedState: { secret: "direct" },
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    const lazyRunId = randomUUID();
    const lazy = createPgRunStateStore(tp.pg, accountId, async (fn) =>
      fn(tp.pg, cryptoCtxFor(otherAccountId)),
    );
    await expect(
      lazy.park({
        runId: lazyRunId,
        toolCallId: "call-lazy",
        resumeSeq: 0,
        parkedState: { secret: "lazy" },
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    const rows = await tp.query<{ run_id: string }>(
      `SELECT run_id FROM agent_run_state WHERE run_id = ANY($1::text[])`,
      [[directRunId, lazyRunId]],
    );
    expect(rows).toHaveLength(0);
  });

  test("status reads use a snapshot-only query that omits parked_state", async () => {
    const queries: string[] = [];
    const executor: TenantExecutor = {
      async query<T>(sql: string): Promise<{ rows: T[] }> {
        queries.push(sql);
        if (sql.includes("FROM pg_roles")) {
          return {
            rows: [{ rolsuper: false, rolbypassrls: false }] as T[],
          };
        }
        if (sql.includes("FROM agent_run_state")) {
          return {
            rows: [
              {
                status: "parked",
                pending_tool_call_id: "call-1",
                resume_seq: 4,
                updated_at: new Date("2026-07-26T00:00:00.000Z"),
              },
            ] as T[],
          };
        }
        return { rows: [] };
      },
      async exec(sql: string) {
        queries.push(sql);
      },
    };
    const transactor: Transactor = {
      transaction: (fn) => fn(executor),
    };
    const store = createPgRunStateStore(
      transactor,
      "acct-query-spy",
      cryptoCtxFor("acct-query-spy"),
    );

    expect(await store.read("run-query-spy")).toMatchObject({
      runId: "run-query-spy",
      status: "parked",
      resumeSeq: 4,
    });
    const statusQuery = queries.find((sql) =>
      sql.includes("FROM agent_run_state"),
    );
    expect(statusQuery).toBeDefined();
    expect(statusQuery).not.toContain("parked_state");
  });

  test("park -> approve -> claimResume survives FRESH store objects (real-restart shape)", async () => {
    const acct = randomUUID();
    const runId = randomUUID();

    // "process 1": park.
    await stateStore(tp, acct).park({
      runId,
      toolCallId: "call-1",
      resumeSeq: 4,
      parkedState: { messages: ["hello"] },
    });

    // "process 2" (a brand-new store instance): approve.
    const approved = await stateStore(tp, acct).approve(runId, "call-1");
    expect(approved.status).toBe("running");

    // "process 3" (yet another fresh instance, e.g. the resume worker): claim + resume material.
    const material = await stateStore(tp, acct).claimResume(runId, "call-1");
    expect(material.resumeSeq).toBe(4);
    expect(material.parkedState).toEqual({ messages: ["hello"] });
  });

  test("double-approval is idempotent — a racing second approve never re-mutates", async () => {
    const acct = randomUUID();
    const runId = randomUUID();
    await stateStore(tp, acct).park({
      runId,
      toolCallId: "call-1",
      resumeSeq: 0,
      parkedState: null,
    });
    const [a, b] = await Promise.all([
      stateStore(tp, acct).approve(runId, "call-1"),
      stateStore(tp, acct).approve(runId, "call-1"),
    ]);
    expect(a.status).toBe("running");
    expect(b.status).toBe("running");
  });

  test("two concurrent resume claims: exactly one wins, the other is rejected (never both execute)", async () => {
    const acct = randomUUID();
    const runId = randomUUID();
    await stateStore(tp, acct).park({
      runId,
      toolCallId: "call-1",
      resumeSeq: 0,
      parkedState: null,
    });
    await stateStore(tp, acct).approve(runId, "call-1");

    const results = await Promise.allSettled([
      stateStore(tp, acct).claimResume(runId, "call-1"),
      stateStore(tp, acct).claimResume(runId, "call-1"),
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
    await stateStore(tp, acct).park({
      runId,
      toolCallId: "call-1",
      resumeSeq: 0,
      parkedState: null,
    });
    const denied = await stateStore(tp, acct).deny(runId, "call-1");
    expect(denied.status).toBe("finished");
    await expect(
      stateStore(tp, acct).approve(runId, "call-1"),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  test("RETENTION (security audit finding 1): deny clears parked_state in the row", async () => {
    const acct = randomUUID();
    const runId = randomUUID();
    await stateStore(tp, acct).park({
      runId,
      toolCallId: "call-1",
      resumeSeq: 0,
      parkedState: { messages: ["sensitive conversation content"] },
    });
    await stateStore(tp, acct).deny(runId, "call-1");
    const rows = await tp.query<{ parked_state: unknown }>(
      `SELECT parked_state FROM agent_run_state WHERE run_id = $1`,
      [runId],
    );
    expect(rows[0]?.parked_state).toBeNull();
  });

  test("RETENTION (security audit finding 1): finish clears parked_state in the row", async () => {
    const acct = randomUUID();
    const runId = randomUUID();
    await stateStore(tp, acct).park({
      runId,
      toolCallId: "call-1",
      resumeSeq: 0,
      parkedState: { messages: ["sensitive conversation content"] },
    });
    await stateStore(tp, acct).finish(runId);
    const rows = await tp.query<{ parked_state: unknown }>(
      `SELECT parked_state FROM agent_run_state WHERE run_id = $1`,
      [runId],
    );
    expect(rows[0]?.parked_state).toBeNull();
  });

  test("resumeSeqAdvance is applied exactly once, on the winning approve only (WR-04)", async () => {
    const acct = randomUUID();
    const runId = randomUUID();
    await stateStore(tp, acct).park({
      runId,
      toolCallId: "call-1",
      resumeSeq: 5,
      parkedState: null,
    });
    const first = await stateStore(tp, acct).approve(runId, "call-1", 1);
    expect(first.resumeSeq).toBe(6);
    const second = await stateStore(tp, acct).approve(runId, "call-1", 1);
    expect(second.resumeSeq).toBe(6); // NOT re-advanced to 7 on the idempotent retry
  });

  test("re-park after a claimed resume succeeds; parking an unclaimed/already-parked run fails closed (WR-04)", async () => {
    const acct = randomUUID();
    const runId = randomUUID();
    await stateStore(tp, acct).park({
      runId,
      toolCallId: "call-1",
      resumeSeq: 0,
      parkedState: null,
    });
    await stateStore(tp, acct).approve(runId, "call-1");
    await stateStore(tp, acct).claimResume(runId, "call-1");

    // The run is "running" with no unclaimed pending call — a second gated tool may re-park it
    // (the ON CONFLICT DO UPDATE ... WHERE status='running' AND claimed=true CAS).
    await stateStore(tp, acct).park({
      runId,
      toolCallId: "call-2",
      resumeSeq: 3,
      parkedState: { messages: ["b"] },
    });
    expect(await stateStore(tp, acct).read(runId)).toMatchObject({
      status: "parked",
      pendingToolCallId: "call-2",
      resumeSeq: 3,
    });

    // Parking again while ALREADY parked (unclaimed) is a caller bug — fail closed.
    await expect(
      stateStore(tp, acct).park({
        runId,
        toolCallId: "call-3",
        resumeSeq: 4,
        parkedState: null,
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  test("unknown runId/toolCallId fail closed", async () => {
    const acct = randomUUID();
    await expect(
      stateStore(tp, acct).approve(randomUUID(), "call-1"),
    ).rejects.toBeInstanceOf(NotFoundError);

    const runId = randomUUID();
    await stateStore(tp, acct).park({
      runId,
      toolCallId: "call-1",
      resumeSeq: 0,
      parkedState: null,
    });
    await expect(
      stateStore(tp, acct).approve(runId, "wrong-call"),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  test("deny/claimResume/finish on an unknown runId fail closed (WR-04, only approve was covered before)", async () => {
    const acct = randomUUID();
    await expect(
      stateStore(tp, acct).deny(randomUUID(), "call-1"),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      stateStore(tp, acct).claimResume(randomUUID(), "call-1"),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      stateStore(tp, acct).finish(randomUUID()),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  test("tenant isolation: one account's run-state never bleeds into another", async () => {
    const a = randomUUID();
    const b = randomUUID();
    const runId = randomUUID();
    await stateStore(tp, a).park({
      runId,
      toolCallId: "call-1",
      resumeSeq: 0,
      parkedState: null,
    });
    const seenByB = await stateStore(tp, b).read(runId);
    expect(seenByB).toBeUndefined();
    const seenByA = await stateStore(tp, a).read(runId);
    expect(seenByA?.status).toBe("parked");
  });

  test("migration RLS is byte-identical to buildTenantPolicySql (mutable table, no narrowed grant)", () => {
    for (const line of buildTenantPolicySql("agent_run_state").split("\n")) {
      expect(migrationSql).toContain(line);
    }
  });
});

describe("ADR-0361 — parked_state is encrypted at rest, never plaintext on a raw SQL read", () => {
  test("a raw SQL read of agent_run_state yields no plaintext conversation/tool-arg strings", async () => {
    const acct = randomUUID();
    const runId = randomUUID();
    const SECRET_CONVERSATION =
      "the operator's actual private conversation body";
    const SECRET_TOOL_ARG = "rm -rf /some/sensitive/path --force";
    await stateStore(tp, acct).park({
      runId,
      toolCallId: "call-1",
      resumeSeq: 0,
      parkedState: {
        messages: [{ role: "user", content: SECRET_CONVERSATION }],
        calls: [
          {
            toolCallId: "call-1",
            toolName: "danger",
            input: { arg: SECRET_TOOL_ARG },
          },
        ],
      },
    });

    // Bypass the store entirely — read the raw column exactly as a DB dump / a stray SELECT would.
    const rows = await tp.query<{ parked_state: unknown }>(
      `SELECT parked_state FROM agent_run_state WHERE run_id = $1`,
      [runId],
    );
    const raw = rows[0]?.parked_state;
    expect(raw).not.toBeNull();
    expect(typeof raw).toBe("string");
    const rawText = raw as string;

    // The plaintext secrets must not appear anywhere in the raw stored bytes.
    expect(rawText).not.toContain(SECRET_CONVERSATION);
    expect(rawText).not.toContain(SECRET_TOOL_ARG);
    expect(rawText).not.toContain("danger"); // the tool name — also never inlined
    // And the stored value must actually be the field-crypto base64 envelope, not disguised JSON —
    // parsing it as JSON must fail (a plaintext jsonb write would parse cleanly as an object/array).
    expect(() => JSON.parse(rawText)).toThrow();

    // The store's own decrypt path still recovers the original snapshot — proves this is a real
    // reversible encryption, not just data loss.
    await stateStore(tp, acct).approve(runId, "call-1");
    const material = await stateStore(tp, acct).claimResume(runId, "call-1");
    expect(material.parkedState).toMatchObject({
      messages: [{ role: "user", content: SECRET_CONVERSATION }],
      calls: [
        {
          toolCallId: "call-1",
          toolName: "danger",
          input: { arg: SECRET_TOOL_ARG },
        },
      ],
    });
  });

  test("cross-run ciphertext relocation fails AEAD auth (row-bound AAD, ADR-0055)", async () => {
    const acct = randomUUID();
    const runIdA = randomUUID();
    const runIdB = randomUUID();
    await stateStore(tp, acct).park({
      runId: runIdA,
      toolCallId: "call-1",
      resumeSeq: 0,
      parkedState: { messages: ["run A's body"] },
    });
    await stateStore(tp, acct).park({
      runId: runIdB,
      toolCallId: "call-1",
      resumeSeq: 0,
      parkedState: { messages: ["run B's body"] },
    });
    const rowA = await tp.query<{ parked_state: string }>(
      `SELECT parked_state FROM agent_run_state WHERE run_id = $1`,
      [runIdA],
    );
    // Graft run A's ciphertext onto run B's row — the AAD binds run_id, so this must fail closed
    // on decrypt (never silently return run A's plaintext under run B's identity).
    await tp.exec(
      `UPDATE agent_run_state SET parked_state = '${rowA[0]?.parked_state}' WHERE run_id = '${runIdB}'`,
    );
    await stateStore(tp, acct).approve(runIdB, "call-1");
    await expect(
      stateStore(tp, acct).claimResume(runIdB, "call-1"),
    ).rejects.toThrow();
  });
});
