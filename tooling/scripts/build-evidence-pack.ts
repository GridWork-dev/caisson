// tooling/scripts/build-evidence-pack.ts — the CI build-provenance evidence pack (ADR-0275).
//
// This aggregates the evidence CI ALREADY produces-and-discards (the standards-gate output, the
// registry index byte-identity proof, the test run) into ONE versioned, downloadable artifact —
// the auditor-facing "here is how this commit of Caisson was built" pack. The CI job runs the cheap
// producers, this script collects + hashes them + writes a Zod-validated manifest, and
// actions/upload-artifact ships it (feeds the ADR-0272 evidence page; future: shipped in the tarball).
//
// This is DELIBERATELY NOT the tenant compliance evidence pack in packages/compliance-core
// (pack-format.ts, ADR-0056/0058): that one is per-tenant, per-framework, control-based, WORM-chain-
// anchored + signed, generated at RUNTIME against a buyer's data. THIS one is a BUILD-TIME, repo-wide
// provenance record of CI checks. Different artifact, different rules — notably this pack INCLUDES its
// generation timestamp + commit SHA + run id (they ARE the provenance), the exact opposite of the
// tenant pack's byte-stable-body invariant. Keeping them separate is intentional; do not merge them.
//
// Honesty floor (ADR-0279): every class carries a `claimLevel`. "implements" is permitted ONLY where a
// linkable test/CI/OSCAL proof backs the class at this commit; evidence produced outside CI (the WORM
// live-verification harness, ADR-0224) is "maps-to", clearly labelled operator-run. No "compliant"/
// "certified" claim is made — Caisson is a toolmaker, not an assessed entity. The disclaimer travels
// INSIDE the artifact and says these checks run on pushes to main and on every pull request — never
// that they "block merges" (this repo has no enforced branch protection; claiming otherwise would be
// exactly the overclaim ADR-0279 bans).
//
// tooling/scripts/ has no package.json: this script imports only zod (from the root install) + node
// built-ins — no @caisson/* — so it runs standalone under `bun` in CI.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { z } from "zod";

/** Pack schema version. Append-only (ADR-0006): a breaking shape change mints a new number. */
export const EVIDENCE_PACK_SCHEMA_VERSION = 1 as const;

const SHA256_HEX = /^[0-9a-f]{64}$/;
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A collected evidence file: its path within the pack, its content hash, and its size. */
export const evidenceFile = z
  .object({
    path: z.string().min(1).max(200),
    sha256: z.string().regex(SHA256_HEX),
    bytes: z.number().int().nonnegative(),
  })
  .strict();
export type EvidenceFile = z.infer<typeof evidenceFile>;

/**
 * One evidence class in the pack.
 *   - `claimLevel` (ADR-0279): "implements" iff a linkable test/CI/OSCAL proof backs it at this
 *     commit; "maps-to" for evidence produced outside CI (operator-run).
 *   - `proofSource`: "verified-in-pack" (the pack captured the real output — see `files`), "ci-job"
 *     (a CI job proves it at this SHA; referenced, not re-run here), or "operator-harness" (proven in
 *     operator-run sessions, not CI — no attestation persisted).
 *   - `claim` may never assert "compliant"/"certified".
 */
export const evidenceClass = z
  .object({
    id: z.string().regex(KEBAB).max(80),
    title: z.string().trim().min(1).max(200),
    claimLevel: z.enum(["implements", "maps-to"]),
    proofSource: z.enum(["verified-in-pack", "ci-job", "operator-harness"]),
    proof: z.string().trim().min(1).max(400),
    claim: z
      .string()
      .trim()
      .min(1)
      .max(1000)
      .refine((s) => !/\b(compliant|certified)\b/i.test(s), {
        message:
          'claim must use build-evidence language, never "compliant"/"certified" (ADR-0279)',
      }),
    files: z.array(evidenceFile),
  })
  .strict()
  .superRefine((c, ctx) => {
    // A verified-in-pack class that carries no captured file is a hole — ADR-0275 fails loud rather
    // than shipping one, so the shape itself forbids it.
    if (c.proofSource === "verified-in-pack" && c.files.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["files"],
        message:
          "a verified-in-pack class must carry at least one captured file (no empty proof, ADR-0275)",
      });
    }
    // Evidence produced outside CI cannot claim "implements" — it is not linkable at this commit.
    if (c.proofSource === "operator-harness" && c.claimLevel !== "maps-to") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["claimLevel"],
        message:
          'operator-harness evidence is "maps-to" only — no linkable CI proof at this commit (ADR-0279)',
      });
    }
    // A referenced class (ci-job/operator-harness) records no files here — it points, it does not carry.
    if (c.proofSource !== "verified-in-pack" && c.files.length !== 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["files"],
        message: "a referenced class must not carry captured files",
      });
    }
  });
