// src/sync/convergence.integration.test.ts — two-way sync convergence INTEGRATION test. Where the
// pure merge tests (reconcile.test.ts / tombstone.test.ts)
// drive hand-built changesets through the reconcile functions, THIS test drives the whole sync seam
// over TWO real in-process `bun:sqlite` replicas of one tenant: the canonical local store (a real
// `synced_rows` table mirrored into the `ChangesetLog`), a TEST-DOUBLED transport (in-process
// serialize → fail-closed boundary parse — NO real network), and the persistent LWW/tombstone merge
// (`reconcileWithTombstones`). It composes the shipped pieces; it builds no new product module.
//
// The guarantee pinned: two divergent replicas with concurrent per-key edits AND
// a delete converge byte-equal on the synced table after a round-trip; the result is deterministic
// (independent of the random replica ids and of changeset order); a delete does not resurrect; and the
// local canonical store is the convergence target. Deterministic + offline → CI-safe (no live network).
import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { canonicalize, TenancyError } from "@caisson-sh/kernel";
import type { JsonValue } from "@caisson-sh/kernel";
import { ChangesetLog, parseChangeset } from "./changeset.ts";
import { reconcileWithTombstones } from "./tombstone.ts";
import type { Tombstone } from "./tombstone.ts";
import type { Changeset, RowValues } from "./port.ts";

const TENANT = "tenant-a";

/** A row read back from the materialized convergence table — the byte-equality unit. */
interface SnapshotRow {
  tbl: string;
  pk: string;
  payload: string;
}

/**
 * The TEST-DOUBLE for a network transport: serialize a captured changeset, then re-parse it through
 * the fail-closed peer boundary ({@link parseChangeset}) on the receive side — exactly the validation a
 * real transport would owe — but entirely in-process. No socket, no fetch, no live network in CI.
 */
function transport(cs: Changeset): Changeset {
  const wire: unknown = JSON.parse(JSON.stringify(cs));
  return parseChangeset(wire);
}

/**
 * An in-process replica of ONE tenant's local store: a real `bun:sqlite` file (`:memory:`), the
 * materialized `synced_rows` convergence table, the `ChangesetLog` capture seam, and the
 * persisted tombstone set. The canonical local store is the authority — `put`/`remove` mutate
 * the data table AND mirror the change into the log; `integrate` reconciles a peer changeset toward
 * this local set and re-materializes the table from the converged result. A monotonic injected clock
 * stamps each write deterministically (no real wall clock in CI).
 */
class Replica {
  readonly #db: Database;
  readonly #log: ChangesetLog;
  #clock = 0;
  #tombstones: readonly Tombstone[] = [];

  constructor(tenantId: string) {
    this.#db = new Database(":memory:");
    this.#db.exec(
      "CREATE TABLE synced_rows (tbl TEXT NOT NULL, pk TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY (tbl, pk))",
    );
    this.#log = ChangesetLog.open(this.#db, tenantId, {
      now: () => this.#clock,
    });
  }

  /** Local upsert: write the canonical store, then mirror the change into the log at HLC time `at`. */
  put(table: string, pk: string, values: RowValues, at: number): void {
    this.#clock = at;
    this.#db
      .prepare(
        "INSERT INTO synced_rows (tbl, pk, payload) VALUES (?, ?, ?) ON CONFLICT (tbl, pk) DO UPDATE SET payload = excluded.payload",
      )
      .run(table, pk, canonicalize(values));
    this.#log.recordUpsert(table, pk, values);
  }

  /** Local delete: drop from the canonical store, then mirror the tombstone source into the log. */
  remove(table: string, pk: string, at: number): void {
    this.#clock = at;
    this.#db
      .prepare("DELETE FROM synced_rows WHERE tbl = ? AND pk = ?")
      .run(table, pk);
    this.#log.recordDelete(table, pk);
  }

  /** Package this replica's full changelog into a tenant-bound, replica-stamped changeset. */
  capture(): Changeset {
    return this.#log.capture(0);
  }

  /**
   * Integrate a peer's changeset: enforce the tenant partition (fail-closed), reconcile the
   * peer against THIS replica's changelog over the persisted tombstone set, persist the advanced
   * tombstones, and re-materialize `synced_rows` from the converged live set. The local store is the
   * convergence target — peers move toward it, never the other way.
   */
  integrate(peer: Changeset): void {
    this.#log.assertApplicable(peer);
    const mine = this.#log.capture(0);
    const { live, tombstones } = reconcileWithTombstones(this.#tombstones, [
      mine,
      peer,
    ]);
    this.#tombstones = tombstones;
    this.#db.transaction(() => {
      this.#db.exec("DELETE FROM synced_rows");
      const insert = this.#db.prepare(
        "INSERT INTO synced_rows (tbl, pk, payload) VALUES (?, ?, ?)",
      );
      for (const row of live) {
        insert.run(row.table, row.pk, canonicalize(row.values));
      }
    })();
  }

  /** The persisted tombstone set — asserts a delete became durable across the sync round. */
  tombstones(): readonly Tombstone[] {
    return this.#tombstones;
  }

  /**
   * Canonical byte-serialization of the synced table (rows ordered by `(tbl, pk)`, keys sorted). Two
   * replicas that have converged serialize to an IDENTICAL string.
   */
  snapshot(): string {
    const rows = this.#db
      .prepare("SELECT tbl, pk, payload FROM synced_rows ORDER BY tbl, pk")
      .all() as SnapshotRow[];
    const value: JsonValue = rows.map((r) => ({
      tbl: r.tbl,
      pk: r.pk,
      payload: r.payload,
    }));
    return canonicalize(value);
  }
}

