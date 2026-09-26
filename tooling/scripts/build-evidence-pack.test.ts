// tooling/scripts/build-evidence-pack.test.ts — the assembler is the tested unit (the producers in
// main() are CI shell orchestration). Covers: manifest schema round-trip, per-file hash verification,
// fail-loud on a missing declared file, and the ADR-0279/0275 honesty invariants in the schema.
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assembleEvidencePack,
  type ClassSpec,
  evidenceClass,
  evidencePackManifest,
  parseEvidencePackManifest,
  type PackMeta,
} from "./build-evidence-pack";

const META: PackMeta = {
  commit: "0123abc4560123abc4560123abc4560123abc456",
  generatedAt: "2026-07-07T00:00:00.000Z",
  ref: "feat/x",
  runId: "42",
  runUrl: "https://github.com/caisson-sh/caisson/actions/runs/42",
  repository: "caisson-sh/caisson",
};

function scratch(): { stagingDir: string; outDir: string } {
  const root = mkdtempSync(join(tmpdir(), "evpack-"));
  const stagingDir = join(root, "staging");
  const outDir = join(root, "out");
  mkdirSync(stagingDir, { recursive: true });
  return { stagingDir, outDir };
}

const verifiedClass = (fileNames: string[]): ClassSpec => ({
  id: "standards-gate",
  title: "Standards gate",
  claimLevel: "implements",
  proofSource: "verified-in-pack",
  proof: "tooling/standards-gate/src/cli.ts",
  claim: "The standards gate ran clean; captured output included.",
  fileNames,
});

const referencedClass = (): ClassSpec => ({
  id: "package-test-suite",
  title: "Full package test suite",
  claimLevel: "implements",
  proofSource: "ci-job",
  proof: "ci.yml — job: check",
  claim: "The full tree runs on every push and pull request.",
  fileNames: [],
});

describe("assembleEvidencePack", () => {
  test("round-trips through the manifest schema and copies the files", () => {
    const { stagingDir, outDir } = scratch();
    const body = "standards gate: OK\n";
    writeFileSync(join(stagingDir, "standards-gate.txt"), body);

    const manifest = assembleEvidencePack({
      stagingDir,
      outDir,
      classes: [verifiedClass(["standards-gate.txt"]), referencedClass()],
      meta: META,
    });

    // The in-memory result and the written file both validate against the schema.
    expect(() => parseEvidencePackManifest(manifest)).not.toThrow();
    const onDisk = JSON.parse(
      readFileSync(join(outDir, "manifest.json"), "utf8"),
    );
    expect(parseEvidencePackManifest(onDisk)).toEqual(manifest);

    // The captured file was copied into the pack, byte-for-byte.
    expect(readFileSync(join(outDir, "standards-gate.txt"), "utf8")).toBe(body);
    expect(manifest.commit).toBe(META.commit);
    expect(manifest.disclaimer).not.toMatch(/block/i); // never claims it blocks merges
    expect(manifest.disclaimer.toLowerCase()).toContain(
      "pushes to main and on every pull request",
    );
  });

  test("records the true sha256 and byte length of each collected file", () => {
    const { stagingDir, outDir } = scratch();
    const body = "some evidence bytes 🧪\n";
    writeFileSync(join(stagingDir, "standards-gate.txt"), body);
    const expected = createHash("sha256")
      .update(readFileSync(join(stagingDir, "standards-gate.txt")))
      .digest("hex");

    const manifest = assembleEvidencePack({
      stagingDir,
      outDir,
      classes: [verifiedClass(["standards-gate.txt"])],
      meta: META,
    });

    const file = manifest.classes[0]?.files[0];
    expect(file?.sha256).toBe(expected);
    expect(file?.bytes).toBe(Buffer.byteLength(body));
    // The hash actually verifies against the copied-out bytes.
    const outHash = createHash("sha256")
      .update(readFileSync(join(outDir, "standards-gate.txt")))
      .digest("hex");
    expect(file?.sha256).toBe(outHash);
  });

  test("fails loud when a declared verified-in-pack file is missing (ADR-0275)", () => {
    const { stagingDir, outDir } = scratch();
    expect(() =>
      assembleEvidencePack({
        stagingDir,
        outDir,
        classes: [verifiedClass(["absent.txt"])],
        meta: META,
      }),
    ).toThrow(/missing/);
  });
});

describe("evidenceClass honesty invariants (ADR-0279/0275)", () => {
  test("a verified-in-pack class with no file is rejected", () => {
    expect(() =>
      evidenceClass.parse({ ...verifiedClass([]), files: [] }),
    ).toThrow();
  });

  test("operator-harness evidence cannot claim 'implements'", () => {
    expect(() =>
      evidenceClass.parse({
        id: "worm",
        title: "WORM live verification",
        claimLevel: "implements",
        proofSource: "operator-harness",
        proof: "ADR-0224 harness",
        claim: "Verified against live AWS.",
        files: [],
      }),
    ).toThrow();
    // maps-to is accepted.
    expect(() =>
      evidenceClass.parse({
        id: "worm",
        title: "WORM live verification",
        claimLevel: "maps-to",
        proofSource: "operator-harness",
        proof: "ADR-0224 harness",
        claim: "Verified against live AWS in operator sessions.",
        files: [],
      }),
    ).not.toThrow();
  });

  test("a claim asserting 'compliant'/'certified' is rejected", () => {
    expect(() =>
      evidenceClass.parse({
        ...referencedClass(),
        claim: "This makes the product SOC 2 certified.",
        files: [],
      }),
    ).toThrow();
  });

  test("a referenced class carrying files is rejected", () => {
    expect(() =>
      evidenceClass.parse({
        ...referencedClass(),
        files: [{ path: "x.txt", sha256: "a".repeat(64), bytes: 1 }],
      }),
    ).toThrow();
  });

  test("the manifest rejects an unknown top-level field (.strict())", () => {
    const { stagingDir, outDir } = scratch();
    writeFileSync(join(stagingDir, "standards-gate.txt"), "ok\n");
    const manifest = assembleEvidencePack({
      stagingDir,
      outDir,
      classes: [verifiedClass(["standards-gate.txt"])],
      meta: META,
    });
    expect(() =>
      evidencePackManifest.parse({ ...manifest, sneaky: true }),
    ).toThrow();
  });
});
