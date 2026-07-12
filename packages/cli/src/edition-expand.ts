// Expand a buyer's `--edition <bundle>` into the bundle's CURRENT member
// modules, each pinned at its index `.latest`, so `create-caisson --edition compliance` (no
// `--module`) auto-selects the bundle instead of failing the `Selection.modules.min(1)` invariant.
//
// Membership is read from the SINGLE index-derived resolver — `@caisson/registry-schema`
// `expandEntitlements` (the same one the server resolver / Worker / MCP gate use, ADR-0071/0257) —
// so the CLI never hand-lists a bundle's members. `expandEntitlements` normalizes + fail-closes on
// an unknown id internally, so a bad `--edition` throws here before any generation.
import {
  type RegistryIndex,
  expandEntitlements,
} from "@caisson/registry-schema";

/** The pre-Zod module-selection element shape (`RawSelection.modules[number]`, seam.ts). */
type ModuleSelection = { id: string; version: string };

/**
 * The member modules of `editionId` (a bundle id or a purchase-alias `expandEntitlements` accepts),
 * each at its index-entry `.latest` version — the same version-pin `moduleOptions()` (interactive.ts)
 * shows in the wizard. The bundle/edition META-package(s) `expandEntitlements` returns (an
 * `@caisson/<bundle>` marker whose own `kind` is `"bundle"`/`"edition"`) are dropped: they are not
 * installable leaf modules and never appear in a frozen `members` pin map, so the buyer's selection
 * should not carry them. Every returned id is an indexed module (`expandEntitlements` is
 * allowlist-guarded) → each one passes `validateSelection`'s `assertKnownModule`/`assertKnownVersion`.
 * Sorted for a deterministic selection. Throws (fail-closed) on an unknown edition id.
 */
export function expandEditionModules(
  index: RegistryIndex,
  editionId: string,
): ModuleSelection[] {
  const out: ModuleSelection[] = [];
  for (const id of expandEntitlements(index, [editionId])) {
    const entry = index.modules.find((m) => m.id === id);
    if (entry === undefined) continue; // defensive: expandEntitlements only returns indexed ids
    const kind = entry.versions.find((v) => v.version === entry.latest)
      ?.manifest.kind;
    if (kind === "bundle" || kind === "edition") continue; // meta-package marker, not installable
    out.push({ id, version: entry.latest });
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : 1));
}
