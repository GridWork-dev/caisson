// npx-bin publish smoke (ADR-0092/0111). The published `create-caisson` bin (`./dist/cli.js`) must
// (a) carry the node shebang on line 1 and (b) be valid ESM `node` can load. Asserts against the
// BUILT output; guarded by `skipIf` so it never flakes on turbo build/test ordering (the build task
// has no `dependsOn`, so `dist/` may be absent when this runs concurrently) — it executes after any
// `bun run build`/`turbo build` and in the publish path. The dist-not-src / bin→dist publish contract
// is locked unconditionally in tooling/standards-gate/src/publish-config.test.ts.
//
// NOTE: full `node dist/cli.js --help` execution additionally requires the workspace dep graph to
// resolve under pure node ESM, which is blocked today by the repo-wide extensionless relative imports
// in compiled dist (bundler moduleResolution) — the separately-tracked "publishability / ESM-extension"
// fork (P5-deferred). This smoke therefore asserts shebang + `node --check` (load-validity), not a
// full run; the bin WIRING is what publish-readiness owns.
//
// Also asserts at the PACK LAYER: the generation-plan tests read the SOURCE template tree directly
// and would stay green even if the packed tarball silently dropped a runtime asset. The real
// regression only shows up in what `bun pm pack` actually ships, so it is asserted here.
import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url)); // packages/cli/scripts
const PKG_ROOT = join(HERE, "..");
const CLI_DIST = join(HERE, "..", "dist", "cli.js");
const built = existsSync(CLI_DIST);

// Under turbo, PATH is fronted by a bun-node shim dir whose `node` ignores `--check` and EXECUTES
// the script (the CLI then exits 1 on missing args). Resolve the REAL node past any shim — the
// whole point of this smoke is what genuine node does with the published artifact.
function realNode(): string | null {
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    if (dir.includes("bun-node") || dir === "") continue;
    const candidate = join(dir, "node");
    if (existsSync(candidate)) return candidate;
  }
  return null;
}
const nodeBin = realNode();

describe("create-caisson npx bin smoke (ADR-0092/0111)", () => {
  test.skipIf(!built)("dist/cli.js carries the node shebang on line 1", () => {
    const line1 = readFileSync(CLI_DIST, "utf8").split("\n")[0];
    expect(line1).toBe("#!/usr/bin/env node");
  });

  test.skipIf(!built || nodeBin === null)(
    "dist/cli.js is valid ESM that node can load (node --check)",
    () => {
      // Throws (non-zero exit) if node cannot parse the file.
      expect(() =>
        execFileSync(nodeBin as string, ["--check", CLI_DIST], {
          stdio: "pipe",
        }),
      ).not.toThrow();
    },
  );

  test.skipIf(!built)(
    "the packed tarball ships the base template + bundled catalog, and no registry .npmrc",
    () => {
      const output = execFileSync("bun", ["pm", "pack", "--dry-run"], {
        cwd: PKG_ROOT,
        encoding: "utf8",
      });
      const packedPaths = output
        .split("\n")
        .filter((line) => line.startsWith("packed "))
        .map((line) => line.replace(/^packed\s+\S+\s+/, ""));
      expect(packedPaths).toContain("templates/base/package.json");
      expect(packedPaths).toContain("registry-index.json");
      // Modules install from public npm, so no registry-scope npmrc ships in any form.
      expect(packedPaths.some((p) => /(^|\/)\.?npmrc$/.test(p))).toBe(false);
    },
  );
});
