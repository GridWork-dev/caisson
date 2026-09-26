// The browser-safety contract for `./browser` (ADR-0396) — proven by a STATIC SOURCE-GRAPH WALK,
// never by a build: a bundler does not fail on a node builtin, it SUBSTITUTES one (turbopack swaps
// in crypto-browserify and the client chunk silently grows ~428KB, exit 0). The shared walker
// resolves relative specifiers AND workspace @caisson-sh/* specifiers through each package's exports
// map, so the zero-offender claim covers the whole graph, kernel included.
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { nodeBuiltinTaint } from "@caisson-sh/testing/module-graph";

const WORKSPACE_ROOT = join(import.meta.dir, "../../..");
const BROWSER_ENTRY = join(import.meta.dir, "browser.ts");
const BARREL_ENTRY = join(import.meta.dir, "index.ts");

describe("`./browser` is browser-safe", () => {
  const walk = nodeBuiltinTaint(BROWSER_ENTRY, {
    workspaceRoot: WORKSPACE_ROOT,
  });

  test("no module reachable from src/browser.ts imports a node builtin (transitive)", () => {
    expect(walk.offenders).toEqual([]);
    expect(walk.unresolved).toEqual([]);
  });

  test("guard the guard: the walk really resolved a graph, including across packages", () => {
    expect(walk.files.length).toBeGreaterThan(5);
    expect(walk.files.some((f) => f.includes("packages/kernel/src/"))).toBe(
      true,
    );
  });

  test("positive control: the `.` barrel DOES report the irreducibly node-only modules", () => {
    const barrel = nodeBuiltinTaint(BARREL_ENTRY, {
      workspaceRoot: WORKSPACE_ROOT,
    });
    // endsWith, not exact paths — offender files are workspace-root-relative.
    expect(
      barrel.offenders.some((o) =>
        o.file.endsWith("evidence/oscal-export-xml.ts"),
      ),
    ).toBe(true);
    expect(
      barrel.offenders.some((o) =>
        o.file.endsWith("vendor/nist-catalog-controls.ts"),
      ),
    ).toBe(true);
  });
});

describe("`./browser` is a subset of `.`", () => {
  test("every runtime name exported by ./browser is also exported by the barrel", async () => {
    const [browser, barrel] = await Promise.all([
      import("./browser.ts"),
      import("./index.ts"),
    ]);
    const missing = Object.keys(browser).filter(
      (name) => !Object.hasOwn(barrel, name),
    );
    expect(missing).toEqual([]);
    // …and strictly fewer: the node-only half is the reason the barrel still exists.
    expect(Object.keys(browser).length).toBeLessThan(
      Object.keys(barrel).length,
    );
  });
});
