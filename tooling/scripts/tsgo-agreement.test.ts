// Unit tests for the declaration-drift check's shared package-discovery and byte-diff primitives.
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compareDtsTrees, discoverTscPackages } from "./tsgo-agreement";

function withTempDir(fn: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "tsgo-agreement-test-"));
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

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
