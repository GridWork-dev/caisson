# ADR-0040 — Design-system foundation: palette + type lock

**Status:** accepted · 2026-06-27
**Relates:** specs/03 (design framework), specs/04 (voice & brand), ADR-0013 (positioning),
ADR-0014 (name), PRODUCT.md, DESIGN.md. **Supersedes:** none (refines the specs/03 §2 token
emit-mechanism; see below).

The first locked selection of the Caisson design token contract, picked by the operator in the
design studio (`apps/studio`, the Wardfile-pattern A/B/C decision surface).

**Palette — A "Caisson" cold-steel teal.** Near-black wet-steel neutrals (OKLCH, tinted hue ~220),
one decisive accent `oklch(0.74 0.115 205)` — cold harbor water, the single instrument light.
Restrained strategy (accent ≤10%, semantic-first); dark default + light mirror. Every semantic pair
clears WCAG AA (fg 17.27:1, fg-muted 7.84:1, accent 8.77:1 large, on-accent 8.63:1). Mood anchor: a
pressurized steel caisson sunk in cold harbor water; wet dark steel, one instrument light, holds
under load.

**Type — 2 "Structural."** Sans **Hubot Sans** (GitHub's engineered variable grotesk), mono
**Martian Mono** (wide, technical) for labels and evidence. Chosen over the recommended "Instrument"
(Geist) for more mechanical, ownable character. Mono carries evidence (token names, audit
artifacts), never costume. Picked past the impeccable reflex-reject families (Inter, Space Grotesk,
IBM Plex).

**Architecture.** Flat typed TS token objects (`packages/ui/src/tokens`: foundation, candidates,
theme) → `gen-tokens-css.ts` → committed `styles/tokens.css` (`--cs-*` vars). This refines the
specs/03 §2 _emit mechanism_ from vanilla-extract to the Wardfile gen-script pattern — identical
token values, typed-contract guarantee preserved. The candidate sets (A/B/C palettes, 1/2/3 type)
stay in `candidates.ts`; the lock is the `SELECTED_*` pointer in `theme.ts`.

**Rejected:** palette B (deep moss — distinctive but green-adjacent to the devtool crowd), C
(near-mono — gravitas, low brand recall); type 1 (Geist — safest, less ownable), 3 (Hanken Grotesk +
JetBrains Mono — warmer, less mechanical edge).

**Binding:** every Caisson surface (marketing, docs, dashboards, the shipped `ui` floor) themes
against this contract; re-skin = swap tokens, never fork components. WCAG 2.2 AA floor; status never
color-alone (glyph + label). Changing the pick moves the `SELECTED_*` pointer and regenerates
`tokens.css`; candidate sets are append-only.
