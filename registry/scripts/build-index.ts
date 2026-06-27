// The registry index builder (ADR-0021/0047) — CI-only. Regenerates `registry/index.json`
// DETERMINISTICALLY from the git-tracked version ledger `registry/ledger.jsonl`. The index is never
// hand-appended: a CI job runs this and fails if the committed file is not byte-identical to a fresh
// rebuild (proving the file is CI-built; CODEOWNERS gates hand-edits). The ledger stores each gated
// publish's HISTORICAL manifest snapshot, which a live registry enumeration could not recover.
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

/** Parse the JSONL ledger, skipping blank lines. Parse-or-throw per line (never a cast). */
export function parseLedger(text: string): LedgerEntry[] {
  const entries: LedgerEntry[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] as string).trim();
    if (line.length === 0) continue;
    try {
      entries.push(LedgerEntry.parse(JSON.parse(line)));
    } catch (e) {
      throw new Error(`ledger.jsonl line ${i + 1}: ${(e as Error).message}`);
    }
  }
  return entries;
}

/** Compare two semver core strings (x.y.z[-pre]); release > prerelease; numeric core compare. */
export function compareSemver(a: string, b: string): number {
  const core = (v: string): { nums: number[]; pre: string | null } => {
    const [main, pre] = v.split("-", 2);
    const nums = (main as string).split(".").map((n) => Number.parseInt(n, 10));
    return { nums, pre: pre ?? null };
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

/** Build the validated index object from ledger entries (pure — no file IO). */
export function buildIndex(entries: readonly LedgerEntry[]): RegistryIndex {
  const byId = new Map<string, LedgerEntry[]>();
  for (const e of entries) {
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
  return serializeIndex(
    buildIndex(parseLedger(readFileSync(ledgerPath, "utf8"))),
  );
}

if (import.meta.main) {
  const bytes = buildIndexFromLedgerFile();
  writeFileSync(INDEX_PATH, bytes);
  // A CI build script reports what it wrote (process.stdout, not console — no-console floor).
  process.stdout.write(
    `registry: built index.json (${bytes.length} bytes) from ledger.jsonl\n`,
  );
}
