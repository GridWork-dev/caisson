// src/sync/reconcile.test.ts — the reconcile CONFLICT goldens (golden-before-logic / ADR-0013).
// The `reconcileReplicas` merge (`reconcile.ts` + the HLC in `clock.ts`) is pinned against the
// `lww-resolve` golden; tombstone semantics (no resurrection / GC in `tombstone.ts` + its own test)
// are pinned against the `tombstone-resolve` golden.
// Asserted with `BLESS` unset — re-bless only via `BLESS=1 bun test` when the semantics legitimately move.
//
// The CONTRACT this golden pins for `reconcileReplicas(changesets) -> ReconciledRow[]`:
//   - PURE + DETERMINISTIC: merges the per-replica changelogs of one tenant (every changeset shares a
//     tenantId; replicas differ only by replicaId) into the converged set of LIVE rows. The local
//     canonical store is the convergence target — after a round-trip BOTH replicas reach this set.
//   - LWW per (table, pk): the winning change is the one with the greatest key `(updatedAt, replicaId)`
//     — greater `updatedAt` wins; an exact `updatedAt` tie is broken by the lexicographically greater
//     `replicaId` (deterministic, since replicaId is a stable per-replica UUID, NOT a forgeable wall
//     clock); a same-(updatedAt, replicaId) pk within one replica is broken by the greater `seq`.
//   - TOMBSTONE: if the winning change is a `delete`, the row is a tombstone and is EXCLUDED from the
//     returned live set — a lower-keyed concurrent `upsert` does NOT resurrect it.
//   - SHAPE: each returned row is `{ table, pk, values }` (the winning upsert's `RowValues`), the set
//     sorted ascending by `table` then `pk` — so two replicas serialize byte-equal.
import { describe, expect, test } from "bun:test";
import { matchGolden } from "@caisson-sh/testing";
import { reconcileReplicas } from "./reconcile.ts";
import type { Changeset } from "./port.ts";

// One tenant, two divergent replicas (file-per-tenant — replicas share the tenantId, ADR-0073). The
// replica ids are fixed so the `(updatedAt, replicaId)` tiebreak is reproducible: "bbbb…" > "aaaa…".
const TENANT = "tenant-a";
const REPLICA_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const REPLICA_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

// ── LWW: concurrent per-row edits across two replicas converge by (updatedAt, replicaId) ───────────
// d1: B (2010) beats A (2000). d2: A-only. d3: B-only. d4: an exact 2005 tie → replicaId tiebreak → B.
const LWW_A: Changeset = {
  tenantId: TENANT,
  replicaId: REPLICA_A,
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
  tenantId: TENANT,
  replicaId: REPLICA_B,
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

// ── Tombstone: a delete with the highest key beats a concurrent edit and is not resurrected ────────
// e1: A upserts (3000) then deletes (3010); B upserts (3005) < the delete → e1 stays deleted (no
// resurrection). e2: B-only survives. e3: A-only survives.
const TOMB_A: Changeset = {
  tenantId: TENANT,
  replicaId: REPLICA_A,
  until: 3,
  entries: [
    {
      table: "docs",
      pk: "e1",
      op: "upsert",
      values: { title: "e1-A" },
      updatedAt: 3000,
      seq: 1,
    },
    {
      table: "docs",
      pk: "e3",
      op: "upsert",
      values: { title: "e3-A" },
      updatedAt: 3001,
      seq: 2,
    },
    {
      table: "docs",
      pk: "e1",
      op: "delete",
      values: null,
      updatedAt: 3010,
      seq: 3,
    },
  ],
};
const TOMB_B: Changeset = {
  tenantId: TENANT,
  replicaId: REPLICA_B,
  until: 2,
  entries: [
    {
      table: "docs",
      pk: "e1",
      op: "upsert",
      values: { title: "e1-B" },
      updatedAt: 3005,
      seq: 1,
    },
    {
      table: "docs",
      pk: "e2",
      op: "upsert",
      values: { title: "e2-B" },
      updatedAt: 3006,
      seq: 2,
    },
  ],
};

describe("reconcileReplicas LWW (golden-before-logic)", () => {
  test("two divergent replicas converge per-field LWW to the committed golden", () => {
    matchGolden(
      import.meta.url,
      "lww-resolve",
      reconcileReplicas([LWW_A, LWW_B]),
    );
  });

  test("convergence is order-independent — both replicas reach the same state", () => {
    expect(reconcileReplicas([LWW_A, LWW_B])).toEqual(
      reconcileReplicas([LWW_B, LWW_A]),
    );
  });
});

describe("reconcileReplicas tombstone (golden-before-logic)", () => {
  test("a delete beats a concurrent edit, no resurrection, matches the committed golden", () => {
    matchGolden(
      import.meta.url,
      "tombstone-resolve",
      reconcileReplicas([TOMB_A, TOMB_B]),
    );
  });

  test("tombstone convergence is order-independent", () => {
    expect(reconcileReplicas([TOMB_A, TOMB_B])).toEqual(
      reconcileReplicas([TOMB_B, TOMB_A]),
    );
  });
});
