# ADR-0098 — Token & theming hardening: breakpoint ladder · scrim · 3-prong dark mode

**Status:** accepted · 2026-06-29 (design-system-harden track — operator lock, picker round F4·F3).
**Relates:** ADR-0042 (token center — palette A + Structural type, **kept**), ADR-0078 (brand expansion —
motion/elevation tokens; "dark is the brand"), ADR-0097 (the ThemeToggle is built per the kit recipe).
**Adopts the mechanism of** `outputs/research/wardfile-frontend-playbook.md` (token additions; VALUES stay
Caisson's). Evidence: the 2026-06-29 grounding of `packages/ui/src/tokens/*` + `gen-tokens-css.ts`
(`outputs/kickoffs/design-marketing-rebuild.md` F3/F4).

## Context

The token system is two-tier OKLCH: `foundation.ts` (static non-color scales) + `candidates.ts` (A/B/C
accent palettes, each a `{dark, light}` 14-field `SemanticTheme`) + `theme.ts` (a pure `SELECTED_*`
pointer) → `gen-tokens-css.ts` emits `styles/tokens.css`. Three gaps block the playbook's guards and the
rebuild:

- **No breakpoint ladder.** `foundation.ts` exports fontSize/fontWeight/lineHeight/letterSpacing/space/
  radius/motion/elevation — no `breakpoint` object. The playbook's breakpoint guard needs one rem ladder
  because `@media` widths can't read CSS vars. (`packages/ui/src/tokens/foundation.ts:7-89`.)
- **No `scrim` token.** `SemanticTheme` has 14 fields; none is a scrim/overlay/backdrop fill. Overlays and
  the dialog/drawer primitives (ADR-0097) need one. (`packages/ui/src/tokens/types.ts:8-32`.)
- **Dark mode is half-built.** `gen-tokens-css.ts` writes dark into `:root,[data-theme="dark"]` and light
  into `[data-theme="light"]` — **dark-default + manual override only**. There is **no**
  `@media(prefers-color-scheme)` seed anywhere. The current ThemeToggle is a two-button **text**
  ("Dark"/"Light") segmented control. (`packages/ui/scripts/gen-tokens-css.ts:80-90`;
  `apps/site/components/theme-toggle.tsx:8-44`.)

## Decision

### F4 — Add the breakpoint ladder + `scrim`; **keep** `surface1`/`surface2` (operator lock)

- **Breakpoint ladder** in `foundation.ts` (Tier-1, mode-independent): one rem ladder
  `xs 30 · sm 40 · md 48 · lg 60 · xl 72 · 2xl 90` (rem). Every `@media` width must be a rung (enforced by
  the breakpoint guard, ADR-0099).
- **`scrim`** added as a Tier-2 semantic mode-flipping token in `SemanticTheme` (a per-theme overlay fill,
  with an explicit light-theme value) → emits `--cs-scrim`. Defined from scratch (no existing
  overlay/backdrop token; elevation shadows + `glowAccent` are not scrims).
- **Surface naming stays `surface1`/`surface2`** (3-level: `bg` / `surface1` / `surface2` → `--cs-surface-1`
  / `--cs-surface-2`). The playbook's `surface`/`surfaceRaised` is **not** adopted: token _names_ are
  "swap-this", not load-bearing mechanism, and a rename would touch `types.ts` + 6 palette sites +
  `gen-tokens-css.ts` + every `--cs-surface-*` consumer in site + studio for zero mechanism gain.

### F3 — 3-prong dark mode, default-follow-OS, **icon** toggle (operator lock — changed from the 2-prong rec)

The operator chose OS-follow as the default with an icon override. `gen-tokens-css.ts` emits the playbook's
prong set:

1. `:root { <static> <dark> }` — dark stays the un-attributed default (no JS / FOUC-safe).
2. `@media (prefers-color-scheme: light) { :root:not([data-theme="dark"]) { <light> } }` — **seed from the
   OS**: a visitor whose OS prefers light gets light automatically, until they override.
3. `[data-theme="dark"] { <dark> }` / `[data-theme="light"] { <light> }` — **manual override wins** over the
   OS (the `:not([data-theme="dark"])` guard preserves dark-default semantics).

The **ThemeToggle** (built per ADR-0097) **follows the OS live until the first click**, then **pins +
persists** the choice to `localStorage`; a pre-paint inline script kills FOUC. It is an **icon toggle, not
the current text buttons** — a single icon+state control (e.g. a sun/moon-class Lucide glyph reflecting
active mode), no "Dark"/"Light" word labels. Accessible name via `aria-label`/`aria-pressed`.

A **contrast assertion** over the `SemanticTheme` pairs in **both** modes lands with this change (today
`tokens.test.ts` has none) — folded into the full-contrast-matrix gate (ADR-0099); any palette/scrim edit
ships contrast-guarded.

## Rejected

- **Ratify 2-prong** (F3 alt, my recommendation) — dark-default + manual only; cheapest and "dark is the
  brand". Operator overrode it: OS-follow default is more correct for light-preferring visitors and the
  icon toggle is the wanted affordance.
- **Rename `surface1`/`surface2` → `surface`/`surfaceRaised`** (F4 alt) — matches the playbook vocabulary
  but is pure churn across every consumer; rejected.
- **Text Dark/Light segmented toggle** (status quo) — replaced by the icon toggle.

## Binding

- `foundation.ts` gains the rem breakpoint ladder `xs30…2xl90`; `SemanticTheme` gains `scrim` (both modes)
  → `--cs-scrim`; `surface1`/`surface2` naming is **kept** (no rename).
- `gen-tokens-css.ts` emits the 3-prong dark mode (dark `:root` default + `prefers-color-scheme: light`
  OS-seed + manual `[data-theme]` override-wins). The generated `styles/tokens.css` is regenerated
  (`bun run gen:tokens`) in the same change (drift-guarded, ADR-0099).
- ThemeToggle = **icon** control, OS-follow-until-first-click, then pin to `localStorage`; pre-paint
  anti-FOUC script retained.
- A both-modes contrast assertion over the token pairs is added (folds into ADR-0099's matrix).
- Palette A + Structural type center is **unchanged** (ADR-0042/0078).

Implementation in Phase 1 of the harden track. Gate wiring → **ADR-0099**.
