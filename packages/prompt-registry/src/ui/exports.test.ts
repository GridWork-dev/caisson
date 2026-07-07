// Exports-map + React-isolation contract (ADR-0250 G2c; the PR#131 "missing exports entry breaks
// consumers" lesson). Proves the `./ui` subpath is wired AND that the package ROOT never pulls
// React — importing `@caisson/<pkg>` must stay framework-free (the root barrel never re-exports the
// `./ui` tree, and no root-reachable source imports react / @caisson/ui).
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import pkg from "../../package.json";

const manifest = pkg as {
  exports?: Record<string, unknown>;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};
const pkgRoot = join(import.meta.dir, "..", "..");

describe("package exports + React isolation (ADR-0250)", () => {
  test("exports map wires ./ui to the surface entry", () => {
    expect(manifest.exports?.["./ui"]).toBe("./src/ui/index.ts");
    expect(manifest.exports?.["."]).toBeDefined();
  });

  test("the ./ui surface resolves and exports a component", async () => {
    const surface = await import("./index.ts");
    expect(Object.keys(surface).length).toBeGreaterThan(0);
    for (const value of Object.values(surface)) {
      expect(value).toBeDefined();
    }
  });

  test("react is a peer (never a hard dep) so the root stays optional-React", () => {
    expect(manifest.dependencies?.["react"]).toBeUndefined();
    expect(manifest.peerDependencies?.["react"]).toBeDefined();
  });

  test("the root barrel imports no React and never re-exports the ui tree", () => {
    const root = readFileSync(join(pkgRoot, "src", "index.ts"), "utf8");
    expect(root).not.toMatch(/from\s+["']react["']/);
    expect(root).not.toMatch(/@caisson\/ui/);
    expect(root).not.toMatch(/["']\.\/ui/);
  });
});
