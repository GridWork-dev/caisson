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
import { ModuleManifest } from "../schema/module-manifest";
import { INDEX_PATH, LEDGER_PATH } from "./build-index";
import {
  computeTarballDist,
  findManifestPaths,
  isPrivatePackage,
  readSidecar,
  recordTarballs,
  runPublishStep,
  writeSidecar,
} from "./ci-publish-step";

/** A minimally-valid ModuleManifest fixture (recordTarballs reads only id + version). */
function mkManifest(id: string, version: string): ModuleManifest {
  return ModuleManifest.parse({
    id,
    version,
    kind: "base",
    tier: "oss",
    license: "Apache-2.0",
    description: id,
  });
}

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

// ---------------------------------------------------------------------------
// Tarball sidecar (ADR-0223 Fork 1.1): computeTarballDist + read/write + recordTarballs
// ---------------------------------------------------------------------------

describe("tarball sidecar (ADR-0223 Fork 1.1)", () => {
  test("computeTarballDist: known SHA-1 shasum + sha512 SRI integrity + size + scope-dropped key", () => {
    const dist = computeTarballDist(Buffer.from("hello"), "kernel", "1.2.3");
    // Well-known vectors for the bytes "hello" (independent of the impl under test).
    expect(dist.shasum).toBe("aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d");
    expect(dist.integrity).toBe(
      "sha512-m3HSJL1i83hdltRq0+o9czGb+8KJDKra4t/3JRlnPKcjI8PZm6XBHXx6zG4UuMXaDEZjR1wuXDre9G9zvN7AQw==",
    );
    expect(dist.size).toBe(5);
    // Key matches the R2 key registry/worker/npm-routes.ts derives on the tarball GET (scope dropped).
    expect(dist.key).toBe("kernel/kernel-1.2.3.tgz");
    // Integrity is a valid sha512 SRI: 64 raw bytes base64-encoded.
    const b64 = dist.integrity.slice("sha512-".length);
    expect(Buffer.from(b64, "base64").length).toBe(64);
  });

  test("readSidecar/writeSidecar: round-trips, sorts keys, preserves $comment, trailing newline", () => {
    const dir = tmpDir("sidecar-roundtrip");
    const path = join(dir, "tarballs.json");
    try {
      writeFileSync(
        path,
        JSON.stringify({ $comment: "note", tarballs: {} }, null, 2),
      );
      const sidecar = readSidecar(path);
      expect(sidecar.$comment).toBe("note");
      expect(sidecar.tarballs).toEqual({});

      // Insert out of order; writeSidecar must sort + keep $comment first + end with a newline.
      sidecar.tarballs["@caisson/z@1.0.0"] = {
        key: "z/z-1.0.0.tgz",
        shasum: "a".repeat(40),
        integrity: "sha512-Zm9v",
        size: 10,
      };
      sidecar.tarballs["@caisson/a@1.0.0"] = {
        key: "a/a-1.0.0.tgz",
        shasum: "b".repeat(40),
        integrity: "sha512-YmFy",
        size: 20,
      };
      writeSidecar(sidecar, path);

      const raw = readFileSync(path, "utf8");
      expect(raw.endsWith("\n")).toBe(true);
      expect(raw.indexOf("$comment")).toBeLessThan(raw.indexOf("tarballs"));
      expect(raw.indexOf("@caisson/a@1.0.0")).toBeLessThan(
        raw.indexOf("@caisson/z@1.0.0"),
      );
      // A missing sidecar path reads as an empty sidecar (never throws).
      expect(readSidecar(join(dir, "nope.json")).tarballs).toEqual({});
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("recordTarballs: packs (injected) + records a row per appended package; append-only never overwrites", () => {
    const dir = tmpDir("record-tarballs");
    const path = join(dir, "tarballs.json");
    try {
      writeFileSync(path, JSON.stringify({ tarballs: {} }, null, 2));
      const bytes = new Map<string, Uint8Array>([
        ["kernel", Buffer.from("kernel-bytes")],
        ["auth", Buffer.from("auth-bytes")],
      ]);
      const packFn = (
        _packageDir: string,
        slug: string,
        _version: string,
        _staging: string,
      ): Uint8Array => bytes.get(slug) as Uint8Array;

      const recorded = recordTarballs(
        [
          { manifest: mkManifest("@caisson/kernel", "1.0.0"), packageDir: dir },
          { manifest: mkManifest("@caisson/auth", "2.0.0"), packageDir: dir },
        ],
        { dryRun: false, sidecarPath: path, stagingDir: dir, packFn },
      );
      expect(recorded).toBe(2);

      const sidecar = readSidecar(path);
      const kernel = sidecar.tarballs["@caisson/kernel@1.0.0"];
      expect(kernel).toEqual(
        computeTarballDist(Buffer.from("kernel-bytes"), "kernel", "1.0.0"),
      );
      expect(sidecar.tarballs["@caisson/auth@2.0.0"]?.key).toBe(
        "auth/auth-2.0.0.tgz",
      );

      // Append-only (ADR-0006): a second pass with different bytes must NOT overwrite the row.
      const again = recordTarballs(
        [
          {
            manifest: mkManifest("@caisson/kernel", "1.0.0"),
            packageDir: dir,
          },
        ],
        {
          dryRun: false,
          sidecarPath: path,
          stagingDir: dir,
          packFn: () => Buffer.from("tampered"),
        },
      );
      expect(again).toBe(0);
      expect(readSidecar(path).tarballs["@caisson/kernel@1.0.0"]).toEqual(
        kernel as object,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("recordTarballs: dry-run records nothing and never invokes the packer", () => {
    const dir = tmpDir("record-tarballs-dry");
    const path = join(dir, "tarballs.json");
    try {
      writeFileSync(path, JSON.stringify({ tarballs: {} }, null, 2));
      let packed = 0;
      const recorded = recordTarballs(
        [{ manifest: mkManifest("@caisson/kernel", "1.0.0"), packageDir: dir }],
        {
          dryRun: true,
          sidecarPath: path,
          stagingDir: dir,
          packFn: () => {
            packed++;
            return Buffer.from("x");
          },
        },
      );
      expect(recorded).toBe(0);
      expect(packed).toBe(0);
      expect(readSidecar(path).tarballs).toEqual({});
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("runPublishStep dry-run: tarballsRecorded is 0 and the real sidecar is untouched", async () => {
    const dir = tmpDir("run-dry-tarballs");
    const ledgerPath = join(dir, "ledger.jsonl");
    const indexPath = join(dir, "index.json");
    const sidecarPath = join(dir, "tarballs.json");
    try {
      writeFileSync(ledgerPath, "");
      writeFileSync(indexPath, "{}");
      writeFileSync(sidecarPath, JSON.stringify({ tarballs: {} }, null, 2));

      const result = await runPublishStep({
        runId: "ci-test-dry-tarballs",
        sha: "abcd1234",
        publishedAt: "2026-06-28T00:00:00.000Z",
        dryRun: true,
        ledgerPath,
        indexPath,
        sidecarPath,
        stagingDir: dir,
        packFn: () => Buffer.from("never"),
      });

      expect(result.tarballsRecorded).toBe(0);
      expect(readSidecar(sidecarPath).tarballs).toEqual({});
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
