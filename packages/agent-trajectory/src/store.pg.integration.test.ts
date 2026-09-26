// Integration proof for the PG-backed, append-only `TrajectoryStore` (ADR-0360 U-3). Runs the REAL
// `0001_trajectory_event.sql` migration against PGlite (a true Postgres with FORCE RLS, SET ROLE,
// jsonb). Proves the SAME append-only contract `store.test.ts` pins for the memory impl —
// idempotent byte-identical re-append, rewrite/gap rejection — PLUS the PG-only concerns:
// persistence across calls, immutability by withheld GRANT, and tenant isolation.
//
// The store is constructed ONCE per tenant with the RAW `tp.pg` (a `Transactor`) and opens its OWN
// short-lived `withTenant` transaction per call (see store.pg.ts's file header) — so tests call it
// directly, with no outer `withTenant` wrapping (that pattern deadlocks a store meant to interleave
// with a caller's own separate transactions, proven by the S3 agent-loop integration test before
// this shape existed).
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test";
// PGlite under CI runner load regularly crosses the 5s default; repo-wide standard treatment.
setDefaultTimeout(30_000);
import { randomUUID } from "node:crypto";
import { newTestPg, type TestPg } from "@caisson-sh/testing";
import { buildTenantPolicySql } from "@caisson-sh/tenancy-rls";
import { ConflictError, parseStrict } from "@caisson-sh/kernel";
import { createPgTrajectoryStore } from "./store.pg.ts";
import { TrajectoryEvent } from "./schema.ts";

let tp: TestPg;
let migrationSql: string;

function usageEvent(
  runId: string,
  seq: number,
  credits: number,
  eventId = randomUUID(),
): TrajectoryEvent {
  return parseStrict(TrajectoryEvent, {
    eventId,
    runId,
    seq,
    version: 1,
    occurredAt: "2026-07-17T10:00:00.000Z",
    kind: "model.usage",
    payload: {
      provider: "anthropic",
      model: "opus",
      inputTokens: 10,
      outputTokens: 2,
      credits,
      billingStatus: "metered",
    },
  });
}

beforeAll(async () => {
  migrationSql = await Bun.file(
    new URL("./migrations/0001_trajectory_event.sql", import.meta.url),
  ).text();
  tp = await newTestPg();
  await tp.exec(migrationSql);
});

afterAll(async () => {
  await tp.close();
});

describe("createPgTrajectoryStore — append-only over a real Postgres", () => {
  test("sequential appends persist across calls and read back in seq order", async () => {
    const acct = randomUUID();
    const runId = randomUUID();
    const store = createPgTrajectoryStore(tp.pg, acct);
    await store.append(usageEvent(runId, 0, 1));
    await store.append(usageEvent(runId, 1, 2));
    const events = await store.read(runId);
    expect(events.map((e) => e.seq)).toEqual([0, 1]);
  });

  test("re-appending a byte-identical event at a recorded seq is idempotent", async () => {
    const acct = randomUUID();
    const runId = randomUUID();
    const store = createPgTrajectoryStore(tp.pg, acct);
    const ev = usageEvent(runId, 0, 1);
    await store.append(ev);
    await store.append(ev);
    const events = await store.read(runId);
    expect(events).toHaveLength(1);
  });

  test("a rewrite (same seq, different content) is rejected", async () => {
    const acct = randomUUID();
    const runId = randomUUID();
    const store = createPgTrajectoryStore(tp.pg, acct);
    await store.append(usageEvent(runId, 0, 1));
    await expect(
      store.append(usageEvent(runId, 0, 999)),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  test("a seq gap is rejected", async () => {
    const acct = randomUUID();
    const runId = randomUUID();
    const store = createPgTrajectoryStore(tp.pg, acct);
    await store.append(usageEvent(runId, 0, 1));
    await expect(store.append(usageEvent(runId, 2, 3))).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  test("an unknown run reads back empty", async () => {
    const acct = randomUUID();
    const events = await createPgTrajectoryStore(tp.pg, acct).read(
      randomUUID(),
    );
    expect(events).toEqual([]);
  });

  test("tenant isolation: one account never reads another's events", async () => {
    const a = randomUUID();
    const b = randomUUID();
    const runId = randomUUID();
    await createPgTrajectoryStore(tp.pg, a).append(usageEvent(runId, 0, 1));
    const seenByB = await createPgTrajectoryStore(tp.pg, b).read(runId);
    expect(seenByB).toEqual([]);
    const seenByA = await createPgTrajectoryStore(tp.pg, a).read(runId);
    expect(seenByA).toHaveLength(1);
  });

  test("the app role may append but is DENIED UPDATE and DELETE on trajectory_event", async () => {
    const acct = randomUUID();
    const runId = randomUUID();
    await createPgTrajectoryStore(tp.pg, acct).append(usageEvent(runId, 0, 1));
    await expect(
      tp.asTenant(acct, (tx) =>
        tx.query(`UPDATE trajectory_event SET seq = 99 WHERE run_id = $1`, [
          runId,
        ]),
      ),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      tp.asTenant(acct, (tx) =>
        tx.query(`DELETE FROM trajectory_event WHERE run_id = $1`, [runId]),
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  test("migration RLS mirrors buildTenantPolicySql but withholds + REVOKEs UPDATE/DELETE", () => {
    for (const line of buildTenantPolicySql("trajectory_event").split("\n")) {
      if (line.startsWith("GRANT ")) continue; // the grant is narrowed below.
      expect(migrationSql).toContain(line);
    }
    expect(migrationSql).toContain(
      "GRANT SELECT, INSERT ON trajectory_event TO app;",
    );
    expect(migrationSql).toContain(
      "REVOKE UPDATE, DELETE ON trajectory_event FROM app;",
    );
    expect(migrationSql).not.toMatch(
      /GRANT[^;]*\b(?:UPDATE|DELETE)\b[^;]*ON trajectory_event/i,
    );
  });
});
