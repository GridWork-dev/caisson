// Registry topological backfill driver (ADR-0021/0069) — CI-only. Takes the full set of
// workspace module manifests, runs a Kahn topological sort over the `dependencies` DAG, and
// calls the injected publisher for each eligible module in dependency order. Absent editions
// (no manifest present in the provided set) are SKIPPED, not an error. The bootstrap case
// (empty allowlist, ADR-0021 first publish) is handled correctly: every manifest is eligible
// when nothing has been published yet.
//
// Determinism: Kahn tie-break is lexicographic ascending by module id, so the output order
// is stable across runs for identical input (no Map-insertion-order reliance).
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ModuleManifest } from "../schema/module-manifest.ts";
import { parseLedgerLines } from "./build-index.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Publisher injected by the caller; a test spy or a live `appendLedger` wrapper. */
export type PublisherFn = (manifest: ModuleManifest) => void | Promise<void>;

export type BackfillOpts = {
  /** All workspace manifests to consider for publishing. */
  manifests: readonly ModuleManifest[];
  /**
   * Already-published ids derived from `moduleAllowlist(index)` (ADR-0021). The empty-set
   * bootstrap case (no prior publishes) is valid: every manifest in `manifests` is eligible.
   */
  allowlist: ReadonlySet<string>;
  /**
   * Called once per eligible module in topological dependency order (dependencies before
   * dependents). Test-injectable — the real CI caller wraps `appendLedger` here.
   */
  publish: PublisherFn;
  /**
   * Raw `registry/ledger.jsonl` text (ADR-0271), parsed here via `parseLedgerLines` to derive
   * the delisted id set. This driver is dead code today — nothing wires it into CI
   * (`ci-publish-step.ts` scans manifests directly) — but if it is ever revived, publishing a
   * delisted module would append a ledger line AFTER that id's delist line, and
   * `parseLedgerLines` throws on the next rebuild ("publish ... after its delist — delisting is
   * terminal"). Guarding here means a future caller can't resurrect a delisted module by
   * accident. Optional; defaults to `""` (no delists) so existing callers are unaffected.
   */
  ledgerText?: string;
};

// ---------------------------------------------------------------------------
// Kahn topological sort
// ---------------------------------------------------------------------------

/**
 * Kahn topological sort over the manifest dependency DAG (ADR-0021/0003).
 *
 * - Only edges within `manifests` are counted; an absent dependency skips that edge so a
 *   node whose dependency is absent is NOT blocked by it.
 * - Tie-break: lexicographic ascending by module id — output is deterministic.
 * - Throws if a cycle is detected (ADR-0003 down-only invariant: cycles are a manifest error).
 */
export function topoSort(
  manifests: readonly ModuleManifest[],
): ModuleManifest[] {
  const byId = new Map<string, ModuleManifest>();
  for (const m of manifests) {
    byId.set(m.id, m);
  }

  // inDegree[id] = count of within-set dependencies not yet processed.
  const inDegree = new Map<string, number>();
  // dependents[dep] = module ids (within-set) that list dep as a dependency.
  const dependents = new Map<string, string[]>();

  for (const m of manifests) {
    if (!inDegree.has(m.id)) inDegree.set(m.id, 0);
    if (!dependents.has(m.id)) dependents.set(m.id, []);

    for (const dep of m.dependencies) {
      if (!byId.has(dep)) continue; // absent dependency — skip this edge
      inDegree.set(m.id, (inDegree.get(m.id) ?? 0) + 1);
      const list = dependents.get(dep) ?? [];
      list.push(m.id);
      dependents.set(dep, list);
    }
  }

  // Seed the queue with zero-in-degree nodes; sort by id for determinism.
  const queue: string[] = [...byId.keys()]
    .filter((id) => (inDegree.get(id) ?? 0) === 0)
    .sort();

  const result: ModuleManifest[] = [];

  while (queue.length > 0) {
    const id = queue.shift() as string;
    result.push(byId.get(id) as ModuleManifest);

    // Decrement in-degree for all dependents of `id`; collect newly-zero ones.
    const unlocked: string[] = [];
    for (const depId of dependents.get(id) ?? []) {
      const newDeg = (inDegree.get(depId) ?? 0) - 1;
      inDegree.set(depId, newDeg);
      if (newDeg === 0) unlocked.push(depId);
    }

    // Merge unlocked ids (sorted) back into the sorted queue to preserve sorted order.
    for (const u of unlocked.sort()) {
      const insertAt = queue.findIndex((q) => q > u);
      queue.splice(insertAt < 0 ? queue.length : insertAt, 0, u);
    }
  }

  if (result.length !== manifests.length) {
    const done = new Set(result.map((m) => m.id));
    const inCycle = [...byId.keys()].filter((id) => !done.has(id)).sort();
    throw new Error(`dependency cycle detected among: ${inCycle.join(", ")}`);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Backfill orchestrator
// ---------------------------------------------------------------------------

/**
 * Run the topological backfill over the provided workspace manifests (ADR-0021/0069).
 *
 * 1. Filters to modules NOT already in `allowlist` — bootstrap (empty allowlist) publishes all.
 * 2. Topologically sorts the remaining modules via `topoSort` — dependencies before dependents.
 * 3. Calls `publish` for each eligible module sequentially (in order), awaiting each call.
 *
 * Absent editions (not present in `manifests`) are silently skipped; their absence does NOT
 * block dependents that ARE present (the edge is simply omitted from the sort).
 */
export async function backfill(opts: BackfillOpts): Promise<void> {
  const { manifests, allowlist, publish, ledgerText = "" } = opts;
  const { delists } = parseLedgerLines(ledgerText);
  const delistedIds = new Set(delists.map((d) => d.id));

  // Only consider modules not yet in the registry AND not delisted (ADR-0271 — see the
  // `ledgerText` doc above for why a delisted id must never reach `publish`).
  const toPublish = manifests.filter(
    (m) => !allowlist.has(m.id) && !delistedIds.has(m.id),
  );
  if (toPublish.length === 0) return;

  const sorted = topoSort(toPublish);
  for (const manifest of sorted) {
    await publish(manifest);
  }
}

// ---------------------------------------------------------------------------
// Workspace manifest loader (CI entry point; replaced by inline fixtures in tests)
// ---------------------------------------------------------------------------

/**
 * Scan every `packages/<pkg>/manifest.ts` under `workspaceRoot`, dynamically import each,
 * validate via `ModuleManifest.parse` (fail-closed; ADR-0005), and return the list.
 * Packages lacking a `manifest.ts` are skipped (absent-edition pattern, not an error).
 * A present but malformed manifest throws before any publish — never silently swallowed.
 *
 * `workspaceRoot` defaults to the monorepo root inferred from `import.meta.dir`
 * (`registry/scripts/` → `../../`). Pass an explicit path in isolated CI jobs or
 * integration tests that exercise this function directly.
 */
export async function loadWorkspaceManifests(
  workspaceRoot?: string,
): Promise<ModuleManifest[]> {
  const root = workspaceRoot ?? join(import.meta.dir, "..", "..");
  const pkgDir = join(root, "packages");
  const entries = readdirSync(pkgDir, { withFileTypes: true });

  const manifests: ModuleManifest[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifestPath = join(pkgDir, entry.name, "manifest.ts");
    if (!existsSync(manifestPath)) continue; // absent manifest — skip (not an error)
    const mod = (await import(manifestPath)) as { default: unknown };
    // parse-or-throw: a malformed manifest blocks publish before the ledger is touched.
    manifests.push(ModuleManifest.parse(mod.default));
  }
  return manifests;
}
