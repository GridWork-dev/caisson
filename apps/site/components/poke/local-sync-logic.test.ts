// Golden parity: the mirror in local-sync-logic.ts must be byte-identical to the REAL
// @caisson/local-sync reconciliation primitives (reconcile.ts, tombstone.ts, clock.ts — imported
// here by relative path since @caisson/local-sync is not a runtime dependency of @caisson/site; only
// the mirror ships to the browser) and to the shipped __golden__ fixtures. If the mirror ever drifts
// from the package, this fails — the poke can never show a merge the real reconcile would not compute.
import { describe, expect, test } from "bun:test";
import { TenancyError } from "@caisson/kernel";
import { reconcileReplicas as pkgReconcileReplicas } from "../../../../packages/local-sync/src/reconcile.ts";
import { reconcileWithTombstones as pkgReconcileWithTombstones } from "../../../../packages/local-sync/src/tombstone.ts";
import {
  compareStamps as pkgCompareStamps,
  stampFromEntry as pkgStampFromEntry,
} from "../../../../packages/local-sync/src/clock.ts";
import type {
  Changeset as PkgChangeset,
  ChangesetEntry as PkgChangesetEntry,
} from "../../../../packages/local-sync/src/port.ts";
import goldenLww from "../../../../packages/local-sync/src/__golden__/lww-resolve.json";
import goldenTombstone from "../../../../packages/local-sync/src/__golden__/tombstone-resolve.json";

import {
  A_QUEUE,
  B_QUEUE,
  B_STALE_ENTRY,
  compareStamps,
  converge,
  initialPokeState,
  REPLICA_A,
  REPLICA_B,
  reconcileReplicas,
  reconcileWithTombstones,
  stampFromEntry,
  TENANT_ID,
  TenantPartitionError,
  titleOf,
  verdictFor,
  type Changeset,
  type ChangesetEntry,
} from "./local-sync-logic.ts";

// The exact two-replica scenario packages/local-sync/src/reconcile.test.ts pins as its LWW golden.
const REPLICA_UUID_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const REPLICA_UUID_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const LWW_A: Changeset = {
  tenantId: "tenant-a",
  replicaId: REPLICA_UUID_A,
  until: 3,
  entries: [
    {
      table: "docs",
      pk: "d1",
      op: "upsert",
      values: { n: 1, title: "d1-A" },
      updatedAt: 2000,
      seq: 1,
    },
    {
      table: "docs",
      pk: "d2",
      op: "upsert",
      values: { n: 2, title: "d2-A" },
      updatedAt: 2001,
      seq: 2,
    },
    {
      table: "docs",
      pk: "d4",
      op: "upsert",
      values: { n: 4, title: "d4-A" },
      updatedAt: 2005,
      seq: 3,
    },
  ],
};
const LWW_B: Changeset = {
  tenantId: "tenant-a",
  replicaId: REPLICA_UUID_B,
  until: 3,
  entries: [
    {
      table: "docs",
      pk: "d1",
      op: "upsert",
      values: { n: 11, title: "d1-B" },
      updatedAt: 2010,
      seq: 1,
    },
    {
      table: "docs",
      pk: "d3",
      op: "upsert",
      values: { n: 3, title: "d3-B" },
      updatedAt: 2011,
      seq: 2,
    },
    {
      table: "docs",
      pk: "d4",
      op: "upsert",
      values: { n: 44, title: "d4-B" },
      updatedAt: 2005,
      seq: 3,
    },
  ],
};

function toPkg(cs: Changeset): PkgChangeset {
  return cs as unknown as PkgChangeset;
}
function toPkgEntry(entry: ChangesetEntry): PkgChangesetEntry {
  return entry as unknown as PkgChangesetEntry;
}

describe("clock parity", () => {
  test("stampFromEntry + compareStamps match the package", () => {
    const entry = A_QUEUE[0] as ChangesetEntry;
    expect(stampFromEntry(entry, REPLICA_A)).toEqual(
      pkgStampFromEntry(toPkgEntry(entry), REPLICA_A),
    );
    const stamps = A_QUEUE.map((e) => stampFromEntry(e, REPLICA_A));
    const pkgStamps = A_QUEUE.map((e) =>
      pkgStampFromEntry(toPkgEntry(e), REPLICA_A),
    );
    for (let i = 0; i < stamps.length; i++) {
      for (let j = 0; j < stamps.length; j++) {
        expect(compareStamps(stamps[i]!, stamps[j]!)).toBe(
          pkgCompareStamps(pkgStamps[i]!, pkgStamps[j]!),
        );
      }
    }
  });
});

describe("reconcileReplicas golden parity (lww-resolve)", () => {
  test("mirror matches the package on the shipped LWW golden", () => {
    const mine = reconcileReplicas([LWW_A, LWW_B]);
    const pkg = pkgReconcileReplicas([toPkg(LWW_A), toPkg(LWW_B)]);
    expect(mine).toEqual(pkg as unknown as typeof mine);
    expect(mine).toEqual(goldenLww);
  });

  test("mirror is order-independent, matching the package", () => {
    expect(reconcileReplicas([LWW_A, LWW_B])).toEqual(
      reconcileReplicas([LWW_B, LWW_A]),
    );
  });
});

