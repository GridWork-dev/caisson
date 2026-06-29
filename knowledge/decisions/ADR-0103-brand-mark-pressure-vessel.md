# ADR-0103 — Brand mark: the "Pressure vessel" (supersedes the waterline-over-chamber glyph)

**Status:** accepted · 2026-06-29 (design-system-harden track — operator mark pick).
**Relates:** ADR-0078 §2 (brand mark + favicon kit — **supersedes its glyph geometry**, keeps the rest
of the brand system intact) · ADR-0078 §8 (≤10% accent budget — accent stays out of the in-product
mark) · ADR-0099 (kit recipe — `Glyph` is a single-SVG-root `forwardRef` primitive) · ADR-0102
(signature — now deferred-for-rework, see the note below). **Evidence:** the three-candidate studio
exploration (`apps/studio/src/app/design/wordmark/marks.tsx` + `page.tsx`), rendered at app/UI/16px
sizes and operator-picked on the favicon-first test.

## Context

ADR-0078 §2 shipped a **placeholder** mark — two open strokes, a waterline over an open-topped chamber.
In review it read as a wireframe / open box (a "bin"), not a designed mark, and it duplicated the bespoke
`caisson` domain icon (`icon.tsx`). The brand needs a real mark: ownable, legible down to a 16px favicon,
executed at craft (figure-ground, weight, the single instrument light), holding the caisson metaphor —
a pressurized chamber under a cold waterline, holding one light under load.

Three high-craft candidates were built as tokenized inline SVG and rendered live in the studio:
**A · Cross-section** (a diving bell breaching the waterline — literal, but the busiest favicon),
**B · Pressure vessel** (the chamber head-on as a sealed steel port), **C · Instrument** (a steel iris
with one light — abstract/premium, with a slight camera-aperture read at a glance).

## Decision

**Lock candidate B — the "Pressure vessel."** The chamber head-on as a sealed steel port: a
rounded-square steel body, a waterline seam across the crown, a single instrument light at the core.
Two renderings, one mark:

- **app-icon / favicon / OG** — dark steel field, a two-tone steel body, a darker well, and the
  accent (teal) instrument light with a halo ring + soft glow. **The accent lives here only.**
- **in-product (kit `Glyph`)** — monochrome `currentColor`: the vessel outline, the crown seam, a
  halo ring + core. The accent never enters the in-product mark (ADR-0078 §8 budget).

Picked over A and C on the **16px-favicon-first** test — B has the cleanest silhouette at tab size,
the most premium read at 64, and the strongest figure-ground.

**Surfaces updated (this lock):** `packages/ui/src/components/brand.tsx` (the canonical kit `Glyph`),
`apps/site/components/brand.tsx`, `apps/site/app/icon.svg` + `apps/site/app/apple-icon.tsx`, and a new
`apps/studio/src/app/icon.svg` (the studio favicon, previously a 404). The bespoke `caisson` domain
**icon** (`icon.tsx`) stays a distinct line cross-section — it no longer duplicates the mark.

## Signature note (amends ADR-0102 scope)

Per the same operator review, the four-beat **signature sketches** (caisson cross-section +
break-the-chain, ADR-0102) are **deferred for rework** — unlinked from the studio nav + hub and kept
off the site, with a **blank slot reserved** for the hero. The signature is the **one** deferred design
surface. ADR-0102's direction (tokenized CSS/SVG over a video pipeline) **stands**; only the v1 sketch
execution is deferred.

## Consequences

- The mark is now consistent across the kit, the site, and all favicons; the ≤10% accent budget holds
  (accent only in the favicon + the four sanctioned in-product slots — CTA, eyebrow, focus ring, status).
- The live site favicon + nav mark change on the next deploy (DEPLOY is operator-gated, separate from SHIP).
- OG images are typographic (they do not embed the glyph), so no OG re-render is required.
- Build-time favicon/apple-icon assets mirror the locked palette as hex (the sanctioned build-image
  exception): bg `#0d1216`, steel `#2b353b`, steel-edge `#3a454b`, well `#11181c`, accent `#43bcd0`.

## Alternatives considered

- **A · Cross-section (diving bell)** — keeps the most literal metaphor and is rich at 32px+, but the
  detail collapses at 16px (the weakest favicon). Kept as a studio candidate for the record.
- **C · Instrument (steel iris)** — the most premium/abstract, but reads as a camera aperture or a
  loading spinner at a glance; less ownable for a compliance-infra brand.
- **Keep the ADR-0078 placeholder** — rejected: it reads as a wireframe and duplicates a domain icon.
