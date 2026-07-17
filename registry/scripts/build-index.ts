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
const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

/** One ledger line = one gated publish: the module id + that version's RegistryVersion record. */
export const LedgerEntry = RegistryVersion.extend({
  id: z.string().regex(MODULE_ID_RE),
}).strict();
export type LedgerEntry = z.infer<typeof LedgerEntry>;

/** A delist line: an APPEND that removes an entry from every future index rebuild. The publish
 *  lines above it stay in the ledger forever (ADR-0006 append-only) — history and tarball
 *  provenance are preserved; only the served index surface drops the entry.
 *
 *  Two granularities, distinguished by the optional `version` field:
 *  - **Module-level** (`version` absent, ADR-0271): drops the whole module id from the index.
 *    Terminal for the id — a later publish line for a delisted id is a ledger error, and (ADR-0359)
 *    so is a later version-delist for it (the module is already fully gone; a version-delist under
 *    it would be redundant ledger noise). A module-delist MAY follow existing version-delists of
 *    the same id (those become moot, not conflicting).
 *  - **Version-level** (`version` present, ADR-0359 — extends ADR-0271 to version granularity):
 *    drops only that one (id, version) pair from the index; every other version of the module is
 *    unaffected. Terminal for that exact pair — a later publish of the same (id, version) is a
 *    ledger error. Must follow a publish of that exact pair.
 *
 *  Silent resurrection is the failure mode both terminal rules forbid — an explicit re-list
 *  mechanism can be added when a real need appears. */
export const DelistEntry = z
  .object({
    op: z.literal("delist"),
    id: z.string().regex(MODULE_ID_RE),
    /** Present = version-level delist of only this (id, version); absent = module-level (ADR-0271). */
    version: z.string().regex(SEMVER_RE).optional(),
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
 *  (never a cast). Order rules enforced here, where line order is visible:
 *  - Module-level delist: must follow at least one publish of its id; an id is module-delisted at
 *    most once; no publish may follow its module delist; no version-delist of that id may follow
 *    its module delist (ADR-0359 — the module is already fully gone).
 *  - Version-level delist (ADR-0359): must follow a publish of that EXACT (id, version); that
 *    exact pair is version-delisted at most once; no publish of that exact pair may follow its
 *    version delist. A version-delist is itself rejected if its id is already module-delisted. */
export function parseLedgerLines(text: string): ParsedLedger {
  const publishes: LedgerEntry[] = [];
  const delists: DelistEntry[] = [];
  const publishedIds = new Set<string>();
  const publishedVersionKeys = new Set<string>();
  const delistedIds = new Set<string>();
  const delistedVersionKeys = new Set<string>();
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] as string).trim();
    if (line.length === 0) continue;
    let raw: unknown;
    try {
      raw = JSON.parse(line);
    } catch (e) {
      throw new Error(`ledger.jsonl line ${i + 1}: ${(e as Error).message}`, {
        cause: e,
      });
    }
    const isDelist =
      typeof raw === "object" &&
      raw !== null &&
      (raw as { op?: unknown }).op === "delist";
    try {
      if (isDelist) {
        const d = DelistEntry.parse(raw);
        if (d.version !== undefined) {
          // Version-level delist (ADR-0359).
          const versionKey = `${d.id}@${d.version}`;
          if (delistedIds.has(d.id)) {
            throw new Error(
              `version-delist of ${versionKey} — module ${d.id} is already module-delisted`,
            );
          }
          if (!publishedVersionKeys.has(versionKey)) {
            throw new Error(
              `version-delist of ${versionKey} has no prior publish line`,
            );
          }
          if (delistedVersionKeys.has(versionKey)) {
            throw new Error(`duplicate delist of ${versionKey}`);
          }
          delistedVersionKeys.add(versionKey);
        } else {
          // Module-level delist (ADR-0271) — unchanged; may follow existing version-delists.
          if (!publishedIds.has(d.id)) {
            throw new Error(`delist of ${d.id} has no prior publish line`);
          }
          if (delistedIds.has(d.id)) {
            throw new Error(`duplicate delist of ${d.id}`);
          }
          delistedIds.add(d.id);
        }
        delists.push(d);
      } else {
        const e = LedgerEntry.parse(raw);
        const versionKey = `${e.id}@${e.version}`;
        if (delistedIds.has(e.id)) {
          throw new Error(
            `publish of ${e.id}@${e.version} after its delist — delisting is terminal`,
          );
        }
        if (delistedVersionKeys.has(versionKey)) {
          throw new Error(
            `publish of ${versionKey} after its version-delist — delisting is terminal`,
          );
        }
        publishedIds.add(e.id);
        publishedVersionKeys.add(versionKey);
        publishes.push(e);
      }
    } catch (e) {
      throw new Error(`ledger.jsonl line ${i + 1}: ${(e as Error).message}`, {
        cause: e,
      });
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

/** Build the validated index object from ledger entries (pure — no file IO). A module-delisted id
 *  keeps its publish lines in the ledger but contributes NO index entry (ADR-0271) — it leaves the
 *  discovery/membership surface entirely. A version-delisted (id, version) pair (ADR-0359) keeps
 *  its publish line too but is excluded from just that module's version list; the module itself
 *  stays listed as long as at least one version survives. */
export function buildIndex(
  entries: readonly LedgerEntry[],
  delists: readonly DelistEntry[] = [],
): RegistryIndex {
  const delistedModuleIds = new Set(
    delists.filter((d) => d.version === undefined).map((d) => d.id),
  );
  const versionDelists = delists.filter(
    (d): d is DelistEntry & { version: string } => d.version !== undefined,
  );
  const delistedVersionKeys = new Set(
    versionDelists.map((d) => `${d.id}@${d.version}`),
  );
  const byId = new Map<string, LedgerEntry[]>();
  for (const e of entries) {
    if (delistedModuleIds.has(e.id)) continue;
    if (delistedVersionKeys.has(`${e.id}@${e.version}`)) continue;
    const list = byId.get(e.id) ?? [];
    list.push(e);
    byId.set(e.id, list);
  }

  // Fail-closed (ADR-0359): a version-delist may never orphan `latest` — the module's TRUE latest
  // (the highest version ever published for a still-live id) must survive version-level pruning.
  // Prune is only ever meant for superseded, non-latest versions; a delist targeting what would be
  // latest is a tooling/ledger bug, not a valid prune — throw rather than silently re-pointing the
  // served `latest` dist-tag to a different version.
  const trueLatestById = new Map<string, string>();
  for (const e of entries) {
    if (delistedModuleIds.has(e.id)) continue; // no `latest` concept for a fully-gone module
    const cur = trueLatestById.get(e.id);
    if (cur === undefined || compareSemver(e.version, cur) > 0) {
      trueLatestById.set(e.id, e.version);
    }
  }
  for (const d of versionDelists) {
    if (trueLatestById.get(d.id) === d.version) {
      throw new Error(
        `version-delist of ${d.id}@${d.version} would orphan latest — delisting the current latest version is not allowed`,
      );
    }
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
