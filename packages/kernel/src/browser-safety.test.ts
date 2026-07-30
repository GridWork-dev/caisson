// The browser-safety contract for the `.` barrel — the entire point of the `./node` split. Nothing
// reachable from `src/index.ts` may import a node builtin, because a bundler resolves the whole module
// graph behind the "@caisson/kernel" specifier even when the importer only wanted one pure symbol.
//
// WHY THIS IS A STATIC SOURCE WALK AND NOT A BUILD: a bundler does not fail on a node builtin, it
// SUBSTITUTES one. Reintroducing `import { createHash } from "node:crypto"` into `errors.ts` and
// running `next build` in apps/site exits 0 with no warning — turbopack swaps in crypto-browserify and
// the client chunk silently grows by ~428KB of polyfill. "The site build would catch it" is false. The
// taint has to be caught in the source graph, before a bundler papers over it.
//
// Only ~2 of the 14 modules on the `.` barrel are reachable from apps/site's client graph today, so a
// node builtin added to money.ts / event-sink.ts / config.ts / versioning.ts / credit-conversion.ts /
// observability.ts / scrub-deep.ts / secret-scrub.ts / read-only.ts / fetch.ts / canonical.ts is not
// even resolved by a bundler right now. It would land the day a consumer imports that symbol.
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const srcDir = import.meta.dir;
const barrelEntry = join(srcDir, "index.ts");
const nodeEntry = join(srcDir, "node.ts");

/**
 * Every `import`/`export … from "<spec>"` statement, with the type-only modifier captured. An
 * `import type` / `export type` statement is erased at emit and so puts nothing in a bundle graph —
 * that is exactly how `migration-assembly.ts`'s TYPES stay on the `.` barrel while its
 * `node:crypto`-importing implementation does not. `[^;]*?` spans newlines, so a multi-line specifier
 * list matches; the `^[ \t]*` anchor means a `//` or ` *` comment line can never match.
 */
const FROM_STATEMENT =
  /^[ \t]*(?:import|export)[ \t]+(type[ \t]+)?[^;]*?from[ \t]*["']([^"']+)["']/gm;

/** A side-effect import (`import "./x.ts";`) — no clause, but it still pulls the module into a bundle. */
const BARE_IMPORT = /^[ \t]*import[ \t]*["']([^"']+)["']/gm;

interface Ref {
  readonly spec: string;
  readonly typeOnly: boolean;
}

interface Offender {
  /** Path relative to `src/`, so a failure names the file a reader can open. */
  readonly file: string;
  readonly spec: string;
}

function refsOf(source: string): Ref[] {
  const refs: Ref[] = [];
  for (const m of source.matchAll(FROM_STATEMENT)) {
    refs.push({ spec: m[2]!, typeOnly: m[1] !== undefined });
  }
  for (const m of source.matchAll(BARE_IMPORT)) {
    refs.push({ spec: m[1]!, typeOnly: false });
  }
  return refs;
}

/** Resolve a relative specifier to a real source file, or null when it does not resolve in-tree. */
function resolveRel(fromDir: string, spec: string): string | null {
  const base = join(fromDir, spec);
  const candidates = /\.tsx?$/.test(base)
    ? [base]
    : [
        `${base}.ts`,
        `${base}.tsx`,
        join(base, "index.ts"),
        join(base, "index.tsx"),
      ];
  return candidates.find((c) => existsSync(c)) ?? null;
}

/**
 * Walk the EMITTED (value) import graph from `entry`, collecting every `node:` specifier reached.
 * Type-only edges are not followed: they are erased, so they cannot taint a bundle.
 */
function nodeBuiltinTaint(entry: string): {
  files: string[];
  offenders: Offender[];
} {
  const seen = new Set<string>();
  const offenders: Offender[] = [];
  const stack = [entry];
  while (stack.length > 0) {
    const file = stack.pop();
    if (file === undefined || seen.has(file)) continue;
    seen.add(file);
    for (const ref of refsOf(readFileSync(file, "utf8"))) {
      if (ref.typeOnly) continue;
      if (ref.spec.startsWith("node:")) {
        offenders.push({ file: relative(srcDir, file), spec: ref.spec });
        continue;
      }
      if (ref.spec.startsWith(".")) {
        const resolved = resolveRel(dirname(file), ref.spec);
        if (resolved !== null) stack.push(resolved);
      }
    }
  }
  return { files: [...seen].map((f) => relative(srcDir, f)), offenders };
}

function formatOffender(o: Offender): string {
  return `${o.file} imports "${o.spec}" — move it behind @caisson/kernel/node`;
}

describe("the `.` barrel is browser-safe", () => {
  test("no module reachable from src/index.ts imports a node builtin (transitive)", () => {
    const { files, offenders } = nodeBuiltinTaint(barrelEntry);
    // Guard the guard: a walker that reached nothing would make the assertion below vacuous.
    expect(files.length).toBeGreaterThan(5);
    expect(offenders.map(formatOffender)).toEqual([]);
  });

  test("the walk follows re-exports past depth 1 AND reports real builtins (positive control)", () => {
    // node.ts -> index.ts -> errors.ts proves the walk is transitive, not one level deep.
    const { files, offenders } = nodeBuiltinTaint(nodeEntry);
    expect(files).toContain("errors.ts");

    // The four modules the split exists to keep off the `.` barrel. If this list ever empties, the
    // walker has stopped seeing `node:` specifiers and the test above is silently passing on nothing.
    const tainted = [...new Set(offenders.map((o) => o.file))].sort();
    expect(tainted).toEqual([
      "audit-chain.ts",
      "crypto.ts",
      "migration-assembly.ts",
      "ssrf.ts",
    ]);
  });

  test("a type-only re-export is not followed (migration-assembly's types stay on `.`)", () => {
    // index.ts re-exports migration-assembly's TYPES; following that edge would report a false
    // positive, and NOT following it is what makes the erasure claim in index.ts checkable.
    expect(nodeBuiltinTaint(barrelEntry).files).not.toContain(
      "migration-assembly.ts",
    );
    // …and the edge it declines to follow really is there, so the assertion above is not vacuous.
    expect(readFileSync(barrelEntry, "utf8")).toMatch(
      /export type \{[^}]*\}\s*from\s*"\.\/migration-assembly\.ts"/,
    );
  });
});

describe("`@caisson/kernel/node` is a superset of `.`", () => {
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
