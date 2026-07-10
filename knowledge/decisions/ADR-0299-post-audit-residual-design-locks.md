# ADR-0299 — Post-audit residual design locks (four, one round)

**Status:** accepted · 2026-07-09 (operator-locked, one AskUserQuestion round over the Kickoff-G
delta artifact's residual board — `outputs/reviews/visual-audit-delta-2026-07-09.md` "New
findings" + the deferred design calls). **Tags:** `ui`, `frontend`. Extends ADR-0298; applies the
ADR-0290 media template and the ADR-0078 type system without reopening either.

## Context

Kickoff G closed with 0 P0 / 0 buyer-visible P1 on G-owned surfaces, leaving four items that were
operator design calls rather than defects: the sitewide barred-zero glyph, the 11 docs pages
hedging "this reference is still expanding", two cosmetic P3s (compare-page mobile column split,
duplicated diagram captions), and the scheduling of the remaining design-bandwidth work (the
three.js signature slot, bespoke module media). The operator answered all four in one round.

## Decision

1. **Zero glyph → unicode-range patch face.** Hubot Sans ships only a barred zero (the served
   woff2 carries no alternate glyph, so `font-feature-settings` cannot reach a different form) and
   prose zeros read as Θ. A single-glyph face — Mona Sans (Hubot's sibling family, OFL), subset to
   U+0030 (~4KB variable woff2, wght preserved) — is self-hosted and composed in front of the
   Hubot stack on `<html>` via a `--font-sans` re-declaration, so every sans "0" resolves to
   Mona's plain oval and everything else falls through to Hubot. The body font itself is NOT
   swapped; the ADR-0078 type system stands. Mono surfaces are untouched.
2. **Docs hedges → expand the references, don't reword.** The eleven "still expanding" callouts
   are removed by actually writing the full API references they hedged: each page gains a
   source-grounded reference section documenting the package's real public exports (signatures
   verified against source, shipped behavior only, no future framing), after which the callout is
   deleted. This closes the last standing tension with the ADR-0237 rider-2 full V1-live posture.
3. **Both P3 cosmetics fix now.** (a) The 3-column compare table gives the Detail column half the
   table width (scoped `:has()` rule keyed to exactly-3-column matrices; the wide module × bundle
   grids keep their even split). (b) The diagram chrome bar drops the duplicated long sentence:
   the bar shows a short artifact-style `<slug>.svg` label (matching the CodeBlock file-label
   aesthetic the MediaFrame template mirrors), the carousel caption remains the one visible
   narration, and the long sentence stays as the frame's accessible name.
4. **Design-track kickoff: spec next, don't start.** The three.js signature slot (blank since
   ADR-0104), the bespoke-media batch for modules still on placeholder brand art, and any parked
   polish ride one design-track kickoff spec drafted now (`outputs/kickoffs/` — Kickoff I); the
   operator locks its scope before any build starts.

## Consequences

- The barred zero disappears from prose sitewide at the next deploy without reopening the locked
  type system; the patch face is one asset + one `@font-face` + one composed variable, and
  removing it (if the font ever changes) is a two-line revert.
- The docs tree carries real references where it carried hedges; future package API changes now
  have eleven more pages to keep honest (the price of the full-expansion option, accepted).
- The compare tables and the media template lose their last audit-flagged cosmetic noise.
- Kickoff I becomes the single container for remaining design bandwidth; nothing design-flavored
  stays untracked on the residual board.
