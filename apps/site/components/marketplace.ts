// Shared marketplace helpers for the two new à-la-carte surfaces (ADR-0191): the /modules faceted
// catalog and the /build configurator. Pure data — no React, no "use client" — so both client
// islands import it without pulling the other's tree. Every value derives from the single pricing
// source (`lib/pricing.ts`); this file adds NO new product data.
import type { IconName } from "@/components";
import { EDITION_PRICES, type EditionId } from "@/lib/pricing";

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
