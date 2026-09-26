// scripts/vendor-nist-catalog.ts — the oscal-spine vendoring + re-vendor procedure (SPEC
// outputs/specs/oscal-spine, binding requirement 2). Fetches the NIST SP 800-53 rev5 OSCAL
// catalog from usnistgov/oscal-content (CC0 1.0 Universal) at a resolved commit SHA — never
// `main` as a fetch target.
//
// Default mode (no flags) is the explicit, operator-triggered VENDOR action: resolves the repo's
// current `main` tip (or an explicit `--sha`), fetches the catalog verbatim at that commit,
// OVERWRITES the committed vendored JSON file, and prints the new pin values for a human to paste
// into `nist-catalog-pin.ts` — a source-controlled constant module stays a human-reviewed edit,
// never a mechanically regex-patched one.
//
// `--refetch` is the read-only diff mode binding requirement 2 asks for: fetches a fresh copy INTO
// MEMORY ONLY (never touches disk), hashes it, and — only if the hash differs from the pinned
// SHA-256 — structurally diffs its control-id set against the currently-vendored file's, flagging
// added/removed ids and which `nist80053Crosswalk` rows cite a removed id (their provenance just
// went stale). Never writes, never auto-applies the pin. The weekly nist-catalog-watch.yml
// workflow runs this mode and never treats its exit code as a gate (report-only, always exits 0).
//
// Usage:
//   bun packages/oscal-spine/scripts/vendor-nist-catalog.ts             # vendor (writes)
//   bun packages/oscal-spine/scripts/vendor-nist-catalog.ts --refetch   # diff-only report
//   bun packages/oscal-spine/scripts/vendor-nist-catalog.ts --sha <sha> [--refetch]
import { createHash } from "node:crypto";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { fetchWithTimeout } from "@caisson-sh/kernel";
import {
  extractControlIds,
  nist80053Crosswalk,
  NIST_CATALOG_PIN,
  NIST_CATALOG_REPO,
  NIST_CATALOG_UPSTREAM_PATH,
  type NistCatalogDocument,
} from "../src/index.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const VENDOR_DIR = join(HERE, "..", "src", "vendor");
const VENDORED_CATALOG_PATH = join(
  VENDOR_DIR,
  NIST_CATALOG_PIN.vendoredFilename,
);

const FETCH_TIMEOUT_MS = 30_000;

// The GitHub Commits API response carries many fields beyond `sha`; deliberately non-strict — a
// `.strict()` schema here would break on any future field GitHub adds to a response this script
// doesn't control (the Zod-at-boundaries floor's own external-API-breadth carve-out).
const commitResponseSchema = z.object({
  sha: z.string().regex(/^[0-9a-f]{40}$/),
});

/** Resolve the current `main` tip commit SHA via GitHub's public REST API (unauthenticated —
 *  public repo, no credential needed, no new egress surface beyond the already-sanctioned
 *  raw.githubusercontent.com/api.github.com reads). */
export async function resolveMainSha(
  repo: string = NIST_CATALOG_REPO,
): Promise<string> {
  const res = await fetchWithTimeout(
    `https://api.github.com/repos/${repo}/commits/main`,
    { headers: { Accept: "application/vnd.github+json" } },
    { timeoutMs: FETCH_TIMEOUT_MS },
  );
  if (!res.ok) {
    throw new Error(
      `vendor-nist-catalog: GitHub commits API returned ${String(res.status)} for ${repo}`,
    );
  }
  return commitResponseSchema.parse(await res.json()).sha;
}

