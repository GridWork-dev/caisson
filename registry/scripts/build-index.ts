// The registry index builder (ADR-0021/0047) — CI-only. Regenerates `registry/index.json`
// DETERMINISTICALLY from the git-tracked version ledger `registry/ledger.jsonl`. The index is never
// hand-appended: a CI job runs this and fails if the committed file is not byte-identical to a fresh
// rebuild — that byte-identical check DETECTS any hand-edit (it goes red). PREVENTION (blocking the
// merge of a red rebuild) additionally needs branch protection with the `registry-index` job
// required + CODEOWNERS on a real handle — an operator GitHub setting tracked on the forks board.
// The ledger stores each gated publish's HISTORICAL manifest snapshot, which a live registry
// enumeration could not recover.
//
// Determinism: no Date.now() (publishedAt comes from the ledger), modules sorted by id, versions
// sorted by semver ascending, fixed key order, 2-space JSON + trailing newline.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import {
  type RegistryIndex,
  RegistryIndex as RegistryIndexSchema,
  RegistryVersion,
} from "../schema/registry-index";

const REGISTRY_DIR = join(import.meta.dir, "..");
export const LEDGER_PATH = join(REGISTRY_DIR, "ledger.jsonl");
export const INDEX_PATH = join(REGISTRY_DIR, "index.json");

const MODULE_ID_RE = /^@caisson\/[a-z0-9-]+$/;

/** One ledger line = one gated publish: the module id + that version's RegistryVersion record. */
export const LedgerEntry = RegistryVersion.extend({
  id: z.string().regex(MODULE_ID_RE),
}).strict();
export type LedgerEntry = z.infer<typeof LedgerEntry>;

/** A delist line (ADR-0271): an APPEND that removes the module's entry from every future index
 *  rebuild. The publish lines above it stay in the ledger forever (ADR-0006 append-only) — history
 *  and tarball provenance are preserved; only the served index surface drops the module. Terminal:
 *  a later publish line for a delisted id is a ledger error (an explicit re-list mechanism can be
 *  added when a real need appears — silent resurrection is the failure mode this forbids). */
export const DelistEntry = z
  .object({
    op: z.literal("delist"),
    id: z.string().regex(MODULE_ID_RE),
    delistedAt: z.string().datetime(),
    reason: z.string().min(1).max(500),
  })
  .strict();
export type DelistEntry = z.infer<typeof DelistEntry>;

export type ParsedLedger = {
  publishes: LedgerEntry[];
  delists: DelistEntry[];
};

/** Parse the JSONL ledger into publish + delist lines, skipping blanks. Parse-or-throw per line
 *  (never a cast). Order rules enforced here, where line order is visible: a delist must follow at
 *  least one publish of its id, an id is delisted at most once, and no publish may follow its
 *  delist. */
export function parseLedgerLines(text: string): ParsedLedger {
  const publishes: LedgerEntry[] = [];
  const delists: DelistEntry[] = [];
  const publishedIds = new Set<string>();
  const delistedIds = new Set<string>();
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] as string).trim();
    if (line.length === 0) continue;
    let raw: unknown;
    try {
      raw = JSON.parse(line);
    } catch (e) {
      throw new Error(`ledger.jsonl line ${i + 1}: ${(e as Error).message}`);
    }
    const isDelist =
      typeof raw === "object" &&
      raw !== null &&
      (raw as { op?: unknown }).op === "delist";
    try {
      if (isDelist) {
        const d = DelistEntry.parse(raw);
        if (!publishedIds.has(d.id)) {
          throw new Error(`delist of ${d.id} has no prior publish line`);
        }
        if (delistedIds.has(d.id)) {
          throw new Error(`duplicate delist of ${d.id}`);
        }
        delistedIds.add(d.id);
        delists.push(d);
      } else {
        const e = LedgerEntry.parse(raw);
        if (delistedIds.has(e.id)) {
          throw new Error(
            `publish of ${e.id}@${e.version} after its delist — delisting is terminal`,
          );
        }
        publishedIds.add(e.id);
        publishes.push(e);
      }
    } catch (e) {
      throw new Error(`ledger.jsonl line ${i + 1}: ${(e as Error).message}`);
    }
  }
  return { publishes, delists };
}

