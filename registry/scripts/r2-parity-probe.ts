// registry/scripts/r2-parity-probe.ts — the R2 tarball existence + hash parity probe.
//
// THE RESIDUAL: registry/tarballs.json advertises, for every published (id,version), the R2 object
// key + its SHA-1 shasum + byte size. The Worker serves those bytes to buyers straight from R2. But
// nothing continuously proves the live R2 objects still MATCH the advertised rows: an operator R2
// overwrite, a partial/aborted upload, or a row recorded for an object that never landed all open a
// window where a buyer's `bun install` fetches bytes whose hash fails the integrity check (or 404s).
// This probe GETs every advertised object, SHA-1s the bytes, and compares to the row — exiting
// NONZERO on any drift, so a diverged bucket is caught rather than discovered by a buyer.
//
// It reuses the SAME `aws` CLI + R2 S3-endpoint pattern publish.yml already uses for this bucket
// (caisson-registry-tarballs) — no new dependency, no new credential surface: the workflow hands it
// the same R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_ACCOUNT_ID release secrets publish.yml holds.
//
// FAIL-CLOSED: a 404 is `missing` (drift); ANY other spawn/network failure is `unreachable` (drift) —
// an unreachable object is never treated as a pass, mirroring publish.yml's "only a definite 404 may
// fall through" head-object rule.
//
// registry/ IS a workspace member, but this file keeps to node built-ins + zod + a relative import of
// the sidecar reader (the write boundary already owns the shape) to match index-parity-probe.ts.
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readSidecar } from "./ci-publish-step.ts";
import type { Sidecar } from "./ci-publish-step.ts";

const R2_BUCKET = "caisson-registry-tarballs";
/** Full-GET + hash 252 objects (8.4MB total) — trivially cheap; a small pool keeps wall-clock low. */
const CONCURRENCY = 12;

/** One advertised object: the R2 key + the shasum/size the sidecar promises for it. */
export interface SidecarRow {
  readonly key: string;
  readonly shasum: string;
  readonly size: number;
}

/** The outcome of GETting one object from R2. `found` carries the observed bytes' sha1 + length. */
export type FetchOutcome =
  | {
      readonly outcome: "found";
      readonly shasum: string;
      readonly size: number;
    }
  | { readonly outcome: "missing" }
  | { readonly outcome: "unreachable"; readonly detail: string };

export type R2RowStatus =
  "ok" | "hash-mismatch" | "size-mismatch" | "missing" | "unreachable";

export interface R2RowResult {
  readonly key: string;
  readonly status: R2RowStatus;
  readonly detail: string;
}

export interface R2ParityReport {
  readonly results: R2RowResult[];
  readonly okCount: number;
  /** True when ANY advertised object is missing, hash/size-mismatched, or unreachable. */
  readonly drift: boolean;
}

/** Flatten the sidecar's `<id>@<version>` map to the {key,shasum,size} rows the probe checks. */
export function sidecarRows(sidecar: Sidecar): SidecarRow[] {
  return Object.values(sidecar.tarballs).map((d) => ({
    key: d.key,
    shasum: d.shasum,
    size: d.size,
  }));
}

/**
 * Compare advertised rows against fetched R2 outcomes. PURE over already-fetched inputs (the network
 * lives in {@link main}), so drift detection is unit-testable with fixtures. A row with no fetch
 * outcome, an `unreachable` outcome, a `missing` outcome, or a shasum/size that differs from the
 * advertised row all count as drift (fail-closed).
 */
export function computeR2Parity(
  rows: readonly SidecarRow[],
  fetched: ReadonlyMap<string, FetchOutcome>,
): R2ParityReport {
  const results: R2RowResult[] = [];
  for (const row of rows) {
    const got = fetched.get(row.key);
    if (got === undefined) {
      results.push({
        key: row.key,
        status: "unreachable",
        detail: "no fetch result — the probe never reached this object",
      });
    } else if (got.outcome === "unreachable") {
      results.push({
        key: row.key,
        status: "unreachable",
        detail: `GET failed: ${got.detail}`,
      });
    } else if (got.outcome === "missing") {
      results.push({
        key: row.key,
        status: "missing",
        detail: "advertised in tarballs.json but 404 from R2",
      });
    } else if (got.shasum !== row.shasum) {
      results.push({
        key: row.key,
        status: "hash-mismatch",
        detail: `sha1 ${got.shasum} != recorded ${row.shasum}`,
      });
    } else if (got.size !== row.size) {
      results.push({
        key: row.key,
        status: "size-mismatch",
        detail: `${String(got.size)}B != recorded ${String(row.size)}B`,
      });
    } else {
      results.push({
        key: row.key,
        status: "ok",
        detail: `${got.shasum} · ${String(got.size)}B`,
      });
    }
  }
  const okCount = results.filter((r) => r.status === "ok").length;
  return { results, okCount, drift: okCount !== results.length };
}

