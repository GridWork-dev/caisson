// Shared marketplace helpers for the two new à-la-carte surfaces (ADR-0191): the /modules faceted
// catalog and the /build configurator. Pure data — no React, no "use client" — so both client
// islands import it without pulling the other's tree. Every value derives from the catalog
// (`lib/catalog.ts`); this file adds NO new product data.
import type { IconName } from "@/components";
import { type BundleId, BUNDLES } from "@/lib/catalog";

// Domain glyph per bundle — the same glyphs the bundle cards on home + /pricing use. One
// accent-free Lucide/bespoke glyph per bundle; bundles differ by icon + label, never colour
// (DESIGN.md §5 / ADR-0078 §5).
export const BUNDLE_ICON: Record<BundleId, IconName> = {
  compliance: "fail-closed",
  "ai-production": "gauge",
  "local-first": "cpu",
  "agentic-dev": "git-branch",
  provenance: "audit-chain",
  everything: "bundle",
};

/** Display label for a bundle id, read from the catalog (ADR-0257/0258). */
export function bundleLabel(id: BundleId): string {
  return BUNDLES.find((b) => b.id === id)?.label ?? id;
}

/** The persona/Provenance page path for a bundle id — the marketing slug differs from the bundle id
 *  only for AI-Production (the page lives at `/ai-kit`). The whole-catalog `everything` bundle has no
 *  persona page, so its buy path is the marketplace hub. */
export function bundlePagePath(id: BundleId): string {
  const slug = id === "ai-production" ? "ai-kit" : id;
  return id === "everything" ? "/marketplace" : `/${slug}`;
}
