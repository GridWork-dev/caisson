// src/sync/tombstone.test.ts — tombstone persistence + horizon GC. In-process,
// deterministic, NO network. The single-batch merge (`reconcile.ts`) already excludes a winning
// delete WITHIN one batch (its `tombstone-resolve` golden is pinned in `reconcile.test.ts`); these
// tests pin the CROSS-ROUND guarantee this module adds: a persisted tombstone outranks a stale,
// lower-stamped upsert delivered in a LATER batch (no resurrection), a strictly-newer upsert legitimately
// re-creates the row, the merge stays order-independent, the tenant partition fails closed, and horizon
// GC drops only sufficiently-old tombstones — with an explicit assertion of the safety contract (GC'ing
// too early reopens a resurrection window).
import { describe, expect, test } from "bun:test";
import { reconcileReplicas, type ReconciledRow } from "./reconcile.ts";
import {
  reconcileWithTombstones,
  gcTombstones,
  type Tombstone,
} from "./tombstone.ts";
import type { Changeset, ChangesetEntry } from "./port.ts";
import { TenancyError } from "@caisson-sh/kernel";

const TENANT = "tenant-a";
// Fixed replica ids so the (updatedAt, replicaId) tiebreak is reproducible: "bbbb…" > "aaaa…".
const REPLICA_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const REPLICA_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function upsert(
  pk: string,
  values: Record<string, number | string>,
  updatedAt: number,
  seq: number,
  table = "docs",
): ChangesetEntry {
  return { table, pk, op: "upsert", values, updatedAt, seq };
}

function del(
  pk: string,
  updatedAt: number,
  seq: number,
  table = "docs",
): ChangesetEntry {
  return { table, pk, op: "delete", values: null, updatedAt, seq };
}

function cs(replicaId: string, entries: ChangesetEntry[]): Changeset {
  let until = 0;
  for (const e of entries) until = Math.max(until, e.seq);
  return { tenantId: TENANT, replicaId, until, entries };
}

function liveByPk(
  rows: readonly ReconciledRow[],
  pk: string,
): ReconciledRow | undefined {
  return rows.find((r) => r.pk === pk);
}

function tombByPk(ts: readonly Tombstone[], pk: string): Tombstone | undefined {
  return ts.find((t) => t.pk === pk);
}

describe("reconcileWithTombstones — live set composes reconcileReplicas (reconcile.ts)", () => {
  // The same divergent two-replica tombstone scenario the reconcile golden pins, run through the persistent
  // layer with no prior tombstones: the live set MUST equal the single-batch merge (golden-pinned).
  const A = cs(REPLICA_A, [
    upsert("e1", { title: "e1-A" }, 3000, 1),
    upsert("e3", { title: "e3-A" }, 3001, 2),
    del("e1", 3010, 3),
  ]);
  const B = cs(REPLICA_B, [
    upsert("e1", { title: "e1-B" }, 3005, 1),
    upsert("e2", { title: "e2-B" }, 3006, 2),
  ]);

  test("no-prior live set equals reconcileReplicas (ties the layer to the tombstone golden)", () => {
    const { live } = reconcileWithTombstones([], [A, B]);
    expect(live).toEqual(reconcileReplicas([A, B]));
    // e1 is tombstoned (delete @3010 beats the @3005 upsert) → excluded; e2, e3 survive.
    expect(liveByPk(live, "e1")).toBeUndefined();
    expect(liveByPk(live, "e2")?.values).toEqual({ title: "e2-B" });
    expect(liveByPk(live, "e3")?.values).toEqual({ title: "e3-A" });
  });

  test("the winning delete is captured as a persisted tombstone", () => {
    const { tombstones } = reconcileWithTombstones([], [A, B]);
    const e1 = tombByPk(tombstones, "e1");
    expect(e1?.stamp).toEqual({ physical: 3010, node: REPLICA_A, counter: 3 });
    // Surviving upserts are not tombstones.
    expect(tombByPk(tombstones, "e2")).toBeUndefined();
    expect(tombByPk(tombstones, "e3")).toBeUndefined();
  });
});

describe("reconcileWithTombstones — no resurrection across sync rounds", () => {
  test("a persisted tombstone suppresses a stale, lower-stamped upsert from a later batch", () => {
    // Round 1: replica A deletes "r" at physical 3010. The original delete is applied + dropped; only
    // the tombstone persists.
    const round1 = reconcileWithTombstones(
      [],
      [cs(REPLICA_A, [del("r", 3010, 1)])],
    );
    expect(liveByPk(round1.live, "r")).toBeUndefined();
    expect(tombByPk(round1.tombstones, "r")?.stamp.physical).toBe(3010);

    // Round 2: a STALE upsert (@3005 < 3010) arrives from B without the deleting changeset. The
    // persisted tombstone must still win → no resurrection.
    const round2 = reconcileWithTombstones(round1.tombstones, [
      cs(REPLICA_B, [upsert("r", { v: 1 }, 3005, 1)]),
    ]);
    expect(liveByPk(round2.live, "r")).toBeUndefined();
    expect(tombByPk(round2.tombstones, "r")?.stamp.physical).toBe(3010);
  });

  test("control: WITHOUT the tombstone the same stale upsert resurrects (proves the tombstone is load-bearing)", () => {
    const resurrected = reconcileWithTombstones(
      [],
      [cs(REPLICA_B, [upsert("r", { v: 1 }, 3005, 1)])],
    );
    expect(liveByPk(resurrected.live, "r")?.values).toEqual({ v: 1 });
  });

  test("a strictly-newer upsert legitimately re-creates a tombstoned row and clears the tombstone", () => {
    const prior: Tombstone[] = [
      {
        table: "docs",
        pk: "r",
        stamp: { physical: 3010, node: REPLICA_A, counter: 1 },
      },
    ];
    const { live, tombstones } = reconcileWithTombstones(prior, [
      cs(REPLICA_B, [upsert("r", { v: 9 }, 4000, 1)]),
    ]);
    expect(liveByPk(live, "r")?.values).toEqual({ v: 9 });
    expect(tombByPk(tombstones, "r")).toBeUndefined();
  });
});

