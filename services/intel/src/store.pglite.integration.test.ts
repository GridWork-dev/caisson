// PGlite-backed PostgresStore parity test (mirrors services/license's PGlite convention). Runs
// the REAL SQL PostgresStore issues — the ON CONFLICT (dedup_key) DO UPDATE ... RETURNING
// seen_count upsert — against an embedded Postgres, closing the store-parity gap: a dedup
// contract that passes against InMemoryStore (store.test.ts) must give the SAME semantics
// against the real SQL. PostgresStore's constructor accepts an injected PgQueryable (any object
// structurally shaped like `pg.Pool`), so `tp.pg` (a PGlite instance) plugs in directly — no
// mocking, no second code path.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type TestPg, newTestPg } from "@caisson/testing";
import { PostgresStore } from "./store.ts";
import type { Finding } from "./finding.ts";

let tp: TestPg;
let store: PostgresStore;

beforeAll(async () => {
  tp = await newTestPg();
  const schemaSql = readFileSync(
    join(import.meta.dir, "../migrations/0001_intel_schema.sql"),
    "utf8",
  );
  await tp.exec(schemaSql);
  store = new PostgresStore(tp.pg);
});

afterAll(async () => {
  await tp.close();
});

const finding: Finding = {
  source: "github",
  kind: "traction",
  severity: "info",
  title: "repo gained stars",
  body: "detail",
  dedupKey: "github:pglite-parity:1",
  payload: {},
};

// A real `run_id` is a uuid column — production always supplies one via store.startRun()
// (crypto.randomUUID()). InMemoryStore never enforces the format (store.test.ts's "run-1"/"run-2"
// literals are fine there), but the REAL schema does — this is exactly the kind of drift the
// parity test exists to catch, so this fixture uses real UUIDs, not the InMemoryStore tests' ids.
const RUN_1 = crypto.randomUUID();
const RUN_2 = crypto.randomUUID();

describe("PostgresStore.upsertFinding (PGlite parity with InMemoryStore)", () => {
  test("first insert: isNew true, seen_count 1", async () => {
    const result = await store.upsertFinding(finding, RUN_1);
    expect(result.isNew).toBe(true);

    const rows = await tp.query<{ seen_count: number }>(
      "SELECT seen_count FROM intel.findings WHERE dedup_key = $1",
      [finding.dedupKey],
    );
    expect(rows[0]?.seen_count).toBe(1);
  });

  test("a re-observation with the same dedup key reinforces: isNew false, seen_count 2", async () => {
    const result = await store.upsertFinding(
      { ...finding, body: "updated detail" },
      RUN_2,
    );
    expect(result.isNew).toBe(false);

    const rows = await tp.query<{ seen_count: number; body: string }>(
      "SELECT seen_count, body FROM intel.findings WHERE dedup_key = $1",
      [finding.dedupKey],
    );
    expect(rows[0]?.seen_count).toBe(2);
    expect(rows[0]?.body).toBe("updated detail");
    // Exactly one row — ON CONFLICT updated in place, it did not insert a duplicate.
    const all = await tp.query(
      "SELECT id FROM intel.findings WHERE dedup_key = $1",
      [finding.dedupKey],
    );
    expect(all).toHaveLength(1);
  });

  test("a different dedup key is a distinct row: isNew true", async () => {
    const other = await store.upsertFinding(
      { ...finding, dedupKey: "github:pglite-parity:2" },
      RUN_1,
    );
    expect(other.isNew).toBe(true);
  });
});

describe("PostgresStore watch_state (PGlite)", () => {
  test("round-trips and only returns requested keys", async () => {
    await store.setWatchState({ a: "1", b: "2" });
    expect(await store.getWatchState(["a", "b", "c"])).toEqual({
      a: "1",
      b: "2",
    });
  });

  test("a later set overwrites the prior value", async () => {
    await store.setWatchState({ a: "1" });
    await store.setWatchState({ a: "2" });
    expect(await store.getWatchState(["a"])).toEqual({ a: "2" });
  });
});

describe("PostgresStore run ledger (PGlite)", () => {
  test("startRun then finishRun reaches a terminal status", async () => {
    const runId = await store.startRun("pglite-test-watcher");
    await store.finishRun(runId, "ok", 3);
    const rows = await tp.query<{ status: string; findings_count: number }>(
      "SELECT status, findings_count FROM intel.runs WHERE id = $1",
      [runId],
    );
    expect(rows[0]).toEqual({ status: "ok", findings_count: 3 });
  });

  test("pruneRuns deletes rows older than the retention window, keeps recent ones", async () => {
    const oldId = await store.startRun("old-watcher");
    await tp.exec(
      `UPDATE intel.runs SET started_at = now() - interval '200 days' WHERE id = '${oldId}'`,
    );
    const recentId = await store.startRun("recent-watcher");

    await store.pruneRuns();

    const remaining = await tp.query<{ id: string }>(
      "SELECT id FROM intel.runs WHERE id = ANY($1::uuid[])",
      [[oldId, recentId]],
    );
    expect(remaining.map((r) => r.id)).toEqual([recentId]);
  });
});

describe("PostgresStore.checkRoleIsolation (PGlite)", () => {
  test("no public.accounts table at all: the query fails, isolation reads as held", async () => {
    // No commerce schema exists in this fixture, so `SELECT 1 FROM public.accounts` fails with
    // "relation does not exist" rather than a permission error — checkRoleIsolation treats ANY
    // query failure as isolation held, and a missing table is as valid a failure as a denied one.
    expect(await store.checkRoleIsolation()).toBe(true);
  });

  test("a readable public.accounts table: the query succeeds, isolation reads as FAILED (the alarm)", async () => {
    // Simulates the real containment failure this check exists to catch: a connection that CAN
    // read commerce data. PGlite's connection is always a superuser, so creating the table here
    // is enough to prove the function correctly flips to `false` when the read actually succeeds.
    // No uuid-generation extension dependency — the query only needs the table to exist and be
    // readable; it never needs a row.
    await tp.exec(
      "CREATE TABLE IF NOT EXISTS public.accounts (id text PRIMARY KEY)",
    );
    expect(await store.checkRoleIsolation()).toBe(false);
  });
});
