#!/usr/bin/env bun
/**
 * audit-harness-reconcile — reconcile a fresh cross-domain audit run against the persisted
 * audit-ledger.toml, write the merged ledger back, print the per-id classification. ADVISORY
 * (ADR-0134 Rejected #3): this ALWAYS exits 0 — the harness informs, it never gates a merge.
 *
 * Input: a JSON array of raw findings ({domain, subject, title, severity, status?}) from a path arg
 * or stdin. Output: the rewritten audit-ledger.toml + a one-line tally.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseFindings,
  reconcile,
  serializeFindings,
  type RawFinding,
} from "./findings.ts";

const LEDGER = join(import.meta.dir, "..", "audit-ledger.toml");

async function readRaw(arg: string | undefined): Promise<RawFinding[]> {
  const text = arg ? readFileSync(arg, "utf8") : await Bun.stdin.text();
  if (!text.trim()) return [];
  return JSON.parse(text) as RawFinding[];
}

const current = await readRaw(process.argv[2]);
const previous = existsSync(LEDGER)
  ? parseFindings(readFileSync(LEDGER, "utf8"))
  : [];
const { ledger, classes } = reconcile(previous, current);
writeFileSync(LEDGER, serializeFindings(ledger));

const tally = { new: 0, regressed: 0, closed: 0, unchanged: 0 };
for (const c of Object.values(classes)) tally[c]++;
process.stdout.write(
  `audit-harness: ${ledger.length} in ledger · ${tally.new} new · ${tally.regressed} regressed · ` +
    `${tally.closed} closed · ${tally.unchanged} unchanged (advisory — never blocks)\n`,
);
process.exit(0);