/** Render the report: a summary line, one line per NON-ok object (252 ok rows would be noise), + a
 *  verdict line. */
export function renderReport(report: R2ParityReport): string {
  const lines = [
    `R2 parity: ${String(report.okCount)}/${String(report.results.length)} advertised objects reproduce`,
  ];
  for (const r of report.results) {
    if (r.status !== "ok") {
      lines.push(
        `  ${r.status.toUpperCase().padEnd(14)} ${r.key} — ${r.detail}`,
      );
    }
  }
  lines.push(report.drift ? "\nRESULT: DRIFT DETECTED" : "\nRESULT: PARITY OK");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Live runner (the network — never touched by the pure function above)
// ---------------------------------------------------------------------------

interface R2FetchOpts {
  readonly bucket: string;
  readonly endpoint: string;
  readonly tmpDir: string;
}

/** Run `aws` with an ARG ARRAY (no shell string — security.md shell-execution rule). Resolves the
 *  exit status + captured stderr; a spawn error (e.g. aws missing) resolves status -1, never rejects. */
function spawnAws(args: string[]): Promise<{ status: number; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn("aws", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d: Buffer) => {
      stderr += d.toString("utf8");
    });
    child.on("error", (e: Error) => {
      resolve({ status: -1, stderr: e.message });
    });
    child.on("close", (code) => {
      resolve({ status: code ?? -1, stderr });
    });
  });
}

/** GET one object to a throwaway file, sha1 the bytes, classify. A definite 404 → `missing`; any
 *  other failure → `unreachable` (fail-closed). The temp file is always unlinked. */
async function fetchOneFromR2(
  key: string,
  opts: R2FetchOpts,
): Promise<FetchOutcome> {
  const outfile = join(opts.tmpDir, randomUUID());
  const res = await spawnAws([
    "s3api",
    "get-object",
    "--bucket",
    opts.bucket,
    "--key",
    key,
    "--endpoint-url",
    opts.endpoint,
    outfile,
  ]);
  try {
    if (res.status === 0) {
      const bytes = readFileSync(outfile);
      return {
        outcome: "found",
        shasum: createHash("sha1").update(bytes).digest("hex"),
        size: bytes.length,
      };
    }
    if (/\(404\)|Not Found|NoSuchKey/i.test(res.stderr)) {
      return { outcome: "missing" };
    }
    return { outcome: "unreachable", detail: res.stderr.trim().slice(0, 200) };
  } finally {
    try {
      unlinkSync(outfile);
    } catch {
      // get-object never wrote the file (missing/unreachable) — nothing to remove.
    }
  }
}

/** GET every row with a bounded pool (chunked Promise.all — no dependency). */
async function fetchAllFromR2(
  rows: readonly SidecarRow[],
  opts: R2FetchOpts,
): Promise<Map<string, FetchOutcome>> {
  const map = new Map<string, FetchOutcome>();
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const chunk = rows.slice(i, i + CONCURRENCY);
    const outcomes = await Promise.all(
      chunk.map((r) => fetchOneFromR2(r.key, opts)),
    );
    chunk.forEach((r, j) => {
      map.set(r.key, outcomes[j] as FetchOutcome);
    });
  }
  return map;
}

async function main(): Promise<void> {
  const accountId = process.env.R2_ACCOUNT_ID;
  if (accountId === undefined || accountId === "") {
    process.stderr.write(
      "r2-parity-probe: fatal: R2_ACCOUNT_ID is not set — cannot build the R2 endpoint\n",
    );
    process.exit(1);
  }
  const rows = sidecarRows(readSidecar());
  if (rows.length === 0) {
    process.stdout.write(
      "r2-parity-probe: tarballs.json is empty — nothing to probe\n",
    );
    process.exit(0);
  }
  const tmpDir = mkdtempSync(join(tmpdir(), "r2-parity-"));
  // Exit AFTER the finally — process.exit inside the try would skip the tmpDir cleanup.
  let exitCode: number;
  try {
    const fetched = await fetchAllFromR2(rows, {
      bucket: R2_BUCKET,
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      tmpDir,
    });
    const report = computeR2Parity(rows, fetched);
    process.stdout.write(`${renderReport(report)}\n`);
    exitCode = report.drift ? 1 : 0;
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
  process.exit(exitCode);
}

if (import.meta.main) {
  void main();
}