export type EvidenceClass = z.infer<typeof evidenceClass>;

/** The pack manifest. Provenance fields (commit/generatedAt/runId) are INTENTIONALLY included. */
export const evidencePackManifest = z
  .object({
    schemaVersion: z.literal(EVIDENCE_PACK_SCHEMA_VERSION),
    kind: z.literal("caisson-build-evidence-pack"),
    scope: z.literal("repository"),
    generatedAt: z.string().datetime(),
    commit: z.string().regex(/^[0-9a-f]{7,40}$/),
    ref: z.string().trim().min(1).max(300).optional(),
    runId: z.string().trim().min(1).max(40).optional(),
    runUrl: z.string().url().max(400).optional(),
    repository: z.string().trim().min(1).max(200).optional(),
    disclaimer: z.string().trim().min(1).max(2000),
    classes: z.array(evidenceClass).min(1),
  })
  .strict();
export type EvidencePackManifest = z.infer<typeof evidencePackManifest>;

/** Parse + validate a pack manifest (parse-or-throw; never a cast). */
export function parseEvidencePackManifest(
  input: unknown,
): EvidencePackManifest {
  return evidencePackManifest.parse(input);
}

/** The disclaimer that travels INSIDE the artifact (ADR-0279 not-a-certification + push/PR framing). */
export const PACK_DISCLAIMER =
  "Build-provenance evidence for this commit of the Caisson source. Every check listed here runs " +
  "on pushes to main and on every pull request to the repository. This is engineering build " +
  "evidence for a security reviewer's due diligence — not a compliance certification or audit " +
  "report; Caisson is a toolmaker, not an assessed entity. 'implements' classes are backed by a " +
  "captured output or a linkable CI job at this commit; 'maps-to' classes reference evidence " +
  "produced in operator-run sessions (ADR-0224 live-verification), not re-verified inside this " +
  "pack. A 'ci-job' class (package-test-suite, oscal-conformance) is verifiable by filtering the " +
  "repository's GitHub Actions runs on this manifest's `commit` field — note this pack's own " +
  "`runUrl` points at the quality workflow run that assembled it, not at ci.yml's run for the same " +
  "commit. This pack covers the whole repository at this commit; per-bundle packs are future work " +
  "(ADR-0275).";

/** A class as declared before its files are resolved+hashed (fileNames → files at assembly). */
export type ClassSpec = Omit<EvidenceClass, "files"> & {
  readonly fileNames: readonly string[];
};

export interface PackMeta {
  readonly commit: string;
  readonly ref?: string;
  readonly runId?: string;
  readonly runUrl?: string;
  readonly repository?: string;
  readonly generatedAt: string;
}

export interface AssembleOptions {
  /** Where the CI producers wrote their raw outputs. */
  readonly stagingDir: string;
  /** Where the assembled pack (manifest.json + copied files) is written. */
  readonly outDir: string;
  readonly classes: readonly ClassSpec[];
  readonly meta: PackMeta;
}

/**
 * Collect the staged evidence files into `outDir`, hash each, and write a validated `manifest.json`.
 * Pure w.r.t. the producers — it only reads the files they already wrote — so it is unit-testable
 * with fixture files. Throws (fails loud, ADR-0275) if a declared verified-in-pack file is absent.
 */
