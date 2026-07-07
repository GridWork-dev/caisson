# ADR-0285 — Marketplace one-surface rework + media manifest

**Status:** accepted · 2026-07-07 (operator-locked, seventh-sitting picker — screenshot-annotated
recon round). Extends ADR-0237/0238 (site rework) and ADR-0284 (unified catalog); the surface
consumes the ADR-0284 shared demo registry when it lands. Append-only; supersede with a later
ADR, never edit. **Tags:** `frontend`.

## Context

The marketplace family had grown four tab routes (`/marketplace` bundles hub · `/modules` ·
`/build` · `/plans`) plus three satellites (`/compare`, `/stack-fit`, `/ui`), with the system
underneath duplicated per kind: two near-identical preview dialogs (module vs bundle, ~684 LOC of
the same chrome built twice), two catalog grids, two copy-pasted `?m=`/`?b=` deep-link
implementations, and a compare tray covering modules only. The nav's "Compare — bundles and
modules, side by side" entry mislabels `/compare`, which is competitor-comparison marketing
content. `/ui` is nav-only (absent from the routes registry, sitemap, and footer). Media is a
single-slot placeholder (21/22 modules), one Remotion mp4, and one bespoke live demo; no carousel
exists. Operator annotations (2026-07-07 screenshots) crossed out Modules + Build-your-stack as
separate nav destinations and asked for click-through media per module/bundle.

## Decision

1. **One surface + stack rail.** `/marketplace` becomes a single screen: a unified bundle+module
   grid (type/category/price facets + text search), ONE card-viewer dialog serving both kinds
   (discriminated union over `{kind: bundle|module, id}`), the compare tray extended to both
   kinds, and Build-your-stack dissolved into a persistent cart-aware "Your stack" rail (live
   total + bundle-upgrade nudge, absorbing `StackBuilder`). Plans stays its own simple page —
   subscriptions are a different purchase path. Old tab routes 301 to the surface.
2. **Periphery stays standalone, feeds the cards.** `/compare`, `/stack-fit`, and `/ui` remain
   separately visible routes (registry-page style), and their CONTENT single-sources into the
   marketplace cards (stack-fit DB posture on module cards, competitor positioning where
   relevant, ui-pro live demos in the viewer). The nav Compare mislabel is fixed; `/ui` joins the
   routes registry (sitemap + footer).
3. **Media carousel + manifest.** A `MediaCarousel` fed by a per-module/bundle media manifest
   (slide kinds: `diagram | image | interactive | video`) renders in BOTH the card viewer and
   depth pages. The Remotion mp4 becomes one slide kind; ui-pro's live demo becomes an
   `interactive` slide; brand placeholder art auto-fills slide 1 where no media exists. Ships
   with an initial authored diagram set for the top modules (the RLS deny-flow / audit-chain /
   WORM-lifecycle diagrams, given more character per the operator annotation). The filetree on
   the honest-artifact section is redesigned in the same pack (color, depth, click-to-reveal
   code cards).
4. **Annotation fixes ride the wave:** bolder/standout dual-door chips, card shadow consistency
   (the psql card), the empty CLI-card slot filled, proof-chip wrap cleanup.

## Consequences

- The two preview dialogs, two grids, and two deep-link implementations collapse into one
  system; the tray becomes the only in-catalog compare, and `/compare` reads honestly as
  competitor content.
- Blast radius is known from recon: `lib/routes.ts`, `next.config.ts` redirects, homepage CTAs,
  persona bundle pages, `lib/jsonld.ts`, glossary cross-links, `app/llms.txt`, sitemap, the
  visual harness route list, and BOTH hand-maintained nav lists (`MARKETPLACE_PANEL` +
  `MOBILE_LINKS`).
- The surface consumes the existing ui-showcase demos now and repoints to the ADR-0284 shared
  demo registry in a follow-up — the two tracks stay tree-independent.
