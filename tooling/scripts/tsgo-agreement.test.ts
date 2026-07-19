// Unit tests for the PURE functions only — no live tsc/native-tsc binary spawn anywhere in this
// file (that's runCompiler/runDtsDiffKernel/main, exercised manually via the workflow_dispatch
// weekly lane per tsgo-agreement.ts's own header comment). Filesystem-shaped functions
// (readWorkspaceGlobs, expandWorkspaceDirs, discoverTscPackages, compareDtsTrees) are exercised
// against real temp-dir fixture trees, house style with sot-check.test.ts / vault-parity-check.test.ts.
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  compareDtsTrees,
  diffDiagnostics,
  discoverTscPackages,
  expandWorkspaceDirs,
  parseArgv,
  readWorkspaceGlobs,
} from "./tsgo-agreement";

function withTempDir(fn: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "tsgo-agreement-test-"));
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("parseArgv", () => {
  test("defaults to no filter, no dts-diff-kernel", () => {
    expect(parseArgv([])).toEqual({ packages: null, dtsDiffKernel: false });
  });

  test("--packages a,b,c (space form) parses, trims, and drops empties", () => {
    expect(parseArgv(["--packages", "a, b ,,c"])).toEqual({
      packages: ["a", "b", "c"],
      dtsDiffKernel: false,
    });
  });

  test("--packages=a,b,c (equals form) parses the same shape", () => {
    expect(parseArgv(["--packages=a,b,c"])).toEqual({
      packages: ["a", "b", "c"],
      dtsDiffKernel: false,
    });
  });

  test("--dts-diff-kernel sets the flag independent of --packages", () => {
    expect(parseArgv(["--dts-diff-kernel", "--packages", "a"])).toEqual({
      packages: ["a"],
      dtsDiffKernel: true,
    });
  });

  test("a trailing --packages with no value leaves the filter unset", () => {
    expect(parseArgv(["--packages"])).toEqual({
      packages: null,
      dtsDiffKernel: false,
    });
  });
});

describe("diffDiagnostics", () => {
  test("identical sets yield no diffs", () => {
    expect(diffDiagnostics(["error TS1"], ["error TS1"])).toEqual([]);
  });

  test("a-only lines get a `-` prefix, b-only get a `+` prefix", () => {
    expect(diffDiagnostics(["error TS1"], ["error TS2"])).toEqual([
      "- error TS1",
      "+ error TS2",
    ]);
  });

  test("caps at 5 total diffs", () => {
    const a = Array.from({ length: 4 }, (_, i) => `error TS${i}a`);
    const b = Array.from({ length: 4 }, (_, i) => `error TS${i}b`);
    expect(diffDiagnostics(a, b)).toHaveLength(5);
  });
});

describe("readWorkspaceGlobs", () => {
  test("supports the bare-array workspaces shape", () => {
    withTempDir((dir) => {
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ workspaces: ["packages/*", "registry"] }),
      );
      expect(readWorkspaceGlobs(dir)).toEqual(["packages/*", "registry"]);
    });
  });

  test("supports the { packages: [...] } workspaces shape (this repo's actual shape)", () => {
    withTempDir((dir) => {
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ workspaces: { packages: ["apps/*"] } }),
      );
      expect(readWorkspaceGlobs(dir)).toEqual(["apps/*"]);
    });
  });

  test("no workspaces key yields an empty array", () => {
    withTempDir((dir) => {
      writeFileSync(join(dir, "package.json"), JSON.stringify({}));
      expect(readWorkspaceGlobs(dir)).toEqual([]);
    });
  });
});

describe("expandWorkspaceDirs", () => {
  test("expands a glob pattern to its directory matches only", () => {
    withTempDir((dir) => {
      mkdirSync(join(dir, "packages", "a"), { recursive: true });
      mkdirSync(join(dir, "packages", "b"), { recursive: true });
      writeFileSync(join(dir, "packages", "not-a-dir.txt"), "x");
      expect(expandWorkspaceDirs(["packages/*"], dir)).toEqual([
        "packages/a",
        "packages/b",
      ]);
    });
  });

  test("a literal (non-glob) pattern is included only if it exists", () => {
    withTempDir((dir) => {
      mkdirSync(join(dir, "registry"), { recursive: true });
      expect(expandWorkspaceDirs(["registry", "does-not-exist"], dir)).toEqual([
        "registry",
      ]);
    });
  });
});

describe("discoverTscPackages", () => {
  test("includes only packages with a tsconfig.json AND a tsc-invoking build/check script", () => {
    withTempDir((dir) => {
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ workspaces: ["packages/*"] }),
      );

      // Qualifies: tsconfig.json + a build script that runs tsc.
      mkdirSync(join(dir, "packages", "kernel"), { recursive: true });
      writeFileSync(join(dir, "packages", "kernel", "tsconfig.json"), "{}");
      writeFileSync(
        join(dir, "packages", "kernel", "package.json"),
        JSON.stringify({ scripts: { build: "tsc -p tsconfig.json" } }),
      );

      // Disqualifies: has a tsconfig.json but no tsc in its scripts (e.g. `next build`).
      mkdirSync(join(dir, "packages", "next-app"), { recursive: true });
      writeFileSync(join(dir, "packages", "next-app", "tsconfig.json"), "{}");
      writeFileSync(
        join(dir, "packages", "next-app", "package.json"),
        JSON.stringify({ scripts: { build: "next build" } }),
      );

      // Disqualifies: no tsconfig.json at all.
      mkdirSync(join(dir, "packages", "no-tsconfig"), { recursive: true });
      writeFileSync(
        join(dir, "packages", "no-tsconfig", "package.json"),
        JSON.stringify({ scripts: { build: "tsc" } }),
      );

      const found = discoverTscPackages(dir).map((c) => c.dir);
      expect(found).toEqual(["packages/kernel"]);
    });
  });

  test("a malformed package.json is skipped, not thrown", () => {
    withTempDir((dir) => {
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ workspaces: ["packages/*"] }),
      );
      mkdirSync(join(dir, "packages", "broken"), { recursive: true });
      writeFileSync(join(dir, "packages", "broken", "tsconfig.json"), "{}");
      writeFileSync(
        join(dir, "packages", "broken", "package.json"),
        "{ not valid json",
      );
      expect(discoverTscPackages(dir)).toEqual([]);
    });
  });
});

describe("compareDtsTrees", () => {
  test("classifies identical, differing, and one-side-only files", () => {
    withTempDir((dir6) => {
      withTempDir((dir7) => {
        writeFileSync(join(dir6, "same.d.ts"), "export {};\n");
        writeFileSync(join(dir7, "same.d.ts"), "export {};\n");

        writeFileSync(join(dir6, "changed.d.ts"), "export const a: 1;\n");
        writeFileSync(join(dir7, "changed.d.ts"), "export const a: number;\n");

        writeFileSync(join(dir6, "only6.d.ts"), "export {};\n");
        writeFileSync(join(dir7, "only7.d.ts"), "export {};\n");

        expect(compareDtsTrees(dir6, dir7)).toEqual({
          identical: ["same.d.ts"],
          differing: ["changed.d.ts"],
          onlyIn6: ["only6.d.ts"],
          onlyIn7: ["only7.d.ts"],
        });
      });
    });
  });
});