describe("reconcileWithTombstones — determinism + partition guard", () => {
  test("the merge is order-independent (live + tombstones identical for [A,B] and [B,A])", () => {
    const prior: Tombstone[] = [
      {
        table: "docs",
        pk: "old",
        stamp: { physical: 100, node: REPLICA_A, counter: 1 },
      },
    ];
    const A = cs(REPLICA_A, [
      upsert("k", { v: 1 }, 2000, 1),
      del("d", 2001, 2),
    ]);
    const B = cs(REPLICA_B, [
      upsert("k", { v: 2 }, 2010, 1),
      upsert("d", { v: 0 }, 1999, 2),
    ]);
    const ab = reconcileWithTombstones(prior, [A, B]);
    const ba = reconcileWithTombstones(prior, [B, A]);
    expect(ab.live).toEqual(ba.live);
    expect(ab.tombstones).toEqual(ba.tombstones);
    // "d": delete @2001 beats the stale @1999 upsert → tombstoned, not live.
    expect(liveByPk(ab.live, "d")).toBeUndefined();
    expect(tombByPk(ab.tombstones, "d")).toBeDefined();
    // "old" persists; "k" resolves to B (@2010 > @2000).
    expect(tombByPk(ab.tombstones, "old")).toBeDefined();
    expect(liveByPk(ab.live, "k")?.values).toEqual({ v: 2 });
  });

  test("cross-tenant changesets fail closed (ADR-0073)", () => {
    const a = cs(REPLICA_A, [upsert("k", { v: 1 }, 2000, 1)]);
    const foreign: Changeset = {
      tenantId: "tenant-b",
      replicaId: REPLICA_B,
      until: 1,
      entries: [upsert("k", { v: 2 }, 2001, 1)],
    };
    expect(() => reconcileWithTombstones([], [a, foreign])).toThrow(
      TenancyError,
    );
  });

  test("empty changesets yield no live rows and carry the prior tombstones forward", () => {
    const prior: Tombstone[] = [
      {
        table: "docs",
        pk: "z",
        stamp: { physical: 100, node: REPLICA_A, counter: 1 },
      },
      {
        table: "docs",
        pk: "a",
        stamp: { physical: 200, node: REPLICA_B, counter: 1 },
      },
    ];
    const { live, tombstones } = reconcileWithTombstones(prior, []);
    expect(live).toEqual([]);
    // Carried forward, total-ordered by (table, pk).
    expect(tombstones.map((t) => t.pk)).toEqual(["a", "z"]);
  });
});

describe("gcTombstones — horizon garbage collection", () => {
  const set: Tombstone[] = [
    {
      table: "docs",
      pk: "old",
      stamp: { physical: 1000, node: REPLICA_A, counter: 1 },
    },
    {
      table: "docs",
      pk: "new",
      stamp: { physical: 5000, node: REPLICA_B, counter: 1 },
    },
  ];

  test("drops tombstones strictly older than the horizon, keeps the rest (boundary inclusive)", () => {
    expect(gcTombstones(set, 3000).map((t) => t.pk)).toEqual(["new"]);
    // Horizon at the older stamp keeps both (>= is inclusive).
    expect(
      gcTombstones(set, 1000)
        .map((t) => t.pk)
        .sort(),
    ).toEqual(["new", "old"]);
    // Horizon past every stamp collects all.
    expect(gcTombstones(set, 5001)).toEqual([]);
  });

  test("GC is pure — it does not mutate the input set", () => {
    const snapshot = [...set];
    gcTombstones(set, 9999);
    expect(set).toEqual(snapshot);
  });

  test("safety contract: GC'ing past a tombstone's horizon reopens a resurrection window", () => {
    // A tombstone at physical 3010; a stale upsert at 3005 is still pending on a slow replica.
    const tombstones: Tombstone[] = [
      {
        table: "docs",
        pk: "r",
        stamp: { physical: 3010, node: REPLICA_A, counter: 1 },
      },
    ];
    // Correct horizon (below the tombstone) KEEPS it → the stale upsert is still suppressed.
    const kept = gcTombstones(tombstones, 3000);
    expect(
      reconcileWithTombstones(kept, [
        cs(REPLICA_B, [upsert("r", { v: 1 }, 3005, 1)]),
      ]).live,
    ).toEqual([]);
    // Too-aggressive horizon (above the tombstone) COLLECTS it → the same stale upsert resurrects "r".
    // This is why the horizon must exceed the slowest replica's un-synced-edit lag, never "now".
    const collected = gcTombstones(tombstones, 4000);
    expect(collected).toEqual([]);
    const resurrected = reconcileWithTombstones(collected, [
      cs(REPLICA_B, [upsert("r", { v: 1 }, 3005, 1)]),
    ]);
    expect(liveByPk(resurrected.live, "r")?.values).toEqual({ v: 1 });
  });
});
