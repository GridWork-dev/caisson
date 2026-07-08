// Registry-index bundler tests (delivery-path fix G3). Proves the build step copies the REAL
// `registry/index.json` byte-for-byte into the package root, and fails loudly (never silently
// no-ops) when the source is missing.
import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SOURCE_INDEX, bundleRegistryIndex } from "./bundle-registry-index.ts";

describe("bundleRegistryIndex (G3)", () => {
  test("copies the real registry/index.json byte-for-byte into a throwaway destination", () => {
    const dir = mkdtempSync(join(tmpdir(), "caisson-regindex-bundle-"));
    try {
      const dest = join(dir, "registry-index.json");
      bundleRegistryIndex(SOURCE_INDEX, dest);
      expect(existsSync(dest)).toBe(true);
      expect(readFileSync(dest, "utf8")).toBe(
        readFileSync(SOURCE_INDEX, "utf8"),
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a missing source throws (never a silent no-op)", () => {
    const dir = mkdtempSync(join(tmpdir(), "caisson-regindex-bundle-missing-"));
    try {
      expect(() =>
        bundleRegistryIndex(
          join(dir, "does-not-exist.json"),
          join(dir, "out.json"),
        ),
      ).toThrow(/registry index not found/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
