// registry/scripts/prune-versions.ts — version-level delist / prune CLI (ADR-0359, CAISSON-125).
//
// Extends the ADR-0271 module-level delist to VERSION granularity, for the R2-404 backlog: 93
// superseded tarball versions advertise a registry/tarballs.json row for an R2 object that no
// longer exists. This tool stops ADVERTISING them — it never touches R2 (no upload, no delete).
//
// A target (id, version) falls into exactly one of two classes, handled differently:
//
//   1. LIVE MODULE (the common case — 87 of the real 93): appends an append-only version-delist
//      line to registry/ledger.jsonl, rebuilds registry/index.json to exclude that one version
//      (every other version of the module is unaffected), and removes the matching
//      registry/tarballs.json row. Fail-closed: refuses (does not apply) a pair that has no prior
//      publish line, or that is the module's CURRENT latest version — delisting `latest` would
//      silently re-point what `bun add` resolves; buildIndex independently re-asserts this too.
//
//   2. ALREADY MODULE-DELISTED (6 of the real 93 — agent-dev/ai-kit/local-ai, ADR-0271): the whole
//      module already carries zero index entries, so a version-delist under it would be redundant
//      ledger noise (parseLedgerLines rejects one). Only the stale tarballs.json row is removed —
//      NO ledger line is appended for these.
//
// Both classes ALWAYS physically remove the tarballs.json row when present (ADR-0359 Q2 — prune,
// not backfill: the row is deleted outright, not just excluded from index.json).
//
// --missing-file <path> lines: one `@caisson/<slug>@<version>` pair per line (the primary,
// documented form — matches a tarballs.json/ledger key exactly). Blank lines and `#`-comments are
// skipped. The R2 object-key form `<slug>/<slug>-<version>.tgz` is also accepted. A pasted
// r2-parity-probe.ts MISSING report line pastes straight in (its key is extracted and parsed the
// same way); other probe report lines (OK, HASH-MISMATCH, the header/summary lines) are rejected
// — grep MISSING first when pasting a full report.
//
// Defaults to dry-run (prints the plan only, writes nothing); --write applies. Idempotent: a pair
// already carrying a version-delist is skipped loudly (status "already-delisted"), not an error —
// a re-run over the same file converges to a no-op.
import {
  appendFileSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { z } from "zod";
import {
  DelistEntry,
  INDEX_PATH,
  LEDGER_PATH,
  buildIndex,
  compareSemver,
  parseLedgerLines,
  serializeIndex,
} from "./build-index";
import {
  SIDECAR_PATH,
  type Sidecar,
  readSidecar,
  writeSidecar,
} from "./ci-publish-step";

// ---------------------------------------------------------------------------
// --missing-file line parsing
// ---------------------------------------------------------------------------

export interface PruneTarget {
  readonly id: string; // "@caisson/auth"
  readonly version: string; // "1.0.0"
  readonly key: string; // "@caisson/auth@1.0.0" — the ledger delist target + tarballs.json key
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Matches an r2-parity-probe.ts renderReport MISSING line's status + key prefix (after this
 *  function's own leading-whitespace trim has already eaten the report's 2-space indent):
 *  "MISSING" + the padEnd(14) padding + the explicit template space, then the R2 key, then the
 *  " — " before the detail. Captures the key. Every other status (OK, HASH-MISMATCH,
 *  SIZE-MISMATCH, UNREACHABLE) and the header/summary lines deliberately do NOT match. */
const MISSING_REPORT_LINE = /^MISSING\s+(\S+)\s+—/u;

/**
 * Parse one `--missing-file` line. Primary (documented) form: `@caisson/<slug>@<version>`. Also
 * accepts the R2 object-key form `<slug>/<slug>-<version>.tgz`, including a pasted
 * r2-parity-probe.ts MISSING report line (its key is extracted via MISSING_REPORT_LINE and parsed
 * the same way) — every other report line (OK, header, summary) is rejected. Blank lines and
 * `#`-comments are skipped (null); malformed non-blank lines are also skipped — the caller counts
 * + reports them rather than aborting the whole file.
 */
export function parsePruneLine(raw: string): PruneTarget | null {
  const line = raw.trim();
  if (line === "" || line.startsWith("#")) return null;

  if (line.startsWith("@caisson/")) {
    const at = line.lastIndexOf("@");
    if (at <= 0) return null; // no version separator beyond the leading scope '@'
    const id = line.slice(0, at);
    const version = line.slice(at + 1);
    const slug = id.slice("@caisson/".length);
    if (slug === "" || version === "" || !SLUG_PATTERN.test(slug)) return null;
    return { id, version, key: `${id}@${version}` };
  }

  const r2Line = MISSING_REPORT_LINE.exec(line)?.[1] ?? line;
  const match = /^([a-z0-9-]+)\/\1-(.+)\.tgz$/.exec(r2Line);
  const slug = match?.[1];
  const version = match?.[2];
  if (slug === undefined || version === undefined) return null;
  const id = `@caisson/${slug}`;
  return { id, version, key: `${id}@${version}` };
}

export interface ParsedMissingFile {
  readonly targets: PruneTarget[];
  /** Count of non-blank, non-comment lines that did NOT parse (e.g. a mangled paste, or a raw
   *  r2-parity-probe.ts report paste that still has OK/header/summary lines mixed in). */
  readonly skipped: number;
}

/** Parse a full `--missing-file` text into targets + an unparseable-line count. Pure — no file IO. */
export function parseMissingFileText(text: string): ParsedMissingFile {
  const targets: PruneTarget[] = [];
  let skipped = 0;
  for (const line of text.split("\n")) {
    const parsed = parsePruneLine(line);
    if (parsed === null) {
      if (line.trim() !== "" && !line.trim().startsWith("#")) skipped++;
      continue;
    }
    targets.push(parsed);
  }
  return { targets, skipped };
}

// ---------------------------------------------------------------------------
// Plan (pure — no file IO; unit-testable over a ledger string)
// ---------------------------------------------------------------------------

export type PruneRowStatus =
  | "will-delist" // live module, first time — ledger line appended + sidecar row removed
  | "already-delisted" // live module, version-delist already exists — sidecar row removed only
  | "sidecar-cleanup" // module already module-delisted — sidecar row removed, NO ledger line
  | "not-published" // refused: no prior publish of this exact pair
  | "is-latest"; // refused: would orphan the module's current latest

export interface PruneRow {
  readonly target: PruneTarget;
  readonly status: PruneRowStatus;
  readonly detail: string;
}

export interface PrunePlan {
  readonly rows: PruneRow[];
  /** Targets needing a NEW version-delist ledger line (status "will-delist" only). */
  readonly toApply: PruneTarget[];
  /** Targets whose tarballs.json row should be removed — every row except a refusal. */
  readonly toPruneSidecar: PruneTarget[];
  /** Fail-closed REFUSED rows — never applied, never sidecar-pruned. */
  readonly refused: PruneRow[];
}

/** The highest remaining (non-excluded) version for `id`, or null if none remain. */
function currentLatest(
  versions: readonly string[],
  id: string,
  excludedKeys: ReadonlySet<string>,
): string | null {
  const remaining = versions.filter((v) => !excludedKeys.has(`${id}@${v}`));
  if (remaining.length === 0) return null;
  return remaining.reduce((a, b) => (compareSemver(b, a) > 0 ? b : a));
}

/**
 * Plan a prune run against the current ledger text. Pure — no file IO. Processes targets in
 * order, threading a working set of "would-be delisted" version keys so pruning several versions
 * of the SAME live module in one run is evaluated correctly against each other (a later target's
 * `is-latest` check accounts for earlier targets already queued this run).
 */
export function planPrune(
  targets: readonly PruneTarget[],
  ledgerText: string,
): PrunePlan {
  const { publishes, delists } = parseLedgerLines(ledgerText);
  const publishedVersionKeys = new Set(
    publishes.map((p) => `${p.id}@${p.version}`),
  );
  const delistedModuleIds = new Set(
    delists.filter((d) => d.version === undefined).map((d) => d.id),
  );
  const alreadyDelistedVersionKeys = new Set(
    delists
      .filter((d) => d.version !== undefined)
      .map((d) => `${d.id}@${d.version}`),
  );
  const versionsById = new Map<string, string[]>();
  for (const p of publishes) {
    const list = versionsById.get(p.id) ?? [];
    list.push(p.version);
    versionsById.set(p.id, list);
  }

  const working = new Set(alreadyDelistedVersionKeys);
  const rows: PruneRow[] = [];

  for (const target of targets) {
    const { key } = target;

    // Class 2: the module is already fully gone from the index — a version-delist under it is
    // ledger-invalid (parseLedgerLines rejects it). Only the stale sidecar row needs cleanup.
    if (delistedModuleIds.has(target.id)) {
      rows.push({
        target,
        status: "sidecar-cleanup",
        detail: `${target.id} is already module-delisted — removing the stale tarballs.json row only, no ledger line needed`,
      });
      continue;
    }

    // Class 1 (live module) fail-closed checks below.
    if (!publishedVersionKeys.has(key)) {
      rows.push({
        target,
        status: "not-published",
        detail: `${key} has no publish line in the ledger — refusing`,
      });
      continue;
    }
    if (working.has(key)) {
      rows.push({
        target,
        status: "already-delisted",
        detail: `${key} already carries a version-delist`,
      });
      continue;
    }
    const latest = currentLatest(
      versionsById.get(target.id) ?? [],
      target.id,
      working,
    );
    if (latest === target.version) {
      rows.push({
        target,
        status: "is-latest",
        detail: `${key} is the current latest for ${target.id} — refusing (fail-closed)`,
      });
      continue;
    }
    working.add(key);
    rows.push({
      target,
      status: "will-delist",
      detail: `${key} will be version-delisted`,
    });
  }

  return {
    rows,
    toApply: rows
      .filter((r) => r.status === "will-delist")
      .map((r) => r.target),
    toPruneSidecar: rows
      .filter((r) => r.status !== "not-published" && r.status !== "is-latest")
      .map((r) => r.target),
    refused: rows.filter(
      (r) => r.status === "not-published" || r.status === "is-latest",
    ),
  };
}

// ---------------------------------------------------------------------------
// Apply (writes — ledger append, index rebuild, sidecar row removal)
// ---------------------------------------------------------------------------

export interface ApplyPruneOpts {
  /** Targets needing a new version-delist ledger line (plan.toApply — live-module class only). */
  readonly ledgerTargets: readonly PruneTarget[];
  /** Targets whose tarballs.json row must be removed (plan.toPruneSidecar — superset of the above). */
  readonly sidecarTargets: readonly PruneTarget[];
  /** ISO 8601 UTC timestamp — caller-supplied, never derived internally (determinism). */
  readonly delistedAt: string;
  readonly reason: string;
  readonly ledgerPath?: string | undefined;
  readonly indexPath?: string | undefined;
  readonly sidecarPath?: string | undefined;
}

export interface ApplyPruneResult {
  readonly appended: number;
  readonly indexBytes: number;
  readonly tarballsRemoved: number;
}

/**
 * Apply a validated prune plan. Validates the FULL candidate ledger (existing bytes + the new
 * delist lines) — including buildIndex's fail-closed latest-orphan assert — BEFORE writing
 * anything, so a would-be-invalid application never partially lands (a ledger append with no
 * matching rebuild). Only then: append the delist lines (append-only — existing ledger bytes are
 * never rewritten) and write the rebuilt index.json. When `ledgerTargets` is empty (an
 * all-sidecar-cleanup run), the ledger and index.json are left untouched entirely — zero ledger
 * lines appended, matching the module-already-delisted class. tarballs.json rows are removed for
 * every `sidecarTargets` entry present, regardless of which class it came from.
 */
export function applyPrune(opts: ApplyPruneOpts): ApplyPruneResult {
  const {
    ledgerTargets,
    sidecarTargets,
    delistedAt,
    reason,
    ledgerPath = LEDGER_PATH,
    indexPath = INDEX_PATH,
    sidecarPath = SIDECAR_PATH,
  } = opts;

  let appended = 0;
  let indexBytes = 0;

  if (ledgerTargets.length > 0) {
    const newLines = ledgerTargets
      .map((t) =>
        DelistEntry.parse({
          op: "delist",
          id: t.id,
          version: t.version,
          delistedAt,
          reason,
        }),
      )
      .map((entry) => `${JSON.stringify(entry)}\n`)
      .join("");

    const existingLedgerText = existsSync(ledgerPath)
      ? readFileSync(ledgerPath, "utf8")
      : "";
    const candidateLedgerText = existingLedgerText + newLines;

    // Parse-or-throw + rebuild-or-throw over the FULL candidate ledger before any write — the
    // same fail-closed order the rest of the registry tooling uses (appendLedger, ci-publish-step).
    const { publishes, delists } = parseLedgerLines(candidateLedgerText);
    const bytes = serializeIndex(buildIndex(publishes, delists));

    appendFileSync(ledgerPath, newLines);
    writeFileSync(indexPath, bytes);
    appended = ledgerTargets.length;
    indexBytes = bytes.length;
  }

  let tarballsRemoved = 0;
  if (sidecarTargets.length > 0) {
    const sidecar = readSidecar(sidecarPath);
    const removeKeys = new Set(sidecarTargets.map((t) => t.key));
    const tarballs: Sidecar["tarballs"] = {};
    for (const [key, row] of Object.entries(sidecar.tarballs)) {
      if (removeKeys.has(key)) {
        tarballsRemoved++;
        continue; // physically dropped (ADR-0359 Q2 — prune, not backfill)
      }
      tarballs[key] = row;
    }
    writeSidecar({ ...sidecar, tarballs }, sidecarPath);
  }

  return { appended, indexBytes, tarballsRemoved };
}

export interface RunPruneOpts {
  readonly targets: readonly PruneTarget[];
  readonly skipped: number;
  readonly ledgerText: string;
  readonly write: boolean;
  readonly delistedAt: string;
  readonly reason: string;
  readonly ledgerPath?: string | undefined;
  readonly indexPath?: string | undefined;
  readonly sidecarPath?: string | undefined;
}

export interface RunPruneResult {
  readonly plan: PrunePlan;
  /** null when nothing was (or could be) applied: dry-run, a skipped-line abort, or nothing to apply. */
  readonly applied: ApplyPruneResult | null;
  readonly exitCode: number;
}

/**
 * The CLI's core decide-and-apply step, split out from `main` so the fail-loud contract is
 * testable without spawning a subprocess: `skipped > 0` (any unparseable non-blank, non-comment
 * `--missing-file` line — e.g. a raw probe-report paste that still has OK/header/summary lines in
 * it) refuses to apply ANYTHING, in either mode. `applyPrune` is never called when skipped > 0 —
 * abort BEFORE any write, so a mangled paste can never be mistaken for a clean full run.
 */
export function runPrune(opts: RunPruneOpts): RunPruneResult {
  const plan = planPrune(opts.targets, opts.ledgerText);

  if (opts.skipped > 0) {
    return { plan, applied: null, exitCode: 1 };
  }
  if (!opts.write || plan.toPruneSidecar.length === 0) {
    return { plan, applied: null, exitCode: plan.refused.length > 0 ? 1 : 0 };
  }

  const applied = applyPrune({
    ledgerTargets: plan.toApply,
    sidecarTargets: plan.toPruneSidecar,
    delistedAt: opts.delistedAt,
    reason: opts.reason,
    ledgerPath: opts.ledgerPath,
    indexPath: opts.indexPath,
    sidecarPath: opts.sidecarPath,
  });
  return { plan, applied, exitCode: plan.refused.length > 0 ? 1 : 0 };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

const CliArgs = z.object({
  missingFile: z.string().min(1),
  write: z.boolean(),
  reason: z.string().min(1).max(500),
  delistedAt: z.string().datetime(),
});
type CliArgs = z.infer<typeof CliArgs>;

const DEFAULT_REASON =
  "superseded version pruned — advertised R2 tarball object 404s (CAISSON-125, ADR-0359)";

function parseCliArgs(): CliArgs {
  const argv = process.argv.slice(2);
  let missingFile: string | undefined;
  let write = false; // safe default: never mutate unless explicitly requested
  let reason = DEFAULT_REASON;
  let delistedAt = new Date().toISOString(); // CLI-boundary clock read — never inside the library fns

  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === undefined) break;
    const val = argv[i + 1];
    if (flag === "--missing-file" && val !== undefined) {
      missingFile = val;
      i++;
    } else if (flag === "--write") {
      write = true;
    } else if (flag === "--reason" && val !== undefined) {
      reason = val;
      i++;
    } else if (flag === "--delisted-at" && val !== undefined) {
      delistedAt = val;
      i++;
    }
  }

  if (missingFile === undefined) {
    process.stderr.write(
      "registry/prune-versions: fatal: --missing-file <path> is required\n",
    );
    process.exit(1);
  }
  return CliArgs.parse({ missingFile, write, reason, delistedAt });
}

