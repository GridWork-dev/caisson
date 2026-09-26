// The local-sync poke's checkable claims, now that it drives the REAL @caisson-sh/local-sync and the
// hand-ported mirror (local-sync-logic.ts) is deleted:
//
//   1. The poke's client graph is browser-safe — proven by a STATIC SOURCE-GRAPH WALK, never by a
//      build (a bundler does not fail on a node builtin, it SUBSTITUTES a ~428KB polyfill, exit 0).
//   2. The sample scenario converges to the package's own SHIPPED golden, so the demo shows a merge
//      the real reconcile computes, not a plausible-looking one.
//   3. Order independence and the no-resurrection property are MEASURED by re-running the real
//      merge, never asserted as copy — the persistence toggle really flips the verdict.
//   4. The poke's changesets are real changesets: the package's tenant-partition guard fires on
//      them.
//
// The walk follows the `bun` (src) condition of each package's exports map; Next resolves
// `exports.default -> dist`. tscn is a per-file emit (no bundling, no re-export rewriting), so the
// dist module graph is the src module graph — CI builds packages before the site consumes them.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { nodeBuiltinTaint } from "@caisson-sh/testing/module-graph";
import { TenancyError } from "@caisson-sh/kernel";
import {
  reconcileWithTombstones,
  type Changeset,
  type ReconciledRow,
} from "@caisson-sh/local-sync";

import {
  A_QUEUE,
  B_QUEUE,
  REPLICA_A,
  REPLICA_B,
  TENANT_ID,
  converge,
  initialPokeState,
  titleOf,
  verdictFor,
} from "./local-sync-poke";

const WORKSPACE_ROOT = join(import.meta.dir, "../../../..");
const POKE_ENTRY = join(import.meta.dir, "local-sync-poke.tsx");

const GOLDEN_TOMBSTONE = JSON.parse(
  readFileSync(
    join(
      WORKSPACE_ROOT,
      "packages/local-sync/src/__golden__/tombstone-resolve.json",
    ),
    "utf8",
  ),
) as ReconciledRow[];

/** Both replicas' full offline queues applied — the poke's round-1 terminal state. */
const FULL_ROUND_1 = {
  ...initialPokeState,
  appliedA: A_QUEUE.length,
  appliedB: B_QUEUE.length,
};

describe("the poke's client graph is browser-safe (static source walk, NOT a build)", () => {
  const walk = nodeBuiltinTaint(POKE_ENTRY, { workspaceRoot: WORKSPACE_ROOT });

  test("no module reachable from the client entry imports a node builtin (transitive)", () => {
    expect(walk.offenders).toEqual([]);
  });

  test("no edge was silently skipped — every declined edge would land in `unresolved`", () => {
    expect(walk.unresolved).toEqual([]);
  });

  test("the walk really crossed into the package, past the first hop", () => {
    // Guard the guard: files.length alone proves nothing. These are reachable ONLY through
    // @caisson-sh/local-sync's own imports — the barrel (first hop), the merge behind it (second
    // hop), and one file behind the kernel seam (a second cross-package hop).
    expect(walk.files).toContain("packages/local-sync/src/index.ts");
    expect(walk.files).toContain("packages/local-sync/src/tombstone.ts");
    expect(walk.files).toContain("packages/kernel/src/errors.ts");
  });

  test("the whole barrel rides, changeset capture included — bun:sqlite is type-only", () => {
    expect(walk.files).toContain("packages/local-sync/src/changeset.ts");
    expect(walk.external).not.toContain("bun:sqlite");
  });

  test("the unwalked external frontier is exactly the known browser-safe set", () => {
    // A third entry here means a new non-workspace dependency joined the client graph — a review
    // event, not a silent hole in the proof.
    expect(walk.external).toEqual(["react", "zod"]);
  });

  test("positive control: the same walker reports real builtins on a tainted entry", () => {
    const tainted = nodeBuiltinTaint(
      join(WORKSPACE_ROOT, "packages/kernel/src/node.ts"),
      { workspaceRoot: WORKSPACE_ROOT },
    );
    expect(tainted.offenders.length).toBeGreaterThan(0);
  });

  test("the poke imports the package, never a re-ported copy", () => {
    const src = readFileSync(POKE_ENTRY, "utf8");
    expect(src).toMatch(/ from "@caisson-sh\/local-sync";$/m);
    expect(src).not.toMatch(/from "\.\/local-sync-logic"/);
  });
});

describe("the sample scenario converges to the package's own shipped golden", () => {
  test("round 1 live set equals __golden__/tombstone-resolve.json", () => {
    const { round1 } = converge(FULL_ROUND_1);
    expect(round1.live).toEqual(GOLDEN_TOMBSTONE);
  });

  test("e1 is excluded from live and carries Replica A's deleting stamp", () => {
    const { round1 } = converge(FULL_ROUND_1);
    expect(round1.live.find((r) => r.pk === "e1")).toBeUndefined();
    expect(round1.tombstones.find((t) => t.pk === "e1")?.stamp).toEqual({
      physical: 3010,
      node: REPLICA_A,
      counter: 3,
    });
  });

  test("order independence is measured, not asserted", () => {
    expect(converge(FULL_ROUND_1).orderIndependent).toBe(true);
  });
});

describe("the persistence toggle really flips the outcome", () => {
  test("with the tombstone carried forward, the stale straggler loses", () => {
    const state = { ...FULL_ROUND_1, staleDelivered: true };
    const result = converge(state);
    expect(result.round2?.live.find((r) => r.pk === "e1")).toBeUndefined();
    expect(verdictFor(state, result).state).toBe("ok");
  });

  test("without it, the SAME straggler resurrects e1 and the verdict fails", () => {
    const state = {
      ...FULL_ROUND_1,
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

  test("the untouched initial state reads neutral, not a fabricated success", () => {
    expect(verdictFor(initialPokeState, converge(initialPokeState)).state).toBe(
      "neutral",
    );
  });
});

describe("the poke's changesets are real changesets", () => {
  test("the package's tenant-partition guard fires on them (fail-closed, TenancyError)", () => {
    const mine: Changeset = {
      tenantId: TENANT_ID,
      replicaId: REPLICA_A,
      until: A_QUEUE.length,
      entries: A_QUEUE,
    };
    const foreign: Changeset = {
      tenantId: "some-other-tenant",
      replicaId: REPLICA_B,
      until: B_QUEUE.length,
      entries: B_QUEUE,
    };
    expect(() => reconcileWithTombstones([], [mine, foreign])).toThrow(
      TenancyError,
    );
  });

  test("titleOf reads the sample title field and never invents one", () => {
    expect(
      titleOf({ table: "docs", pk: "e2", values: { title: "e2-B" } }),
    ).toBe("e2-B");
    expect(titleOf({ table: "docs", pk: "x", values: {} })).toBe("(no title)");
  });
});
