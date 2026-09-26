// @caisson-sh/demo-registry — registry composition. Combines the three entry files (base
// kit, ui-pro, per-package `./ui` surfaces) into one flat, validated list + lookup helpers. The ONE
// data source apps/admin's catalog reads now and apps/site's `/ui` gallery repoints to later.
import {
  catalogEntryMetaSchema,
  type CatalogEntry,
  type LicenseTier,
} from "./schema.ts";
import { UI_BASE_ENTRIES } from "./entries/ui-base.tsx";
import { UI_PRO_ENTRIES } from "./entries/ui-pro.tsx";
import { PACKAGE_SURFACE_ENTRIES } from "./entries/package-surfaces.tsx";

export type { CatalogEntry } from "./schema.ts";

const ALL_ENTRIES: readonly CatalogEntry[] = [
  ...UI_BASE_ENTRIES,
  ...UI_PRO_ENTRIES,
  ...PACKAGE_SURFACE_ENTRIES,
];

/** Validate every entry's metadata + assert id uniqueness at module load — a typo'd/duplicate
 *  entry fails the FIRST import (caught by registry.test.ts), never surfaces as a silent gap in
 *  the admin UI. */
function validate(entries: readonly CatalogEntry[]): CatalogEntry[] {
  const seen = new Set<string>();
  for (const entry of entries) {
    const { render: _render, sampleProps: _sampleProps, ...meta } = entry;
    catalogEntryMetaSchema.parse(meta);
    if (seen.has(entry.id)) {
      throw new Error(
        `@caisson-sh/demo-registry: duplicate entry id "${entry.id}"`,
      );
    }
    seen.add(entry.id);
  }
  return [...entries];
}

/** The full, validated catalog (stable order: base kit, then ui-pro, then per-package surfaces). */
export const CATALOG_ENTRIES: readonly CatalogEntry[] = validate(ALL_ENTRIES);

/** Entries for one license tier, in catalog order. */
export function entriesByTier(tier: LicenseTier): CatalogEntry[] {
  return CATALOG_ENTRIES.filter((e) => e.tier === tier);
}

/** The distinct owning packages represented in the catalog, in first-seen order. */
export function listPackages(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of CATALOG_ENTRIES) {
    if (!seen.has(e.package)) {
      seen.add(e.package);
      out.push(e.package);
    }
  }
  return out;
}