function main(): void {
  const args = parseCliArgs();
  const { targets, skipped } = parseMissingFileText(
    readFileSync(args.missingFile, "utf8"),
  );

  const label = args.write ? "[live]" : "[dry-run]";
  process.stdout.write(
    `registry/prune-versions: ${label} ${String(targets.length)} target(s) parsed (${String(skipped)} unparseable line(s) skipped)\n`,
  );

  const ledgerText = existsSync(LEDGER_PATH)
    ? readFileSync(LEDGER_PATH, "utf8")
    : "";
  const { plan, applied, exitCode } = runPrune({
    targets,
    skipped,
    ledgerText,
    write: args.write,
    delistedAt: args.delistedAt,
    reason: args.reason,
  });

  for (const row of plan.rows) {
    process.stdout.write(
      `  [${row.status.toUpperCase().padEnd(16)}] ${row.target.key} — ${row.detail}\n`,
    );
  }
  const cleanupOnly = plan.toPruneSidecar.length - plan.toApply.length;
  process.stdout.write(
    `registry/prune-versions: ${String(plan.toApply.length)} to version-delist, ${String(cleanupOnly)} sidecar-only cleanup, ${String(plan.refused.length)} refused\n`,
  );

  if (skipped > 0) {
    process.stderr.write(
      `registry/prune-versions: fatal: ${String(skipped)} unparseable line(s) in ${args.missingFile} — refusing to ${args.write ? "apply anything" : "trust this as a clean plan"}. Blank lines and #-comments are fine; every other line must parse. Pasting a full r2-parity-probe.ts report? grep MISSING first.\n`,
    );
    process.exit(exitCode);
  }

  if (!args.write) {
    process.stdout.write(
      "registry/prune-versions: dry-run — pass --write to apply\n",
    );
    process.exit(exitCode);
  }

  if (applied === null) {
    process.stdout.write("registry/prune-versions: nothing to apply\n");
    process.exit(exitCode);
  }

  process.stdout.write(
    `registry/prune-versions: appended ${String(applied.appended)} delist line(s); rebuilt index.json (${String(applied.indexBytes)} bytes); removed ${String(applied.tarballsRemoved)} tarballs.json row(s)\n`,
  );
  process.exit(exitCode);
}

if (import.meta.main) {
  main();
}
