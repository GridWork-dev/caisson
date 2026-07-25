# SPEC — Module-depth pages for the three compliance-gap SKUs

- **Date:** 2026-07-25
- **Status:** LOCKED (operator, 2026-07-25 design grill)
- **Tags:** `ui` `frontend`
- **Decision:** ADR-0380 (locks 6 and 7) · extends ADR-0237 F2/F6, ADR-0290, ADR-0308, ADR-0373
- **Tracker:** CAISSON-134

## Goal

The 2026-07-20 catalog debut shipped `access-review` ($199), `risk-register` ($279), and
`trust-page` ($149) as buyable marketplace cards with no `MODULE_PAGES` record — 23 depth records
against 26 sellable modules. Give the three the same full depth treatment every other sellable
module has, so the catalog carries no second-class SKU.

Success means:

1. `/marketplace/modules/{access-review,risk-register,trust-page}` render full depth pages — hero,
   definition, capability grid, media carousel, real code artifact, FAQ, glossary cross-links, and
   JSON-LD `SoftwareApplication` with a live Offer URL.
2. Each of the three carries a **bespoke glyph** in the brand icon registry; none falls back to the
   generic `boxes` mark.
3. Each depth carousel leads with a **live component slide** built on the package's existing poke.
4. Depth-record parity is 26/26 and a test prevents a future sellable SKU from shipping without one.

## Locked behavior

- **New copy is authorized for these three pages only** (ADR-0380 lock 7 narrows the ADR-0379
  copy freeze to existing copy). No other buyer-facing copy changes.
- **Honest-artifact floor** (ADR-0082/0237): every capability claim names a real exported
  identifier, and each record's code artifact is lifted verbatim from the package it describes.
  A diagram or slide is a claim.
- Prices, bundle membership, cart posture, and Cloudflare gating are untouched.
- The schematics (`schematic-access-review`, `schematic-risk-register`, `schematic-trust-page`),
  their diagram targets, and the three pokes already ship — this slice consumes them, it does not
  re-author them.
- No new route files: the three are records on the existing spoke pattern.

## What already exists (reuse, do not rebuild)

| Asset               | Location                                                                      |
| ------------------- | ----------------------------------------------------------------------------- |
| Record shape        | `apps/site/lib/module-pages.ts` — `ModulePageRecord`, 23 worked examples      |
| Schematics          | `apps/site/lib/media-manifest.ts` — keys, captions, and targets present       |
| Pokes               | `apps/site/components/poke/{access-review,risk-register,trust-page}-poke.tsx` |
| Mark map            | `apps/site/lib/marks.ts` — `MODULE_MARKS`, `moduleMark` fallback              |
| Glyph registry      | `@caisson/ui/components` `IconName`                                           |
| Packages (headless) | `packages/access-review` · `packages/risk-register` · `packages/trust-page`   |

## Non-goals

- No new package UI surface, no new route file, no pricing or bundle-membership change.
- No re-authoring of the shipped schematics or pokes.
- No copy change to any other page.

## Verification

- Route and static-param tests for the three new depth URLs; JSON-LD Offer URL present.
- Data-lint: every `MODULE_PAGES` slug is a real sellable module **and** every sellable module has a
  record (26/26); every `relatedGlossary` slug resolves.
- Every capability body and artifact annotation names an identifier that exists in the package.
- Contrast gate on any new token pair; design-manifest regenerated and drift-clean.
- a11y and e2e on the three new pages; `gw-persona-walkthrough` critique before ship.
