#!/usr/bin/env bun
/**
 * design-critic-reconcile — reconcile a fresh critic run against the persisted findings.toml, write
 * the merged ledger back, print the per-id classification. ADVISORY (ADR-0099 Layer 3): this ALWAYS
 * exits 0 — the critic informs, it never gates a merge.
 *
 * Input: a JSON array of raw findings ({workflow, surface, title, severity, status?}) from a path arg
 * or stdin. Output: the rewritten findings.toml + a one-line tally.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseFindings,
  reconcile,
  serializeFindings,
  type RawFinding,
} from "./findings";

const LEDGER = join(import.meta.dir, "..", "findings.toml");

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
  `design-critic: ${ledger.length} in ledger · ${tally.new} new · ${tally.regressed} regressed · ` +
    `${tally.closed} closed · ${tally.unchanged} unchanged (advisory — never blocks)\n`,
);
process.exit(0);
