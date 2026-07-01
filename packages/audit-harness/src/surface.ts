// Producer-side enablers for the audit pipeline (ADR-0188). Pure/near-pure helpers the external
// dispatcher + orchestration skill compose to turn the declared audit surface (./domains.ts) into a
// concrete file list and to make a reconciled ledger legible. The package still owns NO model call
// and NO dispatch — those live in the skill (AGENTS.md / ADR-0134 boundary).
import { join } from "node:path";
import type { AuditDomain } from "./domains.ts";
import type { Finding, FindingSeverity, FindingStatus } from "./findings.ts";

/** Repo root — three levels up from packages/audit-harness/src. */
const REPO_ROOT = join(import.meta.dir, "..", "..", "..");

// Vendor / build output dirs never belong in an audit surface even when a domain glob would reach
// them (e.g. a dependency shipping its own `src/`).
const IGNORED = /(^|\/)(node_modules|dist|\.next|\.turbo|coverage)(\/|$)/;

/**
 * Resolve a domain's declared `globs` (./domains.ts) to a concrete, sorted, de-duplicated list of
 * repo-relative file paths that exist on disk. Uses `Bun.Glob` — the same matcher `scope-guard.ts`
 * already relies on. Overlapping globs collapse to one entry per file; vendor/build dirs are excluded.
 */
export function enumerateSurface(
  domain: AuditDomain,
  root: string = REPO_ROOT,
): string[] {
  const out = new Set<string>();
  for (const glob of domain.globs) {
    for (const p of new Bun.Glob(glob).scanSync({
      cwd: root,
      onlyFiles: true,
      dot: false,
    })) {
      if (!IGNORED.test(p)) out.add(p);
    }
  }
  return [...out].sort();
}

/**
 * The high-risk, still-open findings — the only ones eligible for the `/validate` escalation
 * (ADR-0134 §4). Pure filter over a reconciled ledger.
 */
export function selectValidateCandidates(ledger: Finding[]): Finding[] {
  return ledger.filter((f) => f.severity === "high" && f.status === "open");
}

export interface LedgerSummary {
  total: number;
  byDomain: Record<string, number>;
  bySeverity: Record<FindingSeverity, number>;
  byStatus: Record<FindingStatus, number>;
  /** The open-high findings (= `selectValidateCandidates`), surfaced for the report. */
  openHigh: Finding[];
}

/** Post-run legibility: counts by domain / severity / status + the open-high list. Pure. */
export function summarize(ledger: Finding[]): LedgerSummary {
  const byDomain: Record<string, number> = {};
  const bySeverity: Record<FindingSeverity, number> = {
    info: 0,
    warn: 0,
    high: 0,
  };
  const byStatus: Record<FindingStatus, number> = {
    open: 0,
    accepted: 0,
    fixed: 0,
  };
  for (const f of ledger) {
    byDomain[f.domain] = (byDomain[f.domain] ?? 0) + 1;
    bySeverity[f.severity]++;
    byStatus[f.status]++;
  }
  return {
    total: ledger.length,
    byDomain,
    bySeverity,
    byStatus,
    openHigh: selectValidateCandidates(ledger),
  };
}
