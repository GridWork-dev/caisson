// The one-surface catalog model (ADR-0285): a single grid over BOTH kinds — the six bundles and the
// à-la-carte modules — so one card system, one facet set, and one deep-link scheme serve both. Pure
// data (no React, no "use client") so the client grid, the compare tray, and the viewer dialog all
// import it without pulling each other's tree. Every value derives from the single pricing source
// (`lib/pricing.ts`) and the media manifest — this file adds NO new product data.
import {
  type BundleId,
  BUNDLE_PRICES,
  MODULE_PRICES,
  type ModulePrice,
  PERSONA_BUNDLE_IDS,
} from "./pricing";
import { entryHasMedia } from "./media-manifest";

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
  /** Bare slug (a BundleId or a MODULE_PRICES id). */
  id: string;
  /** Kind-namespaced key: `bundle:<slug>` / `module:<slug>`. */
  viewId: string;
  label: string;
  /** Integer display USD. */
  amount: number;
  blurb: string;
  categories: readonly Category[];
  /** True when the viewer shows real media (an authored diagram, a produced video, or a live demo) —
   *  not just the brand placeholder. Drives the media facet + the card badge. */
  hasMedia: boolean;
}

function moduleCategories(m: ModulePrice): readonly Category[] {
  // A module's `bundles[]` is persona/Provenance ids only (never the whole-catalog Everything, by
  // construction — pricing.ts); filtering it out both satisfies the type and stays honest.
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

/** The six bundles as surface entries, in display order. */
export const BUNDLE_ENTRIES: readonly SurfaceEntry[] = BUNDLE_PRICES.map(
  (b) => {
    if (b.amount === null) {
      throw new Error(
        `marketplace-surface: bundle "${b.id}" has no committed amount`,
      );
    }
    return {
      kind: "bundle" as const,
      id: b.id,
      viewId: `bundle:${b.id}`,
      label: b.label,
      amount: b.amount,
      blurb: b.note,
      categories: bundleCategories(b.id),
      hasMedia: entryHasMedia("bundle", b.id),
    };
  },
);

/** Every à-la-carte module as a surface entry, in catalog order. */
export const MODULE_ENTRIES: readonly SurfaceEntry[] = MODULE_PRICES.map(
  (m) => ({
    kind: "module" as const,
    id: m.id,
    viewId: `module:${m.id}`,
    label: m.label,
    amount: m.amount,
    blurb: m.blurb,
    categories: moduleCategories(m),
    hasMedia: entryHasMedia("module", m.id),
  }),
);

/** Bundles first, then modules — the surface's default (type: all) order. */
export const ALL_ENTRIES: readonly SurfaceEntry[] = [
  ...BUNDLE_ENTRIES,
  ...MODULE_ENTRIES,
];

/** Resolve an entry by its kind-namespaced `viewId` (the deep-link param). */
export function entryByViewId(viewId: string): SurfaceEntry | undefined {
  return ALL_ENTRIES.find((e) => e.viewId === viewId);
}

/** Cross-kind price bands — the modules span $49–$299, the bundles $329–$2,059, so the bands widen to
 *  cover both. Each entry lands in exactly one band (the boundaries partition the whole range). */
export interface PriceBand {
  id: string;
  label: string;
  test: (amount: number) => boolean;
}

export const PRICE_BANDS: readonly PriceBand[] = [
  { id: "under-200", label: "Under $200", test: (a) => a < 200 },
  { id: "200-499", label: "$200–499", test: (a) => a >= 200 && a <= 499 },
  { id: "500-999", label: "$500–999", test: (a) => a >= 500 && a <= 999 },
  { id: "1000-up", label: "$1,000 and up", test: (a) => a >= 1000 },
];

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
  return BUNDLE_PRICES.find((b) => b.id === c)?.label ?? c;
}
