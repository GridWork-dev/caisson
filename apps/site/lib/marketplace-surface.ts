// The one-surface catalog model (ADR-0285): a single grid over BOTH kinds — the six module families
// and the modules — so one card system, one facet set, and one deep-link scheme serve both. Pure
// data (no React, no "use client") so the client grid and the viewer dialog both import it without
// pulling each other's tree. Every value derives from the catalog (`lib/catalog.ts`) and the media
// manifest — this file adds NO new product data.
import {
  type BundleId,
  BUNDLES,
  MODULES,
  type CatalogModule,
  PERSONA_BUNDLE_IDS,
} from "./catalog";
import { entryHasMedia, mediaSlides } from "./media-manifest";

export type EntryKind = "bundle" | "module";

/** The category facet: the five persona/Provenance bundles a card can belong to, plus a "platform"
 *  bucket for the standalone commercial SKUs no persona bundle grants (org-controls,
 *  billing-orchestration, ui-pro). A MODULE's categories are its index-pinned `bundles[]`; a
 *  persona/Provenance BUNDLE's category is its own id; the whole-catalog Everything bundle carries no
 *  single category (a category chip for it would be all-noise), so it surfaces only with no category
 *  filter active. Categories DERIVE — no new data field. */
export const PLATFORM = "platform" as const;
export type Category = Exclude<BundleId, "everything"> | typeof PLATFORM;
export const CATEGORIES: readonly Category[] = [
  ...PERSONA_BUNDLE_IDS,
  PLATFORM,
];

/** A unified grid entry — the projection every card, compare column, and viewer reads. `viewId` is
 *  the kind-namespaced key (`bundle:<slug>` / `module:<slug>`) — the same namespacing the cart uses —
 *  so it doubles as the deep-link param and the React list key with no bare-slug collisions. */
export interface SurfaceEntry {
  kind: EntryKind;
  /** Bare slug (a BundleId or a MODULES id). */
  id: string;
  /** Kind-namespaced key: `bundle:<slug>` / `module:<slug>`. */
  viewId: string;
  label: string;
  blurb: string;
  categories: readonly Category[];
  /** True when the viewer shows real media (an authored diagram, a produced video, or a live demo) —
   *  not just the brand placeholder. Drives the media facet + the card badge. */
  hasMedia: boolean;
  /** The module page that frames the entry's live demo (a module's own, or a family's borrowed hero
   *  module's), or null when it has none. */
  demoHref: string | null;
}

/** The module page framing an entry's interactive poke, if it has one. Every poke id is also a
 *  module-page slug (marketplace-surface.test pins it), so the link always resolves. */
function demoHref(kind: EntryKind, id: string): string | null {
  const poke = mediaSlides(kind, id).find((s) => s.kind === "poke")?.poke;
  return poke ? `/marketplace/modules/${poke}` : null;
}

function moduleCategories(m: CatalogModule): readonly Category[] {
  // A module's `bundles[]` is persona/Provenance ids only (never the whole-catalog Everything, by
  // construction — catalog.ts); filtering it out both satisfies the type and stays honest.
  if (m.bundles.length === 0) return [PLATFORM];
  return m.bundles.filter(
    (b): b is Exclude<BundleId, "everything"> => b !== "everything",
  );
}

// A persona/Provenance bundle's own id is its category; the whole-catalog Everything bundle carries
// none (statement-form narrowing excludes "everything" from the returned element type).
function bundleCategories(id: BundleId): readonly Category[] {
  if (id === "everything") return [];
  return [id];
}

/** The six module families as surface entries, in display order. */
export const BUNDLE_ENTRIES: readonly SurfaceEntry[] = BUNDLES.map((b) => ({
  kind: "bundle" as const,
  id: b.id,
  viewId: `bundle:${b.id}`,
  label: b.label,
  blurb: b.note,
  categories: bundleCategories(b.id),
  hasMedia: entryHasMedia("bundle", b.id),
  demoHref: demoHref("bundle", b.id),
}));

/** Every module as a surface entry, in catalog order. */
export const MODULE_ENTRIES: readonly SurfaceEntry[] = MODULES.map((m) => ({
  kind: "module" as const,
  id: m.id,
  viewId: `module:${m.id}`,
  label: m.label,
  blurb: m.blurb,
  categories: moduleCategories(m),
  hasMedia: entryHasMedia("module", m.id),
  demoHref: demoHref("module", m.id),
}));

/** Bundles first, then modules — the surface's default (type: all) order. */
export const ALL_ENTRIES: readonly SurfaceEntry[] = [
  ...BUNDLE_ENTRIES,
  ...MODULE_ENTRIES,
];

/** Resolve an entry by its kind-namespaced `viewId` (the deep-link param). */
export function entryByViewId(viewId: string): SurfaceEntry | undefined {
  return ALL_ENTRIES.find((e) => e.viewId === viewId);
}

/** Whether an entry belongs to category `c`. */
export function inCategory(e: SurfaceEntry, c: Category): boolean {
  return e.categories.includes(c);
}

/** The entry's primary category tag — its first category, or Platform for the Everything bundle (no
 *  single category). */
export function primaryCategory(e: SurfaceEntry): Category {
  return e.categories[0] ?? PLATFORM;
}

export function categoryLabel(c: Category): string {
  if (c === PLATFORM) return "Platform";
  return BUNDLES.find((b) => b.id === c)?.label ?? c;
}
