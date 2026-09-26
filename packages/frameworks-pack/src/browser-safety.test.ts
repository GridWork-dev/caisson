// The browser-safety contract for `./browser` (ADR-0396). Same walk as oscal-spine's, with the
// load-bearing extra: this package's `.` barrel reaches node builtins ONLY through the bare
// specifier `@caisson-sh/oscal-spine` — so the positive control here is simultaneously the proof
// that the walker crosses workspace package boundaries. Without it, the zero-offender result on
// src/browser.ts would be exactly the failure mode it exists to prevent: a walker blind to
// everything behind an @caisson-sh/* specifier, passing green on nothing.
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

  test("guard the guard: the walk crossed into oscal-spine, not just this package", () => {
    // The relative-only subgraph alone is >5 files, so files.length cannot guard the
    // cross-package claim — this assertion is the one that fails if @caisson-sh/* resolution
    // silently goes blind.
    expect(
      walk.files.some((f) => f.includes("packages/oscal-spine/src/")),
    ).toBe(true);
    expect(walk.files.some((f) => f.includes("packages/kernel/src/"))).toBe(
      true,
    );
  });

  test("positive control: the `.` barrel reports node builtins reached ONLY via @caisson-sh/oscal-spine", () => {
    const barrel = nodeBuiltinTaint(BARREL_ENTRY, {
      workspaceRoot: WORKSPACE_ROOT,
    });
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
    expect(Object.keys(browser).length).toBeLessThan(
      Object.keys(barrel).length,
    );
  });
});