describe("reconcileWithTombstones golden parity (tombstone-resolve)", () => {
  // Round-1 poke state: both replicas' full offline queues applied. This is the exact TOMB_A/TOMB_B
  // scenario reconcile.test.ts pins, just re-keyed to the poke's own replica ids.
  const csA = {
    tenantId: TENANT_ID,
    replicaId: REPLICA_A,
    until: 3,
    entries: A_QUEUE,
  };
  const csB = {
    tenantId: TENANT_ID,
    replicaId: REPLICA_B,
    until: 2,
    entries: B_QUEUE,
  };

  test("mirror's live set matches the shipped tombstone golden", () => {
    const mine = reconcileWithTombstones([], [csA, csB]);
    expect(mine.live).toEqual(goldenTombstone);
  });

  test("mirror matches the real package byte-for-byte on the same inputs", () => {
    const mine = reconcileWithTombstones([], [csA, csB]);
    const pkg = pkgReconcileWithTombstones([], [toPkg(csA), toPkg(csB)]);
    expect(mine.live).toEqual(pkg.live as unknown as typeof mine.live);
    expect(mine.tombstones).toEqual(
      pkg.tombstones as unknown as typeof mine.tombstones,
    );
  });

  test("e1 is excluded from live (tombstoned) and carries the deleting stamp", () => {
    const { live, tombstones } = reconcileWithTombstones([], [csA, csB]);
    expect(live.find((r) => r.pk === "e1")).toBeUndefined();
    const e1 = tombstones.find((t) => t.pk === "e1");
    expect(e1?.stamp).toEqual({ physical: 3010, node: REPLICA_A, counter: 3 });
  });

  test("cross-tenant changesets fail closed, matching the package's TenancyError", () => {
    const foreign: Changeset = {
      tenantId: "some-other-tenant",
      replicaId: REPLICA_B,
      until: 1,
      entries: [B_QUEUE[0] as ChangesetEntry],
    };
    expect(() => reconcileWithTombstones([], [csA, foreign])).toThrow(
      TenantPartitionError,
    );
    expect(() =>
      pkgReconcileWithTombstones([], [toPkg(csA), toPkg(foreign)]),
    ).toThrow(TenancyError);
  });
});

describe("no resurrection across sync rounds (the tombstone's load-bearing property)", () => {
  // Straggler round: only Replica B's clock-behind edit arrives, in a NEW changeset (a real capture()
  // would only include entries past the receiver's watermark).
  const csB2: Changeset = {
    tenantId: TENANT_ID,
    replicaId: REPLICA_B,
    until: 3,
    entries: [B_STALE_ENTRY],
  };

  test("persisting the tombstone suppresses the stale straggler, matching the package", () => {
    const csA = {
      tenantId: TENANT_ID,
      replicaId: REPLICA_A,
      until: 3,
      entries: A_QUEUE,
    };
    const csB = {
      tenantId: TENANT_ID,
      replicaId: REPLICA_B,
      until: 2,
      entries: B_QUEUE,
    };
    const round1 = reconcileWithTombstones([], [csA, csB]);

    const mine = reconcileWithTombstones(round1.tombstones, [csB2]);
    expect(mine.live.find((r) => r.pk === "e1")).toBeUndefined();

    const pkgRound1 = pkgReconcileWithTombstones([], [toPkg(csA), toPkg(csB)]);
    const pkgRound2 = pkgReconcileWithTombstones(pkgRound1.tombstones, [
      toPkg(csB2),
    ]);
    expect(pkgRound2.live.find((r) => r.pk === "e1")).toBeUndefined();
    expect(mine.live).toEqual(pkgRound2.live as unknown as typeof mine.live);
  });

  test("control: WITHOUT the persisted tombstone the same straggler resurrects e1, matching the package", () => {
    const mine = reconcileWithTombstones([], [csB2]);
    expect(mine.live.find((r) => r.pk === "e1")?.values.title).toBe(
      "e1-B-stale",
    );

    const pkg = pkgReconcileWithTombstones([], [toPkg(csB2)]);
    expect(
      (pkg.live.find((r) => r.pk === "e1")?.values as { title?: unknown })
        ?.title,
    ).toBe("e1-B-stale");
  });
});

describe("the poke model", () => {
  test("initial state is the neutral verdict", () => {
    const result = converge(initialPokeState);
    expect(verdictFor(initialPokeState, result).state).toBe("neutral");
  });

  test("full round 1 (both replicas' queues applied) converges ok, e1 tombstoned", () => {
    const state = { ...initialPokeState, appliedA: 3, appliedB: 2 };
    const result = converge(state);
    expect(result.orderIndependent).toBe(true);
    expect(result.round1.live).toEqual(goldenTombstone);
    expect(verdictFor(state, result).state).toBe("ok");
  });

  test("delivering the straggler with persistence on stays converged ok", () => {
    const state = {
      ...initialPokeState,
      appliedA: 3,
      appliedB: 2,
      staleDelivered: true,
      persistTombstones: true,
    };
    const result = converge(state);
    expect(result.round2?.live.find((r) => r.pk === "e1")).toBeUndefined();
    expect(verdictFor(state, result).state).toBe("ok");
  });

  test("the persistence toggle flips the verdict to fail: e1 resurrects", () => {
    const state = {
      ...initialPokeState,
      appliedA: 3,
      appliedB: 2,
      staleDelivered: true,
      persistTombstones: false,
    };
    const result = converge(state);
    const e1 = result.round2?.live.find((r) => r.pk === "e1");
    expect(e1 && titleOf(e1)).toBe("e1-B-stale");
    const verdict = verdictFor(state, result);
    expect(verdict.state).toBe("fail");
    expect(verdict.text).toContain("Resurrection");
  });

  test("titleOf reads the sample title field", () => {
    const row = { table: "docs", pk: "e2", values: { title: "e2-B" } };
    expect(titleOf(row)).toBe("e2-B");
    expect(titleOf({ table: "docs", pk: "x", values: {} })).toBe("(no title)");
  });
});
