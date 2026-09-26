// Exports-map + React-isolation contract (ADR-0250 G2c; a known class of bug: an exports-map entry a component needs can go missing and break consumers).
// Proves the `./ui` subpath is wired AND that the package ROOT stays
// framework-free: importing `@caisson-sh/<pkg>` must pull no React. The React check is TRANSITIVE — it
// walks every module reachable from the root barrel (excluding the optional `./ui` tree) and asserts
// none imports react / react-dom / @caisson-sh/ui, so a React import hidden a re-export deep can't slip.
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import pkg from "../../package.json";

const manifest = pkg as {
  exports?: Record<string, unknown>;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};
const pkgRoot = join(import.meta.dir, "..", "..");
const rootEntry = join(pkgRoot, "src", "index.ts");

const REL_IMPORT = /from\s+["'](\.[^"']+)["']/g;
const REACT_OR_KIT = /from\s+["']react(-dom)?["']|@caisson-sh\/ui/;

/** Resolve a relative import specifier to a real source file (.ts/.tsx/index), or null if external. */
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

/** Every source file reachable from the root barrel, following relative imports; the ui tree excluded. */
function rootReachable(): string[] {
  const seen = new Set<string>();
  const stack = [rootEntry];
  while (stack.length > 0) {
    const file = stack.pop();
    if (file === undefined || seen.has(file) || file.includes("/src/ui/"))
      continue;
    seen.add(file);
    for (const m of readFileSync(file, "utf8").matchAll(REL_IMPORT)) {
      const resolved = resolveRel(dirname(file), m[1]!);
      if (resolved) stack.push(resolved);
    }
  }
  return [...seen];
}

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

  test("the root barrel never re-exports the ui tree", () => {
    expect(readFileSync(rootEntry, "utf8")).not.toMatch(/["']\.\/ui/);
  });

  test("no module reachable from the package root imports React or the kit (transitive)", () => {
    const files = rootReachable();
    expect(files.length).toBeGreaterThan(0);
    const offenders = files.filter((f) =>
      REACT_OR_KIT.test(readFileSync(f, "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});