/** Fetch the catalog's raw bytes at a pinned commit SHA — never `main`. */
export async function fetchCatalogAt(
  sha: string,
  repo: string = NIST_CATALOG_REPO,
  upstreamPath: string = NIST_CATALOG_UPSTREAM_PATH,
): Promise<Uint8Array> {
  const url = `https://raw.githubusercontent.com/${repo}/${sha}/${upstreamPath}`;
  const res = await fetchWithTimeout(url, {}, { timeoutMs: FETCH_TIMEOUT_MS });
  if (!res.ok) {
    throw new Error(
      `vendor-nist-catalog: fetch of ${url} returned ${String(res.status)}`,
    );
  }
  return new Uint8Array(await res.arrayBuffer());
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Read the catalog's own internal metadata fields defensively (never assume the shape). */
export function readCatalogMetadata(bytes: Uint8Array): {
  version: string | undefined;
  oscalVersion: string | undefined;
} {
  const doc = JSON.parse(
    Buffer.from(bytes).toString("utf8"),
  ) as NistCatalogDocument;
  return {
    version: doc.catalog?.metadata?.version,
    oscalVersion: doc.catalog?.metadata?.["oscal-version"],
  };
}

export interface ControlIdDiff {
  readonly added: readonly string[];
  readonly removed: readonly string[];
}

/** Structural diff between two control-id sets. A renumbered id surfaces as one addition + one
 *  removal — the honest signal, since nothing links the old id to its replacement automatically. */
export function diffControlIds(
  oldIds: ReadonlySet<string>,
  newIds: ReadonlySet<string>,
): ControlIdDiff {
  return {
    added: [...newIds].filter((id) => !oldIds.has(id)).sort(),
    removed: [...oldIds].filter((id) => !newIds.has(id)).sort(),
  };
}

/** Which nist80053Crosswalk rows cite a control id that a diff just flagged as removed — their
 *  provenance goes stale against the fresh catalog (binding requirement 2). */
export function staleRows(removed: readonly string[]): readonly {
  readonly control: string;
  readonly canonicalControlId: string | undefined;
}[] {
  const removedSet = new Set(removed);
  return nist80053Crosswalk.rows
    .filter((row) => removedSet.has(row.control.toUpperCase()))
    .map((row) => ({
      control: row.control,
      canonicalControlId: row.canonicalControlId,
    }));
}

function writeReport(lines: readonly string[]): void {
  const report = lines.join("\n");
  process.stdout.write(`${report}\n`);
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) appendFileSync(summaryPath, `${report}\n`);
}

async function runVendor(sha: string): Promise<void> {
  const bytes = await fetchCatalogAt(sha);
  const digest = sha256Hex(bytes);
  const meta = readCatalogMetadata(bytes);
  writeFileSync(VENDORED_CATALOG_PATH, bytes);
  writeReport([
    "## NIST SP 800-53 rev5 catalog — vendored",
    "",
    `- commit: ${sha}`,
    `- catalog version: ${meta.version ?? "(missing)"}`,
    `- oscal-version: ${meta.oscalVersion ?? "(missing)"}`,
    `- sha256: ${digest}`,
    "",
    "Wrote the vendored bytes. Paste the four values above into",
    "packages/oscal-spine/src/vendor/nist-catalog-pin.ts",
    "(NIST_CATALOG_COMMIT_SHA / NIST_CATALOG_VERSION / NIST_CATALOG_OSCAL_VERSION /",
    "NIST_CATALOG_SHA256) as a reviewed, human-authored edit — this script never rewrites that",
    "module itself.",
  ]);
}

