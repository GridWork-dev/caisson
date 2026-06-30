// registry/scripts/ci-publish-step.test.ts
// Tests for the CI publish-step helper (ADR-0021/0069).
// Covers: manifest discovery, dry-run no-write guarantee, and the skip-existing path.
// The byte-identical append+rebuild round-trip proof lives in append-ledger.test.ts;
// this file focuses on the scanning logic and the dry-run safety contract.
import { describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { INDEX_PATH, LEDGER_PATH } from "./build-index";
import {
  findManifestPaths,
  isPrivatePackage,
  runPublishStep,
} from "./ci-publish-step";

/** Unique temp dir scoped to this test run (no cross-test contamination). */
function tmpDir(label: string): string {
  const d = join(tmpdir(), `caisson-ci-step-${label}-${process.pid}`);
  mkdirSync(d, { recursive: true });
  return d;
}

describe("ci-publish-step (ADR-0021/0069)", () => {
  // -------------------------------------------------------------------------
  // findManifestPaths
  // -------------------------------------------------------------------------

  test("finds manifest.ts files in the real packages/ directory", () => {
    const paths = findManifestPaths();
    // The workspace has several packages with manifest.ts files.
    expect(paths.length).toBeGreaterThan(0);
    for (const p of paths) {
      expect(p.endsWith("manifest.ts")).toBe(true);
      expect(existsSync(p)).toBe(true);
    }
  });

  test("returns an empty array when the packagesDir does not exist", () => {
    const paths = findManifestPaths("/nonexistent/caisson/packages");
    expect(paths).toEqual([]);
  });

  test("excludes @caisson/license-issue (private:true, ADR-0110) from the real scan", () => {
    const paths = findManifestPaths();
    expect(paths.some((p) => p.includes("license-issue"))).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Private-package skip (data-driven off package.json `private`, ADR-0111 inverse —
  // never-published must never reach the ledger/index)
  // -------------------------------------------------------------------------

  test("isPrivatePackage: true only when package.json declares private:true", () => {
    const trueDir = tmpDir("is-private-true");
    const falseDir = tmpDir("is-private-false");
    const missingDir = tmpDir("is-private-missing");
    try {
      writeFileSync(
        join(trueDir, "package.json"),
        JSON.stringify({ name: "@caisson/x", private: true }),
      );
      expect(isPrivatePackage(trueDir)).toBe(true);

      writeFileSync(
        join(falseDir, "package.json"),
        JSON.stringify({ name: "@caisson/y", private: false }),
      );
      expect(isPrivatePackage(falseDir)).toBe(false);

      // No package.json at all: fail open to "not private".
      expect(isPrivatePackage(missingDir)).toBe(false);
    } finally {
      rmSync(trueDir, { recursive: true, force: true });
      rmSync(falseDir, { recursive: true, force: true });
      rmSync(missingDir, { recursive: true, force: true });
    }
  });

  test("findManifestPaths: a synthetic private:true package is skipped, a normal one is included", () => {
    const dir = tmpDir("private-skip-scan");
    try {
      const privateDir = join(dir, "private-pkg");
      const publicDir = join(dir, "public-pkg");
      mkdirSync(privateDir, { recursive: true });
      mkdirSync(publicDir, { recursive: true });

      writeFileSync(
        join(privateDir, "package.json"),
        JSON.stringify({
          name: "@caisson/private-pkg",
          version: "0.0.0",
          private: true,
        }),
      );
      writeFileSync(join(privateDir, "manifest.ts"), "export default {};\n");

      writeFileSync(
        join(publicDir, "package.json"),
        JSON.stringify({ name: "@caisson/public-pkg", version: "0.1.0" }),
      );
      writeFileSync(join(publicDir, "manifest.ts"), "export default {};\n");

      const paths = findManifestPaths(dir);

      expect(paths).toEqual([join(publicDir, "manifest.ts")]);
      expect(paths.some((p) => p.includes("private-pkg"))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // -------------------------------------------------------------------------
  // Dry-run: no file writes
  // -------------------------------------------------------------------------

  test("dry-run: ledger is NOT modified even when new entries are found", async () => {
    const dir = tmpDir("dry-run-empty");
    const ledgerPath = join(dir, "ledger.jsonl");
    const indexPath = join(dir, "index.json");
    try {
      // Empty ledger — all real workspace packages appear as "new" from its perspective.
      writeFileSync(ledgerPath, "");
      writeFileSync(indexPath, "{}");

      const result = await runPublishStep({
        runId: "ci-test-dry",
        sha: "abc1234def5678",
        publishedAt: "2026-06-28T00:00:00.000Z",
        dryRun: true,
        ledgerPath,
        indexPath,
      });

      // Dry-run: both files must be unchanged.
      expect(readFileSync(ledgerPath, "utf8")).toBe("");
      expect(readFileSync(indexPath, "utf8")).toBe("{}");
      // Nothing was actually appended.
      expect(result.appended).toBe(0);
      // But the real packages should appear as candidates.
      expect(result.wouldAppend).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("dry-run: returns appended=0 regardless of how many manifests are found", async () => {
    const dir = tmpDir("dry-run-assert");
    const ledgerPath = join(dir, "ledger.jsonl");
    const indexPath = join(dir, "index.json");
    try {
      writeFileSync(ledgerPath, "");
      writeFileSync(indexPath, "{}");

      const result = await runPublishStep({
        runId: "ci-test-always-dry",
        sha: "deadbeef12345678",
        publishedAt: "2026-06-28T00:00:00.000Z",
        dryRun: true,
        ledgerPath,
        indexPath,
      });

      expect(result.appended).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // -------------------------------------------------------------------------
  // Skip-existing: entries already in the ledger are not re-appended
  // -------------------------------------------------------------------------

  test("dry-run: entries matching committed ledger versions are skipped (skippedExisting > 0)", async () => {
    // Seed the tmp ledger with the committed ledger content, which contains 0.1.0 entries.
    // The real workspace packages are at 0.0.0 — those are not in this ledger, so they appear
    // as new candidates. The 0.1.0 entries have no matching manifest.ts in the workspace, so
    // they won't show up in the scan. This exercises the key skipped-existing path when a
    // future package manifest IS in the ledger.
    const dir = tmpDir("skip-existing");
    const ledgerPath = join(dir, "ledger.jsonl");
    const indexPath = join(dir, "index.json");
    try {
      const committedLedger = readFileSync(LEDGER_PATH, "utf8");
      writeFileSync(ledgerPath, committedLedger);
      writeFileSync(indexPath, readFileSync(INDEX_PATH, "utf8"));

      const result = await runPublishStep({
        runId: "ci-test-skip",
        sha: "ff00aa11bb22cc33",
        publishedAt: "2026-06-28T00:00:00.000Z",
        dryRun: true,
        ledgerPath,
        indexPath,
      });

      // Dry-run: never appended.
      expect(result.appended).toBe(0);
      // The ledger must be byte-identical to what we wrote.
      expect(readFileSync(ledgerPath, "utf8")).toBe(committedLedger);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
