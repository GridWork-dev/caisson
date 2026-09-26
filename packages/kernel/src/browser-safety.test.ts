// The browser-safety contract for the `.` barrel — the entire point of the `./node` split. Nothing
// reachable from `src/index.ts` may import a node builtin, because a bundler resolves the whole module
// graph behind the "@caisson-sh/kernel" specifier even when the importer only wanted one pure symbol.
//
// WHY THIS IS A STATIC SOURCE WALK AND NOT A BUILD: a bundler does not fail on a node builtin, it
// SUBSTITUTES one. Reintroducing `import { createHash } from "node:crypto"` into `errors.ts` and
// running `next build` in apps/site exits 0 with no warning — turbopack swaps in crypto-browserify and
// the client chunk silently grows by ~428KB of polyfill. "The site build would catch it" is false. The
// taint has to be caught in the source graph, before a bundler papers over it.
//
// The walk itself is the shared `@caisson-sh/testing/module-graph` implementation (this file's local
// copy was its predecessor); it additionally reports `unresolved` edges, so a skipped edge can
// never read as a clean one.
//
// Only ~2 of the 14 modules on the `.` barrel are reachable from apps/site's client graph today, so a
// node builtin added to money.ts / event-sink.ts / config.ts / versioning.ts / credit-conversion.ts /
// observability.ts / scrub-deep.ts / secret-scrub.ts / read-only.ts / fetch.ts / canonical.ts is not
// even resolved by a bundler right now. It would land the day a consumer imports that symbol.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { nodeBuiltinTaint } from "@caisson-sh/testing/module-graph";

const srcDir = import.meta.dir;
const WORKSPACE_ROOT = join(srcDir, "../../..");
const barrelEntry = join(srcDir, "index.ts");
const nodeEntry = join(srcDir, "node.ts");
/** The shared walker reports workspace-root-relative paths. */
const KERNEL_SRC = "packages/kernel/src";

function formatOffender(o: { file: string; spec: string }): string {
  return `${o.file} imports "${o.spec}" — move it behind @caisson-sh/kernel/node`;
}

describe("the `.` barrel is browser-safe", () => {
  test("no module reachable from src/index.ts imports a node builtin (transitive)", () => {
    const walk = nodeBuiltinTaint(barrelEntry, {
      workspaceRoot: WORKSPACE_ROOT,
    });
    // Guard the guard: a walker that reached nothing would make the assertion below vacuous, and
    // an unresolved edge is indistinguishable from a clean one unless it is asserted away.
    expect(walk.files.length).toBeGreaterThan(5);
    expect(walk.unresolved).toEqual([]);
    expect(walk.offenders.map(formatOffender)).toEqual([]);
  });

  test("the walk follows re-exports past depth 1 AND reports real builtins (positive control)", () => {
    // node.ts -> index.ts -> errors.ts proves the walk is transitive, not one level deep.
    const walk = nodeBuiltinTaint(nodeEntry, { workspaceRoot: WORKSPACE_ROOT });
    expect(walk.files).toContain(`${KERNEL_SRC}/errors.ts`);

    // The node-only modules the split exists to keep off the `.` barrel. If this list ever empties, the
    // walker has stopped seeing `node:` specifiers and the test above is silently passing on nothing.
    const tainted = [...new Set(walk.offenders.map((o) => o.file))].sort();
    expect(tainted).toEqual([
      `${KERNEL_SRC}/audit-chain.ts`,
      `${KERNEL_SRC}/crypto.ts`,
      `${KERNEL_SRC}/migration-assembly.ts`,
      `${KERNEL_SRC}/origin-gate.ts`,
      `${KERNEL_SRC}/revision.ts`,
      `${KERNEL_SRC}/ssrf.ts`,
    ]);
  });

  test("a type-only re-export is not followed (migration-assembly's types stay on `.`)", () => {
    // index.ts re-exports migration-assembly's TYPES; following that edge would report a false
    // positive, and NOT following it is what makes the erasure claim in index.ts checkable.
    expect(
      nodeBuiltinTaint(barrelEntry, { workspaceRoot: WORKSPACE_ROOT }).files,
    ).not.toContain(`${KERNEL_SRC}/migration-assembly.ts`);
    // …and the edge it declines to follow really is there, so the assertion above is not vacuous.
    expect(readFileSync(barrelEntry, "utf8")).toMatch(
      /export type \{[^}]*\}\s*from\s*"\.\/migration-assembly\.ts"/,
    );
  });
});

describe("`@caisson-sh/kernel/node` is a superset of `.`", () => {
  test("every runtime name exported by `.` is also exported by `/node`", async () => {
    const [barrel, node] = await Promise.all([
      import("./index.ts"),
      import("./node.ts"),
    ]);
    const missing = Object.keys(barrel).filter(
      (name) => !Object.hasOwn(node, name),
    );
    expect(missing).toEqual([]);
    // …and strictly more: the node-only half is the reason the entry exists.
    expect(Object.keys(node).length).toBeGreaterThan(
      Object.keys(barrel).length,
    );
  });
});