/** A materialized `synced_rows` snapshot expectation, in canonical bytes. */
function expectSnapshot(
  rows: readonly { pk: string; values: RowValues; tbl?: string }[],
): string {
  const value: JsonValue = rows.map((r) => ({
    tbl: r.tbl ?? "docs",
    pk: r.pk,
    payload: canonicalize(r.values),
  }));
  return canonicalize(value);
}

describe("two-way convergence — concurrent per-key edits + a delete", () => {
  test("two divergent replicas reach byte-equal synced tables after one round-trip", () => {
    const a = new Replica(TENANT);
    const b = new Replica(TENANT);

    // Concurrent divergence with DISTINCT `updatedAt` on every cross-replica conflict, so the resolved
    // content depends only on the (non-forgeable) timestamps — never on the random replica ids:
    //   d1: A@2000 then B@2020 → B wins.   d2: A-only.   d3: B-only.
    //   d4: A creates@2002 then deletes@2010; B upserts@2005 (stale vs the delete) → d4 stays deleted.
    a.put("docs", "d1", { title: "d1-A", n: 1 }, 2000);
    a.put("docs", "d2", { title: "d2-A" }, 2001);
    a.put("docs", "d4", { title: "d4-A" }, 2002);
    a.remove("docs", "d4", 2010);

    b.put("docs", "d1", { title: "d1-B", n: 11 }, 2020);
    b.put("docs", "d3", { title: "d3-B" }, 2021);
    b.put("docs", "d4", { title: "d4-B" }, 2005);

    // One round-trip over the test-doubled transport (no real network).
    const fromA = transport(a.capture());
    const fromB = transport(b.capture());
    a.integrate(fromB);
    b.integrate(fromA);

    // Byte-equal on the synced table — the deterministic two-way convergence guarantee.
    expect(a.snapshot()).toBe(b.snapshot());

    // The converged content: B wins d1; d2/d3 survive; d4 stays tombstoned (no resurrection).
    const converged = expectSnapshot([
      { pk: "d1", values: { title: "d1-B", n: 11 } },
      { pk: "d2", values: { title: "d2-A" } },
      { pk: "d3", values: { title: "d3-B" } },
    ]);
    expect(a.snapshot()).toBe(converged);

    // The delete became a durable tombstone on BOTH replicas (persistence wired through sync).
    expect(a.tombstones().some((t) => t.pk === "d4")).toBe(true);
    expect(b.tombstones().some((t) => t.pk === "d4")).toBe(true);
  });

  test("convergence is deterministic — two independent runs reach the identical snapshot", () => {
    const round = (): string => {
      const a = new Replica(TENANT);
      const b = new Replica(TENANT);
      a.put("docs", "k", { v: "a" }, 1000);
      b.put("docs", "k", { v: "b" }, 2000); // B wins (distinct updatedAt → replica-id-independent)
      a.put("docs", "ka", { v: "1" }, 1001);
      b.put("docs", "kb", { v: "2" }, 1002);
      a.integrate(transport(b.capture()));
      b.integrate(transport(a.capture()));
      // Both replicas agree within the run...
      expect(a.snapshot()).toBe(b.snapshot());
      return a.snapshot();
    };
    // ...and the converged content is byte-identical across two fully independent runs (fresh random
    // replica ids each time) — convergence does not depend on which replica's id sorted higher.
    expect(round()).toBe(round());
  });
});

describe("apply path is tenant-partitioned (ADR-0073)", () => {
  test("a foreign-tenant changeset is rejected on integrate and never materialized", () => {
    const a = new Replica("tenant-a");
    const foreign = new Replica("tenant-b");
    foreign.put("docs", "x", { leak: "secret" }, 1000);

    expect(() => a.integrate(transport(foreign.capture()))).toThrow(
      TenancyError,
    );
    // A's store is untouched — a tenant-B changeset can never mutate a tenant-A file.
    expect(a.snapshot()).toBe(canonicalize([]));
  });
});

describe("tombstone persistence across sync rounds — no resurrection", () => {
  test("a persisted tombstone suppresses a stale upsert redelivered without the deleting changeset", () => {
    const a = new Replica(TENANT);
    const b = new Replica(TENANT);

    // Round 1: A deletes "r" @3010; B integrates the delete and persists the tombstone.
    a.remove("docs", "r", 3010);
    b.integrate(transport(a.capture()));
    expect(b.snapshot()).toBe(canonicalize([]));
    expect(b.tombstones().some((t) => t.pk === "r")).toBe(true);

    // Round 2: a SLOW third replica's stale upsert of "r" @3005 reaches B WITHOUT the delete in the
    // batch. The persisted tombstone must still win → no resurrection across rounds.
    const slow = new Replica(TENANT);
    slow.put("docs", "r", { v: "stale" }, 3005);
    const staleChangeset = slow.capture();
    b.integrate(transport(staleChangeset));
    expect(b.snapshot()).toBe(canonicalize([]));

    // Control: a fresh replica WITHOUT the tombstone integrating the SAME stale upsert resurrects "r" —
    // proving the persisted tombstone is load-bearing, not incidental.
    const fresh = new Replica(TENANT);
    fresh.integrate(transport(staleChangeset));
    expect(fresh.snapshot()).toBe(
      expectSnapshot([{ pk: "r", values: { v: "stale" } }]),
    );
  });
});
