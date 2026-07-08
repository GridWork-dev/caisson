# ADR-0290 — Marketplace media standard: live-component + real-artifact slides, all-static

**Status:** accepted · 2026-07-07 (operator-locked, tenth-sitting picker over the `gw-frontend-designer`
media-gap plan `outputs/research/marketplace-media-gap-plan-2026-07-07.md`). Refines ADR-0285 §3
(the media carousel + per-item manifest) and ADR-0263 (the Remotion static-media pipeline).
Append-only; supersede with a later ADR, never edit. **Tags:** `frontend`, `ui`.

## Context

The marketplace MEDIA facet counts **8 of 28** catalog items with real media; the other **20 render
only the brand-mark placeholder** (source of truth: `apps/site/lib/media-manifest.ts` —
`entryHasMedia` / `mediaSlides`). The existing media is a mix of authored diagrams, one Remotion
`mp4` (audit-worm), and a live demo (ui-pro) — visually inconsistent. The honest-artifact floor
(ADR-0082) binds: media depicts SHIPPED behaviour only, never a fabricated screen.

## Decision

- **Content model: live components + real artifacts.** Each slide's content is, in preference
  order: (1) the **actual rendered `@caisson/ui` component** where the item ships one (show the real
  `DataTable`, `StatusPill`, `Terminal`, etc. — the buyer sees what they get); (2) the **real
  code-artifact** snippet already single-sourced on the item's depth page
  (`lib/module-pages.ts` `artifact.file`/`artifact.code`), rendered via the same framed `CodeBlock`
  the homepage uses; (3) an **authored mechanism / composition diagram** (inline SVG / token-CSS)
  for concept-only modules with neither a showable component nor an artifact. New `SlideKind`s
  `component` and `code-artifact` are added alongside the existing `diagram`.
- **All-static, no video.** The launch media set is fully static picture-slides. The single existing
  audit-worm Remotion `mp4` is **replaced by a static slide** for uniformity; the ADR-0263 Remotion
  pipeline stays available but is not used by the marketplace launch set (reserve for a future
  flagship-polish decision, if ever).
- **Re-standardize all 28.** Every item — including the 8 that already have media — is rebuilt onto
  ONE standardized framed-slide template (chrome bar + body, the homepage-terminal aesthetic), so the
  whole marketplace reads uniform. No mismatched old/new slides side by side.
- **`code-artifact` counts toward the MEDIA facet** (`entryHasMedia`): a real code snippet is real
  media.

## Consequences

- Closes the media gap to **28/28** on one honest, uniform standard. Highest-leverage first move
  (per the plan): the `code-artifact` kind wires the 8 modules that already carry a depth artifact at
  near-zero per-module cost.
- Self-contained by construction — the site CSP blocks remote hosts; every slide is inline
  SVG / token-CSS / a live-rendered kit component / a same-origin snippet. No external assets.
- Bundle slides reuse the parametrized `marketplace-hero-artifact` composition pattern (one component
  fed each bundle's member modules) so the four missing bundle slides come from one component.
- Depends on the `@caisson/ui` components being server-safe / presentational to render inside a slide
  (they are, per the ADR-0099 recipe) — a slide never pulls interactive state.
- Does not touch pricing, entitlements, or go-live copy — a presentation-layer change under the
  ADR-0082 honest-artifact floor.