/** Parse the JSONL ledger and return the PUBLISH lines only — the view every already-shipped
 *  consumer (appender, publish step, parity tests) wants. Delist lines are still fully validated
 *  (shape + order) on this path; they are just not returned. */
export function parseLedger(text: string): LedgerEntry[] {
  return parseLedgerLines(text).publishes;
}

/** Compare two semver strings (x.y.z[-pre][+build]); release > prerelease; numeric core compare.
 *  Build metadata is ignored in precedence (SemVer §10); the FULL prerelease string compares (so
 *  `-alpha-1` vs `-alpha-2` are distinct, not truncated at the first hyphen). */
export function compareSemver(a: string, b: string): number {
  const core = (v: string): { nums: number[]; pre: string | null } => {
    // Strip build metadata first (everything from the first `+`), then split on the FIRST hyphen
    // only — the prerelease may itself contain hyphens (`1.0.0-alpha-1`).
    const noBuild = (v.split("+", 1)[0] as string).trim();
    const dash = noBuild.indexOf("-");
    const main = dash < 0 ? noBuild : noBuild.slice(0, dash);
    const pre = dash < 0 ? null : noBuild.slice(dash + 1);
    const nums = main.split(".").map((n) => Number.parseInt(n, 10));
    return { nums, pre };
  };
  const ca = core(a);
  const cb = core(b);
  for (let i = 0; i < 3; i++) {
    const d = (ca.nums[i] ?? 0) - (cb.nums[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  if (ca.pre === cb.pre) return 0;
  if (ca.pre === null) return 1; // release > prerelease
  if (cb.pre === null) return -1;
  return ca.pre < cb.pre ? -1 : 1;
}

/** Build the validated index object from ledger entries (pure — no file IO). A delisted id keeps
 *  its publish lines in the ledger but contributes NO index entry (ADR-0271) — it leaves the
 *  discovery/membership surface entirely. */
export function buildIndex(
  entries: readonly LedgerEntry[],
  delists: readonly DelistEntry[] = [],
): RegistryIndex {
  const delisted = new Set(delists.map((d) => d.id));
  const byId = new Map<string, LedgerEntry[]>();
  for (const e of entries) {
    if (delisted.has(e.id)) continue;
    const list = byId.get(e.id) ?? [];
    list.push(e);
    byId.set(e.id, list);
  }

  const modules = [...byId.keys()].sort().map((id) => {
    const versions = [...(byId.get(id) as LedgerEntry[])].sort((a, b) =>
      compareSemver(a.version, b.version),
    );
    const seen = new Set<string>();
    for (const v of versions) {
      if (seen.has(v.version)) {
        throw new Error(
          `duplicate version ${v.version} for ${id} in the ledger`,
        );
      }
      seen.add(v.version);
    }
    const latest = versions.reduce((acc, v) =>
      compareSemver(v.version, acc.version) > 0 ? v : acc,
    ).version;
    return {
      id,
      latest,
      // Strip the ledger-only `id` field → each version is a clean RegistryVersion.
      versions: versions.map(({ id: _id, ...v }) => v),
    };
  });

  // Parse-or-throw: the assembled object must satisfy the index schema before it can be written.
  return RegistryIndexSchema.parse({ schemaVersion: 1, modules });
}

/** Deterministic serialization — the exact bytes the CI byte-identical check compares. */
export function serializeIndex(index: RegistryIndex): string {
  return `${JSON.stringify(index, null, 2)}\n`;
}

/** Build the index from the on-disk ledger and return its serialized bytes (no write). */
export function buildIndexFromLedgerFile(ledgerPath = LEDGER_PATH): string {
  const { publishes, delists } = parseLedgerLines(
    readFileSync(ledgerPath, "utf8"),
  );
  return serializeIndex(buildIndex(publishes, delists));
}

if (import.meta.main) {
  const bytes = buildIndexFromLedgerFile();
  writeFileSync(INDEX_PATH, bytes);
  // A CI build script reports what it wrote (process.stdout, not console — no-console floor).
  process.stdout.write(
    `registry: built index.json (${bytes.length} bytes) from ledger.jsonl\n`,
  );
}
