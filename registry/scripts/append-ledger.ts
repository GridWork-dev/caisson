// The registry ledger appender (ADR-0021/0069) — CI-only. Appends one validated LedgerEntry to
// `registry/ledger.jsonl` after a module passes the standards gate. The caller supplies the CI
// clock's publishedAt — NEVER derived inside this function (determinism: no Date.now(),
// no new Date()). The append is fail-closed: the file is written only after ALL validations pass.
//
// Round-trip guarantee: after appending, rebuilding the index from the modified ledger via
// `buildIndexFromLedgerFile` produces a byte-identical result to a direct build from the same
// file — the appended entry is indistinguishable from a hand-crafted ledger line.
import { appendFileSync } from "node:fs";
import { ModuleManifest } from "../schema/module-manifest";
import { LEDGER_PATH, LedgerEntry } from "./build-index";

export type AppendLedgerOpts = {
  /** The just-gated manifest. Validated against ModuleManifest — throws on malformed. */
  manifest: ModuleManifest;
  /** ISO 8601 timestamp from the CI clock; NEVER derived inside this function. */
  publishedAt: string;
  /** Gate provenance: "<ci-run-id>@<commit-sha>". */
  gateAttestation: string;
  /** Override for isolated testing; defaults to the on-disk registry/ledger.jsonl. */
  ledgerPath?: string | undefined;
};

/**
 * Append a validated LedgerEntry to the ledger file (ADR-0021/0069).
 *
 * Validates manifest → assembles the full LedgerEntry → validates again → appends.
 * A malformed manifest or any invalid field throws before the file is touched (fail-closed).
 * publishedAt is taken from opts — the function never reads the system clock.
 */
export function appendLedger(opts: AppendLedgerOpts): LedgerEntry {
  const { publishedAt, gateAttestation, ledgerPath = LEDGER_PATH } = opts;

  // Re-validate the manifest at the ledger write boundary: a caller that skips parse-or-throw
  // must not silently propagate a malformed manifest into the permanent ledger record.
  const manifest = ModuleManifest.parse(opts.manifest);

  // Build + validate the full LedgerEntry from the validated manifest fields.
  const entry = LedgerEntry.parse({
    id: manifest.id,
    version: manifest.version,
    manifest,
    publishedAt,
    gateAttestation,
  });

  // Single-line JSON + newline — the exact JSONL format parseLedger expects.
  appendFileSync(ledgerPath, `${JSON.stringify(entry)}\n`);

  return entry;
}