async function runRefetchDiff(sha: string): Promise<void> {
  const fresh = await fetchCatalogAt(sha);
  const freshDigest = sha256Hex(fresh);
  if (freshDigest === NIST_CATALOG_PIN.sha256) {
    writeReport([
      "## NIST SP 800-53 rev5 catalog — refetch diff",
      "",
      `No change at commit ${sha}: matches the pinned SHA-256. Nothing to review.`,
    ]);
    return;
  }
  const meta = readCatalogMetadata(fresh);
  const freshIds = extractControlIds(
    JSON.parse(Buffer.from(fresh).toString("utf8")) as NistCatalogDocument,
  );
  // Read the committed vendored file directly (this script already knows its own path) rather
  // than the removed `loadVendoredNistControlIds` package export — that I/O helper stays
  // package-internal to oscal-spine (SHIP-audit P2 fix: it ENOENTs from a built dist/ tree).
  const currentIds = extractControlIds(
    JSON.parse(
      readFileSync(VENDORED_CATALOG_PATH, "utf8"),
    ) as NistCatalogDocument,
  );
  const diff = diffControlIds(currentIds, freshIds);
  const stale = staleRows(diff.removed);

  const lines = [
    "## NIST SP 800-53 rev5 catalog — refetch diff (upstream has moved)",
    "",
    `- pinned commit: ${NIST_CATALOG_PIN.commitSha}`,
    `- fresh commit: ${sha}`,
    `- pinned catalog version: ${NIST_CATALOG_PIN.catalogVersion} / fresh: ${meta.version ?? "(missing)"}`,
    `- pinned oscal-version: ${NIST_CATALOG_PIN.oscalVersion} / fresh: ${meta.oscalVersion ?? "(missing)"}`,
    `- pinned sha256: ${NIST_CATALOG_PIN.sha256}`,
    `- fresh sha256: ${freshDigest}`,
    "",
    `- added control ids: ${String(diff.added.length)}${diff.added.length ? ` — ${diff.added.slice(0, 20).join(", ")}${diff.added.length > 20 ? ", …" : ""}` : ""}`,
    `- removed control ids: ${String(diff.removed.length)}${diff.removed.length ? ` — ${diff.removed.join(", ")}` : ""}`,
  ];
  if (stale.length > 0) {
    lines.push(
      "",
      "### nist80053Crosswalk rows whose provenance just went stale",
      "",
      ...stale.map(
        (r) =>
          `- ${r.control} (canonicalControlId: ${r.canonicalControlId ?? "(none)"})`,
      ),
    );
  }
  lines.push(
    "",
    "Report-only — nothing was written. Re-run without --refetch (an explicit, reviewed action) to",
    "actually re-vendor, then hand-update any crosswalk rows flagged stale above.",
  );
  writeReport(lines);
}

interface Argv {
  refetch: boolean;
  sha: string | null;
}

const IMMUTABLE_GIT_SHA = /^[0-9a-f]{40}$/;

export function parseArgv(argv: readonly string[]): Argv {
  let refetch = false;
  let sha: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--refetch") {
      if (refetch) throw new Error("duplicate --refetch flag");
      refetch = true;
    } else if (arg === "--sha") {
      if (sha !== null) throw new Error("duplicate --sha flag");
      const candidate = argv[i + 1];
      if (candidate === undefined || !IMMUTABLE_GIT_SHA.test(candidate)) {
        throw new Error(
          "--sha requires an exact lowercase 40-character git commit SHA",
        );
      }
      sha = candidate;
      i++;
    } else {
      throw new Error(`unknown argument: ${JSON.stringify(arg)}`);
    }
  }
  return { refetch, sha };
}

async function main(): Promise<void> {
  const { refetch, sha: shaArg } = parseArgv(process.argv.slice(2));
  if (refetch) {
    // Advisory lane (mirrors tsgo-agreement.ts): a transient network/API failure is data, not a
    // crash — the weekly workflow reads this job summary either way and is never a required check.
    try {
      const sha = shaArg ?? (await resolveMainSha());
      await runRefetchDiff(sha);
    } catch (err) {
      writeReport([
        "## NIST SP 800-53 rev5 catalog — refetch diff",
        "",
        `_refetch failed (advisory, non-blocking): ${err instanceof Error ? err.message : String(err)}_`,
      ]);
    }
    return;
  }
  // The write path is an explicit, foreground operator action — fail loudly on error.
  const sha = shaArg ?? (await resolveMainSha());
  await runVendor(sha);
}

if (import.meta.main) {
  main().catch((err: unknown) => {
    process.stderr.write(
      `vendor-nist-catalog: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exitCode = 1;
  });
}
