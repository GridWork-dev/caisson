# ADR-0195 — Design-system codify: Martian-only mono + de-dup + button lock

**Status:** accepted · 2026-07-01 (site-marketplace-rework track — operator lock, picker round 2026-07-01).
**Relates:** ADR-0042 (foundation type — SELECTED_TYPE lock), ADR-0078 (brand system), ADR-0099-0100
(component/kit packaging + token/theming hardening, incl. the codified elevation scale), ADR-0192 (buy-verb —
the button-variant lock this ADR co-establishes), ADR-0194 (mobile a11y — the `ThemeToggle` this ADR adds),
and sibling site-marketplace ADRs 0189-0194/0196.

## Context

Two mono fonts are both loaded: `Martian_Mono` (`--font-mono` — brand/label/numeral surface) and
`JetBrains_Mono` (`--font-mono-code` — code blocks), both self-hosted `next/font` vars
(`fonts.ts:8-31`, `theme.ts:51-55`). "Two theme toggles" was investigated and **refuted** — only one
`ThemeToggle` exists. The elevation scale was investigated and **refuted** as ad-hoc — it is already
codified (`foundation.elevation` sm/md/lg → `--cs-shadow-*`). The SKU matrix is duplicated home vs
`/pricing` (same eyebrow/title, divergent 9 vs 11 rows).

## Decision

Operator picked option A — keep Martian Mono only. Drop JetBrains Mono; Martian does labels, numerals, and
code as the single `--font-mono` (it is the SELECTED/locked brand type, `theme.ts` `SELECTED_TYPE=2`,
preserving the terminal "soul"). Hoist the SKU matrix to a single shared const in `lib/pricing.ts` (de-dup
home vs `/pricing`). Add the `ThemeToggle` to the mobile-nav drawer (the D-6 mobile-a11y gap). Lock exactly
**two** button variants (primary fill + secondary outline) + **one** tertiary text link, retiring the
ambiguous "Get" third tier (together with D-4/ADR-0192). Elevation stays as already codified — no change.

## Rejected

- **B — keep JetBrains-only**: forfeits Martian's distinctive brand numeral/label character, cutting against
  the locked type.
- **C — keep both**: the exact two-font redundancy this fork removes.