export function assembleEvidencePack(
  opts: AssembleOptions,
): EvidencePackManifest {
  mkdirSync(opts.outDir, { recursive: true });
  const classes: EvidenceClass[] = opts.classes.map((spec) => {
    const { fileNames, ...rest } = spec;
    const files: EvidenceFile[] = fileNames.map((name) => {
      const src = join(opts.stagingDir, name);
      // Missing declared evidence is a hole — surface it, never ship a manifest that omits it.
      let buf: Buffer;
      try {
        buf = readFileSync(src);
      } catch {
        throw new Error(
          `evidence-pack: declared file "${name}" for class "${spec.id}" is missing from ${opts.stagingDir} — the producing step did not run or failed (ADR-0275: fail loud, never ship a hole)`,
        );
      }
      // One read → both the copy and the hash/size derive from the same buffer (no re-read).
      writeFileSync(join(opts.outDir, name), buf);
      return {
        path: name,
        sha256: createHash("sha256").update(buf).digest("hex"),
        bytes: buf.byteLength,
      };
    });
    // Parse each class so the superRefine invariants (verified-in-pack⇒file, operator⇒maps-to) hold.
    return evidenceClass.parse({ ...rest, files });
  });

  const manifest = evidencePackManifest.parse({
    schemaVersion: EVIDENCE_PACK_SCHEMA_VERSION,
    kind: "caisson-build-evidence-pack",
    scope: "repository",
    generatedAt: opts.meta.generatedAt,
    commit: opts.meta.commit,
    ...(opts.meta.ref !== undefined ? { ref: opts.meta.ref } : {}),
    ...(opts.meta.runId !== undefined ? { runId: opts.meta.runId } : {}),
    ...(opts.meta.runUrl !== undefined ? { runUrl: opts.meta.runUrl } : {}),
    ...(opts.meta.repository !== undefined
      ? { repository: opts.meta.repository }
      : {}),
    disclaimer: PACK_DISCLAIMER,
    classes,
  });
  writeFileSync(
    join(opts.outDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  return manifest;
}

// ---------------------------------------------------------------------------------------------------
// main(): run the cheap producers into a staging dir, then assemble. Invoked by the CI evidence-pack
// job as a single `bun tooling/scripts/build-evidence-pack.ts`. The heavy/cross-runner proofs (the
// full turbo suite, the Java oscal-cli NIST validation) are their own required jobs at this same SHA
// — referenced here, not re-run (that would double CI). WORM is operator-run (ADR-0224).
// ---------------------------------------------------------------------------------------------------

const REPO_ROOT = join(import.meta.dir, "..", "..");
const REGISTRY_DIR = join(REPO_ROOT, "registry");

interface RunResult {
  readonly out: string;
  readonly code: number;
}

/** Run a command at the repo root, merging stdout+stderr; a null exit (signal) counts as failure. */
function run(cmd: readonly string[]): RunResult {
  const [bin, ...args] = cmd;
  const r = spawnSync(bin as string, args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return { out: `${r.stdout ?? ""}${r.stderr ?? ""}`, code: r.status ?? 1 };
}

/** Capture a producer's output to the staging file, failing loud on a non-zero exit. */
function produce(
  stagingDir: string,
  fileName: string,
  header: string,
  cmd: readonly string[],
): void {
  const { out, code } = run(cmd);
  writeFileSync(
    join(stagingDir, fileName),
    `# ${header}\n# command: ${cmd.join(" ")}\n# exit: ${code}\n\n${out}`,
  );
  if (code !== 0) {
    throw new Error(
      `evidence-pack: producer "${cmd.join(" ")}" exited ${code} — cannot attest "${fileName}" (ADR-0275: fail loud)`,
    );
  }
}

/** The commit SHA, from the CI env or a local `git rev-parse`. Throws rather than letting a failed
 *  git invocation's stderr text reach the manifest's SHA regex (a confusing schema error). */
function resolveCommit(): string {
  const env = process.env.GITHUB_SHA?.trim();
  if (env && /^[0-9a-f]{7,40}$/.test(env)) return env;
  const r = run(["git", "rev-parse", "HEAD"]);
  if (r.code !== 0) {
    throw new Error("evidence-pack: cannot resolve commit SHA");
  }
  return r.out.trim();
}

/** The six evidence classes (ADR-0275). Producer file names must match what main() writes. */
function evidenceClasses(): ClassSpec[] {
  return [
    {
      id: "standards-gate",
      title:
        "Standards gate — SPDX/license split · AGPL boundary · down-only versions · manifest agreement",
      claimLevel: "implements",
      proofSource: "verified-in-pack",
      proof: "tooling/standards-gate/src/cli.ts (CI job: standards-gate)",
      claim:
        "The standards gate ran clean at this commit: the open Apache/commercial license split (ADR-0094), the AGPL workspace + external-tree boundary, down-only versions, and manifest↔package.json agreement. Its captured output is included.",
      fileNames: ["standards-gate.txt"],
    },
    {
      id: "registry-index-provenance",
      title:
        "Registry index provenance — byte-identical rebuild from the ledger",
      claimLevel: "implements",
      proofSource: "verified-in-pack",
      proof:
        "registry/scripts/build-index.ts + git diff --exit-code (CI job: registry-index)",
      claim:
        "registry/index.json is a byte-for-byte rebuild of the git-tracked ledger; a hand-edit or stale rebuild fails the clean-diff check. The rebuild proof and the index itself are included.",
      fileNames: ["registry-index-proof.txt", "index.json"],
    },
    {
      id: "registry-test-suite",
      title:
        "Registry workspace test suite (schema · index builder · evidence pack)",
      claimLevel: "implements",
      proofSource: "verified-in-pack",
      proof: "bun test registry/schema registry/scripts",
      claim:
        "The registry workspace tests (schema, index builder, and this pack's own assembler) ran green at this commit; the captured summary is included. The full 38-package suite is the package-test-suite class.",
      fileNames: ["test-summary.txt"],
    },
    {
      id: "package-test-suite",
      title:
        "Full package test suite (build · lint · unit · PGlite integration · golden-file)",
      claimLevel: "implements",
      proofSource: "ci-job",
      proof:
        ".github/workflows/ci.yml — job: check (bunx turbo run build lint test)",
      claim:
        "The full build/lint/test tree across all packages runs on every push and pull request. It is proven by the linked CI job at this commit, not re-run inside this pack (it is a 38-package turbo tree).",
      fileNames: [],
    },
    {
      id: "oscal-conformance",
      title: "OSCAL v1.2.2 NIST schema conformance (SAR + POA&M export)",
      claimLevel: "implements",
      proofSource: "ci-job",
      proof:
        ".github/workflows/ci.yml — job: oscal-conformance (oscal-cli JSON→XML→validate)",
      claim:
        "The OSCAL SAR/POA&M export is schema-validated against NIST OSCAL v1.2.2 by oscal-cli on every push and pull request. Proven by the linked CI job at this commit; the Java oscal-cli validation is not re-run inside this pack.",
      fileNames: [],
    },
    {
      id: "worm-live-verification",
      title: "WORM audit-log immutability (S3 Object-Lock) — live verification",
      claimLevel: "maps-to",
      proofSource: "operator-harness",
      proof:
        "live-verification harness (ADR-0224) — operator-run against live AWS",
      claim:
        "WORM audit-log immutability (S3 Object-Lock, GOVERNANCE mode) is verified against live AWS by the ADR-0224 live-verification harness in operator-run sessions. It is not wired into CI and no attestation is persisted in this pack.",
      fileNames: [],
    },
  ];
}

function main(): void {
  const packRoot = join(REPO_ROOT, "evidence-pack");
  const stagingDir = join(packRoot, ".staging");
  const outDir = join(packRoot, "pack");
  rmSync(packRoot, { recursive: true, force: true });
  mkdirSync(stagingDir, { recursive: true });

  // Producer 1 — the standards gate (license split + AGPL + declarations + manifest agreement).
  produce(
    stagingDir,
    "standards-gate.txt",
    "Caisson standards gate — SPDX/license authority (ADR-0021/0022/0094)",
    ["bun", "run", "tooling/standards-gate/src/cli.ts"],
  );

  // Producer 2 — registry index byte-identity: rebuild from the ledger, then a clean diff proves it.
  const build = run(["bun", "registry/scripts/build-index.ts"]);
  const diff = run(["git", "diff", "--exit-code", "registry/index.json"]);
  writeFileSync(
    join(stagingDir, "registry-index-proof.txt"),
    `# Registry index byte-identity proof (ADR-0021/0047)\n` +
      `# build: bun registry/scripts/build-index.ts (exit ${build.code})\n` +
      `${build.out}\n` +
      `# byte-identity: git diff --exit-code registry/index.json (exit ${diff.code})\n` +
      `${diff.code === 0 ? "CLEAN — index.json is a byte-identical rebuild of the ledger.\n" : diff.out}`,
  );
  if (build.code !== 0 || diff.code !== 0) {
    throw new Error(
      `evidence-pack: registry index is not a byte-identical rebuild (build exit ${build.code}, diff exit ${diff.code}) — cannot attest provenance (ADR-0275: fail loud)`,
    );
  }
  copyFileSync(
    join(REGISTRY_DIR, "index.json"),
    join(stagingDir, "index.json"),
  );

  // Producer 3 — the registry workspace test suite (fast, hermetic; includes this pack's own tests).
  produce(stagingDir, "test-summary.txt", "Registry workspace test suite", [
    "bun",
    "test",
    "registry/schema",
    "registry/scripts",
    "tooling/scripts/build-evidence-pack.test.ts",
  ]);

  const repository = process.env.GITHUB_REPOSITORY?.trim();
  const runId = process.env.GITHUB_RUN_ID?.trim();
  const server = process.env.GITHUB_SERVER_URL?.trim();
  const meta: PackMeta = {
    commit: resolveCommit(),
    generatedAt: new Date().toISOString(),
    ...(process.env.GITHUB_REF_NAME?.trim()
      ? { ref: process.env.GITHUB_REF_NAME.trim() }
      : {}),
    ...(runId ? { runId } : {}),
    ...(repository ? { repository } : {}),
    ...(repository && runId && server
      ? { runUrl: `${server}/${repository}/actions/runs/${runId}` }
      : {}),
  };

  const manifest = assembleEvidencePack({
    stagingDir,
    outDir,
    classes: evidenceClasses(),
    meta,
  });
  rmSync(stagingDir, { recursive: true, force: true });

  const implemented = manifest.classes.filter(
    (c) => c.claimLevel === "implements",
  ).length;
  process.stdout.write(
    `evidence-pack: wrote ${outDir}/manifest.json — ${manifest.classes.length} classes ` +
      `(${implemented} implements, ${manifest.classes.length - implemented} maps-to) at ${meta.commit.slice(0, 7)}\n`,
  );
}

if (import.meta.main) {
  main();
}
