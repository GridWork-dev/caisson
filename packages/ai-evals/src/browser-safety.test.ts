// The browser-safety contract for `./browser` — proven by a STATIC SOURCE-GRAPH WALK, never by a
// build: a bundler does not fail on a node builtin, it SUBSTITUTES one (turbopack swaps in
// crypto-browserify and the client chunk silently grows ~428KB, exit 0). The shared walker resolves
// relative specifiers AND workspace @caisson-sh/* specifiers through each package's exports map, and
// reports any edge it could not follow, so a skipped edge can never read as clean.
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

  test("guard the guard: the walk really followed the entry's edges", () => {
    // browser.ts alone would be a vacuous clean walk; these two are reachable ONLY through it.
    expect(walk.files).toContain("packages/ai-evals/src/baseline-compare.ts");
    expect(walk.files).toContain("packages/ai-evals/src/wilson.ts");
    // …and never the node-only transport, nor the harness the type-only re-export names.
    expect(walk.files).not.toContain("packages/ai-evals/src/baseline.ts");
    expect(walk.files).not.toContain("packages/ai-evals/src/define-eval.ts");
  });

  test("the only external the entry pulls is zod (no bun:/node: package sneaking through)", () => {
    // `bun:sqlite`-style specifiers are NOT `node:`-prefixed, so the offender channel cannot catch
    // them — pinning the external frontier exactly is what closes that hole.
    expect(walk.external).toEqual(["zod"]);
  });

  test("positive control: the `.` barrel DOES report the irreducibly node-only transport", () => {
    const barrel = nodeBuiltinTaint(BARREL_ENTRY, {
      workspaceRoot: WORKSPACE_ROOT,
    });
    // endsWith, not exact paths — offender files are workspace-root-relative.
    const baselineOffenders = barrel.offenders.filter((o) =>
      o.file.endsWith("src/baseline.ts"),
    );
    expect(baselineOffenders.map((o) => o.spec).sort()).toEqual([
      "node:fs",
      "node:path",
    ]);
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
