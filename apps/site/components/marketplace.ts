// Shared marketplace helpers for the two new à-la-carte surfaces (ADR-0191): the /modules faceted
// catalog and the /build configurator. Pure data — no React, no "use client" — so both client
// islands import it without pulling the other's tree. Every value derives from the single pricing
// source (`lib/pricing.ts`); this file adds NO new product data.
import type { IconName } from "@/components";
import {
  type BundleId,
  BUNDLE_PRICES,
  EDITION_PRICES,
  type EditionId,
} from "@/lib/pricing";

// Domain glyph per edition — the same glyphs the edition cards on home + /pricing use. One
// accent-free Lucide/bespoke glyph per edition; editions differ by icon + label, never colour
// (DESIGN.md §5 / ADR-0078 §5).
export const EDITION_ICON: Record<EditionId, IconName> = {
  compliance: "fail-closed",
  "ai-kit": "gauge",
  "local-first": "cpu",
  "agentic-dev": "git-branch",
};

/** Display label for an edition slug, read from the single pricing source. */
export function editionLabel(id: EditionId): string {
  return EDITION_PRICES.find((e) => e.id === id)?.label ?? id;
}

/** Display label for a bundle id, read from the single pricing source (ADR-0257/0258). */
export function bundleLabel(id: BundleId): string {
  return BUNDLE_PRICES.find((b) => b.id === id)?.label ?? id;
}

/** The persona/Provenance page path for a bundle id — the marketing slug differs from the bundle id
 *  only for AI-Production (the page lives at `/ai-kit`). The whole-catalog `everything` bundle has no
 *  persona page, so its buy path is the marketplace hub. */
export function bundlePagePath(id: BundleId): string {
  const slug = id === "ai-production" ? "ai-kit" : id;
  return id === "everything" ? "/marketplace" : `/${slug}`;
}
