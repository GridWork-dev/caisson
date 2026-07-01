# ADR-0189 — Reaffirm the ≤10% single-accent lock; optional `--cs-proof` status token

**Status:** accepted · 2026-07-01 (site-marketplace-rework track — operator lock, picker round 2026-07-01).
**Relates:** ADR-0042 (foundation palette), ADR-0078 (brand system, "nothing else glows"), ADR-0099-0101
(design-system recipe + tokens + deterministic gates incl. the contrast matrix), and sibling
site-marketplace ADRs 0190-0196.

## Context

The fuller-refresh pass raised a warm "second proof/evidence accent" as a candidate addition. Code-grounding
**refuted** the premise: no second accent is wired anywhere in the codebase, and the functional status tokens
(`--cs-success`/`--cs-warning`/`--cs-danger`/`--cs-info`) already live in a **separate tier** outside the
accent budget, contrast-gated in both light and dark modes by `tokens-contrast.test.ts`'s `checkFunctional`.
DESIGN.md §8 locks exactly one `--cs-accent` at ≤10% usage — "nothing else glows."

## Decision

Keep the ≤10% single-accent lock unchanged. No new brand hue. No amendment to ADR-0078. If an "evidence
verified" signal ever needs to read as visually distinct from success-green, add an **optional**
`--cs-proof` token in the **status tier only** (glyph + dot/badge scale), always paired with a glyph + label
per the status-never-by-color-alone rule, and kept outside the accent budget. Absent that need, reuse the
existing bespoke evidence-pack glyph (DESIGN.md §4) and add no color at all.

## Rejected

- **A genuinely new brand hue** — contradicts "nothing else glows" and the operator's brand lock.
- **A free-floating decorative gradient** — banned outright by DESIGN.md.
