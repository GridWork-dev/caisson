#!/usr/bin/env bun
/**
 * audit-harness — the advisory cross-domain audit CLI (ADR-0134/0188). ADVISORY (ADR-0134
 * Rejected #3): the reconcile/report paths ALWAYS exit 0 — the harness informs, it never gates a
 * merge. Only a usage error (missing required scope) exits non-zero.
 *
 * Subcommands:
 *   reconcile --domains=security,rls-tenancy [findings.json]   (default when no subcommand given)
 *       Reconcile a fresh run against audit-ledger.toml, rewrite it, print the tally.
 *       --domains  REQUIRED (ADR-0188 / F4): the domains actually audited this run. Only findings in
 *                  these domains are eligible to close; everything else passes through unchanged.
 *                  Omitting it aborts (a missing scope would silently false-close un-audited domains).
 *       [path]     optional JSON array of raw findings; reads stdin when omitted.
 *   check-scope --domains=<declared> [--base=<ref>]
 *       Flag any git-diff-touched path that falls in a domain's globs NOT in --domains (scope creep).
 *       Emits a findings JSON array to stdout. --base defaults to HEAD.
 *   report
 *       Print counts by domain / severity / status + the open-high list from the current ledger.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { coverageGrid, parseCoverage } from "./coverage.ts";
import { deriveDomains, domainIds } from "./domains.ts";
import {
  parseFindings,
  reconcile,
  serializeFindings,
  type RawFinding,
} from "./findings.ts";
import { checkScope } from "./scope-guard.ts";
import { summarize } from "./surface.ts";

// The persisted cross-run ledger + coverage ledger live at the audit home (outputs/audit/), the
// committed source of truth the driver reconciles against — not inside this internal package.
const AUDIT_DIR = join(import.meta.dir, "..", "..", "..", "outputs", "audit");
const LEDGER = join(AUDIT_DIR, "ledger.toml");
const COVERAGE = join(AUDIT_DIR, "coverage.toml");
const args = process.argv.slice(2);
const SUBCOMMANDS = new Set(["reconcile", "check-scope", "report"]);
const sub = args[0] && SUBCOMMANDS.has(args[0]) ? args[0] : "reconcile";

/** Parse the required `--domains=a,b,c` scope list (empty when the flag is absent). */
function parseDomains(): string[] {
  const arg = args.find((a) => a.startsWith("--domains"));
  return (arg?.split("=")[1] ?? "")
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);
}

/** The derived audit surface reduced to `{ id: globs }` (for scope-guard). */
function domainGlobs(): Record<string, string[]> {
  return Object.fromEntries(deriveDomains().map((d) => [d.id, d.globs]));
}

async function readRaw(path: string | undefined): Promise<RawFinding[]> {
  const text = path ? readFileSync(path, "utf8") : await Bun.stdin.text();
  if (!text.trim()) return [];
  return JSON.parse(text) as RawFinding[];
}

function loadLedger(): ReturnType<typeof parseFindings> {
  return existsSync(LEDGER) ? parseFindings(readFileSync(LEDGER, "utf8")) : [];
}

if (sub === "check-scope") {
  // git via execFileSync arg-array (never a shell string — security floor). --base is a caller-
  // supplied ref; passed as its own argv element, so it can never inject a flag or command.
  const baseArg = args.find((a) => a.startsWith("--base"));
  const base = baseArg?.split("=")[1];
  const gitArgs = base
    ? ["diff", "--name-only", base]
    : ["diff", "--name-only", "HEAD"];
  const touched = execFileSync("git", gitArgs, { encoding: "utf8" })
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const findings = checkScope(parseDomains(), touched, domainGlobs());
  process.stdout.write(`${JSON.stringify(findings, null, 2)}\n`);
  process.exit(0);
}

if (sub === "report") {
  const s = summarize(loadLedger());
  const line = (label: string, rec: Record<string, number>): string =>
    `  ${label}: ${
      Object.entries(rec)
        .filter(([, n]) => n > 0)
        .map(([k, n]) => `${k}=${String(n)}`)
        .join(" · ") || "(none)"
    }`;
  const coverageRows = existsSync(COVERAGE)
    ? parseCoverage(readFileSync(COVERAGE, "utf8"))
    : [];
  process.stdout.write(
    `audit-harness report — ${String(s.total)} finding(s) in ledger\n` +
      `${line("by domain", s.byDomain)}\n` +
      `${line("by severity", s.bySeverity)}\n` +
      `${line("by status", s.byStatus)}\n` +
      `  open-high (validate candidates): ${String(s.openHigh.length)}\n` +
      s.openHigh
        .map((f) => `    · [${f.domain}] ${f.subject} — ${f.title}\n`)
        .join("") +
      `  coverage grid (${String(coverageRows.length)} cell-round(s)):\n` +
      `${coverageGrid(coverageRows)}\n`,
  );
  process.exit(0);
}

// default: reconcile (requires --domains)
const scope = parseDomains();
if (scope.length === 0) {
  process.stderr.write(
    "audit-harness reconcile: --domains=<comma,list> is required (the domains audited this run).\n",
  );
  process.exit(2);
}
const positional = args.filter(
  (a) => !a.startsWith("--") && !SUBCOMMANDS.has(a),
);
const current = await readRaw(positional[0]);
// Pass the derived domain universe so a mislabeled domain aborts the run (fail-loud, ADR-0233).
const { ledger, classes } = reconcile(
  loadLedger(),
  current,
  scope,
  domainIds(),
);
writeFileSync(LEDGER, serializeFindings(ledger));

const tally = { new: 0, regressed: 0, closed: 0, unchanged: 0 };
for (const c of Object.values(classes)) tally[c]++;
process.stdout.write(
  `audit-harness: ${ledger.length} in ledger · ${tally.new} new · ${tally.regressed} regressed · ` +
    `${tally.closed} closed · ${tally.unchanged} unchanged (advisory — never blocks)\n`,
);
process.exit(0);
