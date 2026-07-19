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
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { ModuleManifest } from "../schema/module-manifest";
import {
  INDEX_PATH,
  LEDGER_PATH,
  buildIndexFromLedgerFile,
} from "./build-index";
import {
  computeTarballDist,
  currentLockHash,
  defaultPack,
  findManifestPaths,
  isPrivatePackage,
  readSidecar,
  recordTarballs,
  refreshVersionCandidateTarballs,
  runPublishStep,
  writeSidecar,
} from "./ci-publish-step";

/** A freshly RECORDED row: dist fields + the run's lock-hash provenance stamp (ADR-0365). */
function recordedDist(
  bytes: Uint8Array,
  slug: string,
  version: string,
): ReturnType<typeof computeTarballDist> {
  const lockHash = currentLockHash();
  return {
    ...computeTarballDist(bytes, slug, version),
    ...(lockHash !== undefined ? { lockHash } : {}),
  };
}

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

/**
 * Build a gzipped ustar tarball carrying one `package/package.json` — exactly the shape `bun pm pack`
 * emits, so computeTarballDist's real tar walk is exercised without shelling out to a packer.
 */
function tgzWithPackageJson(pkg: object): Uint8Array {
  const body = Buffer.from(JSON.stringify(pkg), "utf8");
  const header = Buffer.alloc(512, 0);
  header.write("package/package.json", 0, "utf8"); // name
  header.write("0000644\0", 100, "utf8"); // mode
  header.write("0000000\0", 108, "utf8"); // uid
  header.write("0000000\0", 116, "utf8"); // gid
  header.write(`${body.length.toString(8).padStart(11, "0")}\0`, 124, "utf8"); // size
  header.write("00000000000\0", 136, "utf8"); // mtime
  header.write("0", 156, "utf8"); // typeflag = regular file
  header.write("ustar\0", 257, "utf8");
  header.write("00", 263, "utf8");
  // Checksum: fill the 8-byte field with spaces, sum every byte, write the octal back.
  header.fill(0x20, 148, 156);
  let sum = 0;
  for (const b of header) sum += b;
  header.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148, "utf8");
  const content = Buffer.alloc(Math.ceil(body.length / 512) * 512, 0);
  body.copy(content);
  const trailer = Buffer.alloc(1024, 0); // two zero blocks = end-of-archive
  return gzipSync(Buffer.concat([header, content, trailer]));
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

  test("dry-run: delisted ids (ADR-0271) count separately from skippedExisting", async () => {
    // The real committed ledger carries delist lines for @caisson/ai-kit/local-ai/agent-dev, and
    // their manifest.ts files still exist on disk (append-only — a delist removes only the index
    // entry, never the workspace package). Scanning the REAL packagesDir against the REAL ledger
    // exercises the split without any synthetic fixture.
    const dir = tmpDir("skip-delisted");
    const ledgerPath = join(dir, "ledger.jsonl");
    const indexPath = join(dir, "index.json");
    try {
      const committedLedger = readFileSync(LEDGER_PATH, "utf8");
      writeFileSync(ledgerPath, committedLedger);
      writeFileSync(indexPath, readFileSync(INDEX_PATH, "utf8"));

      const result = await runPublishStep({
        runId: "ci-test-skip-delisted",
        sha: "aa11bb22cc33dd44",
        publishedAt: "2026-07-07T00:00:00.000Z",
        dryRun: true,
        ledgerPath,
        indexPath,
      });

      // The 3 dissolved edition metas are delisted, not "already published".
      expect(result.skippedDelisted).toBe(3);
      expect(result.appended).toBe(0);
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

  test("computeTarballDist: lifts the abbreviated-packument install fields (deps/bin/engines) from the packed tarball's package.json", () => {
    const tgz = tgzWithPackageJson({
      name: "@caisson/compliance",
      version: "0.2.0",
      // Third-party AND already-resolved workspace deps — the exact tree a buyer must install.
      dependencies: {
        "@caisson/kernel": "0.2.0",
        zod: "^3.23.8",
        "@noble/ed25519": "^3.1.0",
      },
      // devDependencies are NOT an install field — must never leak into the packument.
      devDependencies: { typescript: "^5.6.0", eslint: "^9.13.0" },
      bin: { compliance: "./bin/c.js" },
      engines: { node: ">=18" },
    });
    const dist = computeTarballDist(tgz, "compliance", "0.2.0");
    expect(dist.meta?.dependencies).toEqual({
      "@caisson/kernel": "0.2.0",
      zod: "^3.23.8",
      "@noble/ed25519": "^3.1.0",
    });
    expect(dist.meta?.bin).toEqual({ compliance: "./bin/c.js" });
    expect(dist.meta?.engines).toEqual({ node: ">=18" });
    // devDependencies dropped; only the 5 install fields are captured.
    expect(dist.meta && "devDependencies" in dist.meta).toBe(false);
  });

  test("computeTarballDist: a package with no deps and non-tarball bytes both yield no meta (never crash)", () => {
    const noDeps = computeTarballDist(
      tgzWithPackageJson({ name: "@caisson/kernel", version: "1.0.0" }),
      "kernel",
      "1.0.0",
    );
    expect(noDeps.meta).toBeUndefined();
    // A test stub / corrupt bytes (not a valid gzip) degrades to no meta, not a throw.
    expect(
      computeTarballDist(Buffer.from("not a tarball"), "x", "1.0.0").meta,
    ).toBeUndefined();
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
        recordedDist(Buffer.from("kernel-bytes"), "kernel", "1.0.0"),
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
        kernel,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("recordTarballs: re-records only explicitly mutable version-PR rows", () => {
    const dir = tmpDir("record-tarballs-refresh");
    const path = join(dir, "tarballs.json");
    try {
      const historicalKey = "@caisson/auth@1.0.0";
      const versionPrKey = "@caisson/kernel@2.0.0";
      const historical = computeTarballDist(
        Buffer.from("historical-auth"),
        "auth",
        "1.0.0",
      );
      const stale = computeTarballDist(
        Buffer.from("stale-kernel"),
        "kernel",
        "2.0.0",
      );
      writeSidecar(
        { tarballs: { [historicalKey]: historical, [versionPrKey]: stale } },
        path,
      );

      const recorded = recordTarballs(
        [
          { manifest: mkManifest("@caisson/auth", "1.0.0"), packageDir: dir },
          {
            manifest: mkManifest("@caisson/kernel", "2.0.0"),
            packageDir: dir,
          },
        ],
        {
          dryRun: false,
          sidecarPath: path,
          stagingDir: dir,
          replaceKeys: new Set([versionPrKey]),
          packFn: (_packageDir, slug) => Buffer.from(`fresh-${slug}`),
        },
      );

      expect(recorded).toBe(1);
      const sidecar = readSidecar(path);
      expect(sidecar.tarballs[historicalKey]).toEqual(historical);
      expect(sidecar.tarballs[versionPrKey]).toEqual(
        recordedDist(Buffer.from("fresh-kernel"), "kernel", "2.0.0"),
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

  test("backfill (finding-2): a version already in the ledger but missing from the sidecar is STILL packed", async () => {
    // Steady state: the whole catalog is ledgered, so nothing is new to append. Pre-fix, the step
    // returned early before touching the sidecar → tarballs.json stayed empty → every packument
    // returned versions:{} and `bun install` failed with "no matching version". The reconcile must
    // pack the current-workspace version even when appended === 0.
    const dir = tmpDir("backfill");
    const pkgDir = join(dir, "packages");
    const demo = join(pkgDir, "demo");
    mkdirSync(demo, { recursive: true });
    writeFileSync(
      join(demo, "package.json"),
      JSON.stringify({ name: "@caisson/demo", version: "1.0.0" }),
    );
    writeFileSync(
      join(demo, "manifest.ts"),
      'export default { id: "@caisson/demo", version: "1.0.0" };\n',
    );
    const ledgerPath = join(dir, "ledger.jsonl");
    const indexPath = join(dir, "index.json");
    const sidecarPath = join(dir, "tarballs.json");
    // Seed the ledger so demo@1.0.0 is ALREADY published (→ toAppend empty, skippedExisting=1).
    const ledgerEntry = {
      id: "@caisson/demo",
      version: "1.0.0",
      manifest: mkManifest("@caisson/demo", "1.0.0"),
      publishedAt: "2026-01-01T00:00:00.000Z",
      gateAttestation: "ci-0001@deadbee",
    };
    writeFileSync(ledgerPath, `${JSON.stringify(ledgerEntry)}\n`);
    writeFileSync(indexPath, "{}");
    writeFileSync(sidecarPath, JSON.stringify({ tarballs: {} }, null, 2));
    try {
      const result = await runPublishStep({
        runId: "ci-backfill",
        sha: "abc1234def",
        publishedAt: "2026-01-02T00:00:00.000Z",
        dryRun: false,
        ledgerPath,
        indexPath,
        packagesDir: pkgDir,
        sidecarPath,
        stagingDir: dir,
        packFn: () => Buffer.from("demo-bytes"),
      });
      expect(result.appended).toBe(0); // nothing new to the ledger
      expect(result.skippedExisting).toBe(1); // demo@1.0.0 already ledgered
      expect(result.tarballsRecorded).toBe(1); // …but backfilled into the sidecar anyway
      // The ledger is untouched (append-only, nothing new).
      expect(readFileSync(ledgerPath, "utf8")).toBe(
        `${JSON.stringify(ledgerEntry)}\n`,
      );
      // The sidecar now carries the backfilled row.
      expect(readSidecar(sidecarPath).tarballs["@caisson/demo@1.0.0"]).toEqual(
        recordedDist(Buffer.from("demo-bytes"), "demo", "1.0.0"),
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("version refresh derives mutable rows from the fork-point sidecar", async () => {
    const dir = tmpDir("version-refresh");
    const pkgDir = join(dir, "packages");
    const demo = join(pkgDir, "demo");
    mkdirSync(demo, { recursive: true });
    writeFileSync(
      join(demo, "package.json"),
      JSON.stringify({ name: "@caisson/demo", version: "2.0.0" }),
    );
    writeFileSync(
      join(demo, "manifest.ts"),
      'export default { id: "@caisson/demo", version: "2.0.0" };\n',
    );
    const ledgerPath = join(dir, "ledger.jsonl");
    const indexPath = join(dir, "index.json");
    const sidecarPath = join(dir, "tarballs.json");
    const baseSidecarPath = join(dir, "base-tarballs.json");
    const ledgerEntry = {
      id: "@caisson/demo",
      version: "2.0.0",
      manifest: mkManifest("@caisson/demo", "2.0.0"),
      publishedAt: "2026-07-12T00:00:00.000Z",
      gateAttestation: "version-pr@deadbee",
    };
    writeFileSync(ledgerPath, `${JSON.stringify(ledgerEntry)}\n`);
    writeFileSync(indexPath, buildIndexFromLedgerFile(ledgerPath));
    writeSidecar({ tarballs: {} }, baseSidecarPath);
    writeSidecar(
      {
        tarballs: {
          "@caisson/demo@2.0.0": computeTarballDist(
            Buffer.from("stale"),
            "demo",
            "2.0.0",
          ),
        },
      },
      sidecarPath,
    );

    try {
      const result = await runPublishStep({
        runId: "version-refresh",
        sha: "abc1234def",
        publishedAt: "2026-07-12T01:00:00.000Z",
        dryRun: false,
        ledgerPath,
        indexPath,
        packagesDir: pkgDir,
        sidecarPath,
        refreshBaseSidecarPath: baseSidecarPath,
        stagingDir: dir,
        packFn: () => Buffer.from("fresh"),
      });

      expect(result.tarballsRecorded).toBe(1);
      expect(readSidecar(sidecarPath).tarballs["@caisson/demo@2.0.0"]).toEqual(
        recordedDist(Buffer.from("fresh"), "demo", "2.0.0"),
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("CAISSON-124: sibling-churn guard fires INSIDE the dispatch --mode version step (no synchronize event needed)", async () => {
    // Proves the fix: a single-shot version PR (workflow_dispatch, no follow-up push) never
    // triggers the pull_request_target synchronize refresh job, so this check must run here too.
    const dir = tmpDir("mode-version-sibling-churn");
    const pkgDir = join(dir, "packages");
    const authDir = join(pkgDir, "auth");
    const demoDir = join(pkgDir, "demo");
    mkdirSync(authDir, { recursive: true });
    mkdirSync(demoDir, { recursive: true });
    writeFileSync(
      join(authDir, "package.json"),
      JSON.stringify({ name: "@caisson/auth", version: "1.0.0" }),
    );
    writeFileSync(
      join(authDir, "manifest.ts"),
      'export default { id: "@caisson/auth", version: "1.0.0" };\n',
    );
    writeFileSync(
      join(demoDir, "package.json"),
      JSON.stringify({ name: "@caisson/demo", version: "1.0.0" }),
    );
    // demo@1.0.0 is NEW this run, so it goes through appendLedger's full ModuleManifest validation
    // (an already-ledgered sibling like auth below never re-validates its manifest).
    writeFileSync(
      join(demoDir, "manifest.ts"),
      [
        "export default {",
        '  id: "@caisson/demo",',
        '  version: "1.0.0",',
        '  kind: "base",',
        '  tier: "oss",',
        '  license: "Apache-2.0",',
        '  description: "demo",',
        "};",
        "",
      ].join("\n"),
    );
    const ledgerPath = join(dir, "ledger.jsonl");
    const indexPath = join(dir, "index.json");
    const sidecarPath = join(dir, "tarballs.json");
    // auth@1.0.0 was already published + sidecar'd by an EARLIER release; unchanged this run.
    const authEntry = {
      id: "@caisson/auth",
      version: "1.0.0",
      manifest: mkManifest("@caisson/auth", "1.0.0"),
      publishedAt: "2026-07-01T00:00:00.000Z",
      gateAttestation: "prior-run@deadbee",
    };
    writeFileSync(ledgerPath, `${JSON.stringify(authEntry)}\n`);
    writeFileSync(indexPath, buildIndexFromLedgerFile(ledgerPath));
    writeSidecar(
      {
        tarballs: {
          "@caisson/auth@1.0.0": computeTarballDist(
            Buffer.from("original-auth-bytes"),
            "auth",
            "1.0.0",
          ),
        },
      },
      sidecarPath,
    );

    try {
      // This run's changeset consume ledgers demo@1.0.0 (new) but not auth — auth's OWN version is
      // unchanged, yet its resolved workspace:* dependency shifted, so its repack no longer
      // reproduces the recorded row. Simulated by returning different bytes for auth than recorded.
      await expect(
        runPublishStep({
          runId: "ci-mode-version",
          sha: "abc1234def",
          publishedAt: "2026-07-17T00:00:00.000Z",
          dryRun: false,
          ledgerPath,
          indexPath,
          packagesDir: pkgDir,
          sidecarPath,
          stagingDir: dir,
          packFn: (_packageDir, slug) =>
            slug === "auth"
              ? Buffer.from("churned-auth-bytes")
              : Buffer.from("demo-bytes"),
        }),
      ).rejects.toThrow(/no longer re-pack to their advertised bytes/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("trusted version refresh rewrites only appended-ledger rows from candidate package bytes", () => {
    const dir = tmpDir("trusted-version-refresh");
    const candidateRoot = join(dir, "candidate");
    const packageDir = join(candidateRoot, "packages", "demo");
    const registryDir = join(candidateRoot, "registry");
    mkdirSync(packageDir, { recursive: true });
    mkdirSync(registryDir, { recursive: true });
    const baseLedgerPath = join(dir, "base-ledger.jsonl");
    const baseSidecarPath = join(dir, "base-tarballs.json");
    const historicalKey = "@caisson/auth@1.0.0";
    const candidateKey = "@caisson/demo@2.0.0";
    const historical = computeTarballDist(
      tgzWithPackageJson({ name: "@caisson/auth", version: "1.0.0" }),
      "auth",
      "1.0.0",
    );
    const baseEntry = {
      id: "@caisson/auth",
      version: "1.0.0",
      manifest: mkManifest("@caisson/auth", "1.0.0"),
      publishedAt: "2026-07-01T00:00:00.000Z",
      gateAttestation: "base@deadbee",
    };
    const candidateEntry = {
      id: "@caisson/demo",
      version: "2.0.0",
      manifest: mkManifest("@caisson/demo", "2.0.0"),
      publishedAt: "2026-07-12T00:00:00.000Z",
      gateAttestation: "version@cafe123",
    };
    const baseLedger = `${JSON.stringify(baseEntry)}\n`;
    writeFileSync(baseLedgerPath, baseLedger);
    writeFileSync(
      join(registryDir, "ledger.jsonl"),
      `${baseLedger}${JSON.stringify(candidateEntry)}\n`,
    );
    writeSidecar(
      { tarballs: { [historicalKey]: historical } },
      baseSidecarPath,
    );
    writeSidecar(
      {
        tarballs: {
          [historicalKey]: historical,
          [candidateKey]: computeTarballDist(
            tgzWithPackageJson({ name: "@caisson/demo", version: "2.0.0" }),
            "demo",
            "2.0.0",
          ),
        },
      },
      join(registryDir, "tarballs.json"),
    );
    writeFileSync(
      join(packageDir, "package.json"),
      JSON.stringify({ name: "@caisson/demo", version: "2.0.0" }),
    );
    const freshBytes = tgzWithPackageJson({
      name: "@caisson/demo",
      version: "2.0.0",
      dependencies: { zod: "^4.0.0" },
    });

    try {
      const refreshed = refreshVersionCandidateTarballs({
        candidateRoot,
        baseLedgerPath,
        baseSidecarPath,
        stagingDir: join(dir, "staging"),
        packFn: () => freshBytes,
      });

      expect(refreshed).toBe(1);
      const sidecar = readSidecar(join(registryDir, "tarballs.json"));
      expect(sidecar.tarballs[historicalKey]).toEqual(historical);
      expect(sidecar.tarballs[candidateKey]).toEqual(
        recordedDist(freshBytes, "demo", "2.0.0"),
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("trusted version refresh rejects any historical sidecar drift", () => {
    const dir = tmpDir("trusted-version-historical-drift");
    const candidateRoot = join(dir, "candidate");
    const registryDir = join(candidateRoot, "registry");
    mkdirSync(registryDir, { recursive: true });
    const baseLedgerPath = join(dir, "base-ledger.jsonl");
    const baseSidecarPath = join(dir, "base-tarballs.json");
    const key = "@caisson/auth@1.0.0";
    const baseEntry = {
      id: "@caisson/auth",
      version: "1.0.0",
      manifest: mkManifest("@caisson/auth", "1.0.0"),
      publishedAt: "2026-07-01T00:00:00.000Z",
      gateAttestation: "base@deadbee",
    };
    const ledger = `${JSON.stringify(baseEntry)}\n`;
    const dist = computeTarballDist(
      tgzWithPackageJson({ name: "@caisson/auth", version: "1.0.0" }),
      "auth",
      "1.0.0",
    );
    writeFileSync(baseLedgerPath, ledger);
    writeFileSync(join(registryDir, "ledger.jsonl"), ledger);
    writeSidecar({ tarballs: { [key]: dist } }, baseSidecarPath);
    writeSidecar(
      {
        tarballs: {
          [key]: { ...dist, meta: { dependencies: { evil: "1.0.0" } } },
        },
      },
      join(registryDir, "tarballs.json"),
    );

    try {
      expect(() =>
        refreshVersionCandidateTarballs({
          candidateRoot,
          baseLedgerPath,
          baseSidecarPath,
          stagingDir: join(dir, "staging"),
          packFn: () => Buffer.from("never"),
        }),
      ).toThrow(/historical tarball row drift/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // -------------------------------------------------------------------------
  // Sibling-churn guard: an UNCHANGED sibling (same version this PR) whose bytes no longer reproduce
  // means a workspace:* dep's resolved version moved since the row was recorded — caught at
  // version-PR time, not hours later at the publish/tag byte-gate.
  // -------------------------------------------------------------------------

  /** A trusted-refresh fixture: a single historical `@caisson/auth@1.0.0` row (present in both base
   *  and candidate sidecars, no new keys), with packages/auth on disk at `diskVersion`. */
  function mkSiblingFixture(label: string, diskVersion: string) {
    const dir = tmpDir(label);
    const candidateRoot = join(dir, "candidate");
    const authDir = join(candidateRoot, "packages", "auth");
    const registryDir = join(candidateRoot, "registry");
    mkdirSync(authDir, { recursive: true });
    mkdirSync(registryDir, { recursive: true });
    const baseLedgerPath = join(dir, "base-ledger.jsonl");
    const baseSidecarPath = join(dir, "base-tarballs.json");
    const key = "@caisson/auth@1.0.0";
    const originalBytes = tgzWithPackageJson({
      name: "@caisson/auth",
      version: "1.0.0",
      dependencies: { "@caisson/kernel": "1.0.0" },
    });
    const recorded = computeTarballDist(originalBytes, "auth", "1.0.0");
    const entry = {
      id: "@caisson/auth",
      version: "1.0.0",
      manifest: mkManifest("@caisson/auth", "1.0.0"),
      publishedAt: "2026-07-01T00:00:00.000Z",
      gateAttestation: "base@deadbee",
    };
    const ledger = `${JSON.stringify(entry)}\n`;
    writeFileSync(baseLedgerPath, ledger);
    writeFileSync(join(registryDir, "ledger.jsonl"), ledger);
    writeSidecar({ tarballs: { [key]: recorded } }, baseSidecarPath);
    writeSidecar(
      { tarballs: { [key]: recorded } },
      join(registryDir, "tarballs.json"),
    );
    writeFileSync(
      join(authDir, "package.json"),
      JSON.stringify({ name: "@caisson/auth", version: diskVersion }),
    );
    return {
      dir,
      candidateRoot,
      baseLedgerPath,
      baseSidecarPath,
      originalBytes,
    };
  }

  test("sibling-churn: an unchanged sibling whose repack no longer matches ⇒ throws with the fix", () => {
    const f = mkSiblingFixture("sibling-churn-mismatch", "1.0.0");
    // The workspace dep now resolves differently → repack yields different bytes than the row.
    const churned = tgzWithPackageJson({
      name: "@caisson/auth",
      version: "1.0.0",
      dependencies: { "@caisson/kernel": "1.1.0" },
    });
    try {
      expect(() =>
        refreshVersionCandidateTarballs({
          candidateRoot: f.candidateRoot,
          baseLedgerPath: f.baseLedgerPath,
          baseSidecarPath: f.baseSidecarPath,
          stagingDir: join(f.dir, "staging"),
          packFn: () => churned,
        }),
      ).toThrow(/no longer re-pack to their advertised bytes/);
    } finally {
      rmSync(f.dir, { recursive: true, force: true });
    }
  });

  test("sibling-churn: an unchanged sibling that still reproduces ⇒ no throw", () => {
    const f = mkSiblingFixture("sibling-churn-ok", "1.0.0");
    try {
      const refreshed = refreshVersionCandidateTarballs({
        candidateRoot: f.candidateRoot,
        baseLedgerPath: f.baseLedgerPath,
        baseSidecarPath: f.baseSidecarPath,
        stagingDir: join(f.dir, "staging"),
        packFn: () => f.originalBytes, // reproduces the recorded row exactly
      });
      expect(refreshed).toBe(0); // no new keys, and no sibling drift
    } finally {
      rmSync(f.dir, { recursive: true, force: true });
    }
  });

  test("lock-hash annotation (ADR-0365 refined): a stale lockHash alone never fails a row whose bytes still reproduce", () => {
    const f = mkSiblingFixture("sibling-lock-stale-ok", "1.0.0");
    // Rewrite the candidate sidecar row with a lockHash that cannot match the live repo lock —
    // workspace version bumps move the whole-lock hash every consume, so a stale hash with
    // identical bytes MUST pass (the 2026-07-19 mass-false-positive class).
    const key = "@caisson/auth@1.0.0";
    const sidecarPath = join(f.candidateRoot, "registry", "tarballs.json");
    const sidecar = readSidecar(sidecarPath);
    const row = sidecar.tarballs[key];
    if (row === undefined) throw new Error("fixture row missing");
    sidecar.tarballs[key] = { ...row, lockHash: "0".repeat(64) };
    writeSidecar(sidecar, sidecarPath);
    writeSidecar(sidecar, f.baseSidecarPath); // keep base/candidate historically identical
    try {
      const refreshed = refreshVersionCandidateTarballs({
        candidateRoot: f.candidateRoot,
        baseLedgerPath: f.baseLedgerPath,
        baseSidecarPath: f.baseSidecarPath,
        stagingDir: join(f.dir, "staging"),
        packFn: () => f.originalBytes, // reproduces the recorded bytes exactly
      });
      expect(refreshed).toBe(0); // stale hash + identical bytes → clean pass
    } finally {
      rmSync(f.dir, { recursive: true, force: true });
    }
  });

  test("lock-hash annotation (ADR-0365 refined): a REAL byte drift under a different lock cites the resolution drift in the error", () => {
    const f = mkSiblingFixture("sibling-lock-drift-cited", "1.0.0");
    const key = "@caisson/auth@1.0.0";
    const sidecarPath = join(f.candidateRoot, "registry", "tarballs.json");
    const sidecar = readSidecar(sidecarPath);
    const row = sidecar.tarballs[key];
    if (row === undefined) throw new Error("fixture row missing");
    sidecar.tarballs[key] = { ...row, lockHash: "0".repeat(64) };
    writeSidecar(sidecar, sidecarPath);
    writeSidecar(sidecar, f.baseSidecarPath);
    const churned = tgzWithPackageJson({
      name: "@caisson/auth",
      version: "1.0.0",
      dependencies: { "@caisson/kernel": "9.9.9" },
    });
    try {
      expect(() =>
        refreshVersionCandidateTarballs({
          candidateRoot: f.candidateRoot,
          baseLedgerPath: f.baseLedgerPath,
          baseSidecarPath: f.baseSidecarPath,
          stagingDir: join(f.dir, "staging"),
          packFn: () => churned,
        }),
      ).toThrow(/sibling-churn[\s\S]*dependency-resolution drift/);
    } finally {
      rmSync(f.dir, { recursive: true, force: true });
    }
  });

  test("lock-hash recording (ADR-0365): a freshly recorded row carries the current repo lock hash", () => {
    const dir = tmpDir("record-lock-hash");
    const sidecarPath = join(dir, "tarballs.json");
    const bytes = tgzWithPackageJson({
      name: "@caisson/auth",
      version: "1.0.0",
    });
    try {
      recordTarballs(
        [
          {
            manifest: mkManifest("@caisson/auth", "1.0.0"),
            packageDir: dir, // unused by the stub packFn
          },
        ],
        {
          dryRun: false,
          sidecarPath,
          stagingDir: join(dir, "staging"),
          packFn: () => bytes,
        },
      );
      const row = readSidecar(sidecarPath).tarballs["@caisson/auth@1.0.0"];
      expect(row?.lockHash).toBe(currentLockHash());
      expect(row?.lockHash).toMatch(/^[0-9a-f]{64}$/); // the repo lockfile exists under bun test
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("sibling-churn: a superseded historical version (disk bumped past the row) is skipped, no false positive", () => {
    const f = mkSiblingFixture("sibling-churn-superseded", "2.0.0");
    let packed = 0;
    try {
      const refreshed = refreshVersionCandidateTarballs({
        candidateRoot: f.candidateRoot,
        baseLedgerPath: f.baseLedgerPath,
        baseSidecarPath: f.baseSidecarPath,
        stagingDir: join(f.dir, "staging"),
        // Would mismatch the 1.0.0 row if ever invoked — proves the version-mismatch key is skipped.
        packFn: () => {
          packed++;
          return tgzWithPackageJson({
            name: "@caisson/auth",
            version: "9.9.9",
          });
        },
      });
      expect(refreshed).toBe(0);
      expect(packed).toBe(0); // the 1.0.0 row is never re-packed (disk is 2.0.0)
    } finally {
      rmSync(f.dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Publish mode (ADR-0325): zero-mutation verify + stage at the release tag
// ---------------------------------------------------------------------------

describe("publish mode (ADR-0325)", () => {
  type Fixture = {
    dir: string;
    pkgDir: string;
    ledgerPath: string;
    indexPath: string;
    sidecarPath: string;
  };

  /**
   * A tagged-tree fixture in its version-PR-complete state: one workspace package whose version
   * is ledgered, whose tarball row is recorded (hash of the bytes "demo-bytes"), and whose
   * index.json is a byte-identical rebuild of the ledger. Individual tests then break exactly
   * one invariant to prove the corresponding failure is caught.
   */
  function mkFixture(label: string): Fixture {
    const dir = tmpDir(`publish-${label}`);
    const pkgDir = join(dir, "packages");
    const demo = join(pkgDir, "demo");
    mkdirSync(demo, { recursive: true });
    writeFileSync(
      join(demo, "package.json"),
      JSON.stringify({ name: "@caisson/demo", version: "1.0.0" }),
    );
    writeFileSync(
      join(demo, "manifest.ts"),
      'export default { id: "@caisson/demo", version: "1.0.0" };\n',
    );
    const ledgerPath = join(dir, "ledger.jsonl");
    const indexPath = join(dir, "index.json");
    const sidecarPath = join(dir, "tarballs.json");
    const ledgerEntry = {
      id: "@caisson/demo",
      version: "1.0.0",
      manifest: mkManifest("@caisson/demo", "1.0.0"),
      publishedAt: "2026-01-01T00:00:00.000Z",
      gateAttestation: "version-pr-1@deadbee",
    };
    writeFileSync(ledgerPath, `${JSON.stringify(ledgerEntry)}\n`);
    writeFileSync(indexPath, buildIndexFromLedgerFile(ledgerPath));
    writeSidecar(
      {
        tarballs: {
          "@caisson/demo@1.0.0": computeTarballDist(
            Buffer.from("demo-bytes"),
            "demo",
            "1.0.0",
          ),
        },
      },
      sidecarPath,
    );
    return { dir, pkgDir, ledgerPath, indexPath, sidecarPath };
  }

  function publishOpts(f: Fixture) {
    return {
      runId: "pub-test",
      sha: "cafe1234cafe1234",
      publishedAt: "2026-02-01T00:00:00.000Z",
      mode: "publish" as const,
      ledgerPath: f.ledgerPath,
      indexPath: f.indexPath,
      packagesDir: f.pkgDir,
      sidecarPath: f.sidecarPath,
      stagingDir: f.dir,
    };
  }

  test("happy path: verifies + stages when bytes reproduce, and writes NOTHING", async () => {
    const f = mkFixture("happy");
    try {
      const ledgerBefore = readFileSync(f.ledgerPath, "utf8");
      const indexBefore = readFileSync(f.indexPath);
      const sidecarBefore = readFileSync(f.sidecarPath, "utf8");

      const result = await runPublishStep({
        ...publishOpts(f),
        dryRun: false,
        packFn: () => Buffer.from("demo-bytes"),
      });

      expect(result.verifiedStaged).toBe(1);
      expect(result.appended).toBe(0);
      expect(result.tarballsRecorded).toBe(0);
      // Zero mutation: all three tracked files byte-identical after a live publish pass.
      expect(readFileSync(f.ledgerPath, "utf8")).toBe(ledgerBefore);
      expect(readFileSync(f.indexPath).equals(indexBefore)).toBe(true);
      expect(readFileSync(f.sidecarPath, "utf8")).toBe(sidecarBefore);
    } finally {
      rmSync(f.dir, { recursive: true, force: true });
    }
  });

  test("a workspace version missing from the ledger fails (tag cut before its version PR)", async () => {
    const f = mkFixture("no-ledger");
    try {
      writeFileSync(f.ledgerPath, "");
      writeFileSync(f.indexPath, buildIndexFromLedgerFile(f.ledgerPath));
      await expect(
        runPublishStep({
          ...publishOpts(f),
          dryRun: false,
          packFn: () => Buffer.from("demo-bytes"),
        }),
      ).rejects.toThrow(/not in the ledger/);
    } finally {
      rmSync(f.dir, { recursive: true, force: true });
    }
  });

  test("a workspace version missing its sidecar row fails", async () => {
    const f = mkFixture("no-sidecar");
    try {
      writeSidecar({ tarballs: {} }, f.sidecarPath);
      await expect(
        runPublishStep({
          ...publishOpts(f),
          dryRun: false,
          packFn: () => Buffer.from("demo-bytes"),
        }),
      ).rejects.toThrow(/no tarballs\.json row/);
    } finally {
      rmSync(f.dir, { recursive: true, force: true });
    }
  });

  test("a stale index.json (not a byte-identical ledger rebuild) fails", async () => {
    const f = mkFixture("stale-index");
    try {
      writeFileSync(f.indexPath, "{}\n");
      await expect(
        runPublishStep({
          ...publishOpts(f),
          dryRun: false,
          packFn: () => Buffer.from("demo-bytes"),
        }),
      ).rejects.toThrow(/byte-identical rebuild/);
    } finally {
      rmSync(f.dir, { recursive: true, force: true });
    }
  });

  test("re-packed bytes that do not reproduce the recorded hash fail before any upload staging succeeds", async () => {
    const f = mkFixture("tampered");
    try {
      await expect(
        runPublishStep({
          ...publishOpts(f),
          dryRun: false,
          packFn: () => Buffer.from("tampered-bytes"),
        }),
      ).rejects.toThrow(/does not reproduce the recorded bytes/);
    } finally {
      rmSync(f.dir, { recursive: true, force: true });
    }
  });

  test("tampered packument metadata fails even when tarball hashes still match", async () => {
    const f = mkFixture("tampered-meta");
    try {
      const sidecar = readSidecar(f.sidecarPath);
      const key = "@caisson/demo@1.0.0";
      const row = sidecar.tarballs[key];
      expect(row).toBeDefined();
      sidecar.tarballs[key] = {
        ...row!,
        meta: { dependencies: { "evil-package": "1.0.0" } },
      };
      writeSidecar(sidecar, f.sidecarPath);

      await expect(
        runPublishStep({
          ...publishOpts(f),
          dryRun: false,
          packFn: () => Buffer.from("demo-bytes"),
        }),
      ).rejects.toThrow(/tarball verification failed/);
    } finally {
      rmSync(f.dir, { recursive: true, force: true });
    }
  });

  test("dry-run: metadata verified, packer never invoked, nothing staged", async () => {
    const f = mkFixture("dry");
    try {
      let packed = 0;
      const result = await runPublishStep({
        ...publishOpts(f),
        dryRun: true,
        packFn: () => {
          packed++;
          return Buffer.from("never");
        },
      });
      expect(packed).toBe(0);
      expect(result.verifiedStaged).toBe(0);
    } finally {
      rmSync(f.dir, { recursive: true, force: true });
    }
  });

  test("dry-run still catches metadata inconsistency (missing sidecar row)", async () => {
    const f = mkFixture("dry-broken");
    try {
      writeSidecar({ tarballs: {} }, f.sidecarPath);
      await expect(
        runPublishStep({ ...publishOpts(f), dryRun: true }),
      ).rejects.toThrow(/no tarballs\.json row/);
    } finally {
      rmSync(f.dir, { recursive: true, force: true });
    }
  });
});

describe("bun pm pack byte-determinism (the ADR-0325 load-bearing assumption)", () => {
  // The publish gate rests on this: the version PR records tarball hashes, publish re-packs at
  // the tag and requires byte-equality. If a bun bump ever changes the pack format, THIS test
  // reddens first — before the first live release trips over it.
  test("packing the same source twice, across an mtime change, yields identical bytes", () => {
    const dir = tmpDir("pack-det");
    const pkgDir = join(dir, "pkg");
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(
      join(pkgDir, "package.json"),
      JSON.stringify({
        name: "@caisson/pack-det-fixture",
        version: "0.0.1",
        main: "index.js",
      }),
    );
    writeFileSync(join(pkgDir, "index.js"), "module.exports = 1;\n");
    try {
      const first = defaultPack(pkgDir, "pack-det-fixture", "0.0.1", dir);
      // Shift every file's mtime by an hour — pack output must not depend on it.
      const later = new Date(Date.now() + 3600_000);
      utimesSync(join(pkgDir, "package.json"), later, later);
      utimesSync(join(pkgDir, "index.js"), later, later);
      const secondStaging = join(dir, "second");
      const second = defaultPack(
        pkgDir,
        "pack-det-fixture",
        "0.0.1",
        secondStaging,
      );
      expect(first.length).toBeGreaterThan(0);
      expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("default pack never executes package lifecycle scripts", () => {
    const dir = tmpDir("pack-ignore-scripts");
    const pkgDir = join(dir, "pkg");
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(
      join(pkgDir, "package.json"),
      JSON.stringify({
        name: "@caisson/no-script-exec",
        version: "1.0.0",
        scripts: { prepack: "touch PREPACK_RAN" },
      }),
    );
    writeFileSync(join(pkgDir, "index.ts"), "export const ok = true;\n");
    try {
      defaultPack(pkgDir, "no-script-exec", "1.0.0", dir);
      expect(existsSync(join(pkgDir, "PREPACK_RAN"))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
