# Design

> impeccable visual doc (seed — pre-implementation). Captures the token foundation: mood, color
> strategy, palette + type candidates, the architecture. Re-run `/impeccable document` once the
> studio renders real tokens to lock the as-built system. Floor: `specs/03-design-framework.md`
> (dark pro-tool center, typed token contract) + `specs/04-voice-and-brand.md` (voice).

> **LOCKED selection (operator, 2026-06-27 — ADR-0042):** Palette **A** "Caisson cold-steel teal" +
> Type **2** "Structural" (Hubot Sans + Martian Mono). Live in `theme.ts` `SELECTED_*` →
> `tokens.css`. The candidate sets below stay on record (append-only); the lock is the pointer.

## Visual theme

A **dark, technical, pro-tool aesthetic** that reads as production-grade infrastructure, not a
marketing template. Depth comes from **tonal surface shifts + hairline borders, never shadows**
(dark-mode rule: elevation = lighter surface). One decisive accent, spent sparingly (Restrained
strategy). Dense, fast, keyboard-friendly, evidence-forward. Reference lineage: Linear / Vercel /
Resend / Warp restraint — but differentiated off that crowd by the caisson concept, never generic
obsidian-plus-neon.

**Mood sentence (the anchor):** _a pressurized steel caisson sunk in cold harbor water — wet dark
steel, a single instrument light, holds under load._ The bg is wet dark steel; the accent is the
instrument light; nothing else glows.

## Color

- **Space:** OKLCH throughout (`oklch(L C H)`). Perceptually-linear L → light/dark is a ramp mirror,
  contrast passes first try. Reduce chroma toward black/white to avoid garish extremes.
- **Strategy:** **Restrained** (the co-equal/product floor) — tinted near-black neutrals + one accent
  carrying ≤10% of surface, reserved for primary action, focus, links, selection. The marketing site
  may dial toward **Committed** per-task (brand override) without changing the identity.
- **Neutrals are tinted toward the accent hue** (chroma 0.008–0.014), not toward a generic warm/cool
  default — subconscious cohesion with the brand. Pure gray is banned.
- **Alpha is a smell:** explicit token colors for tints/overlays, not rgba washes (except focus ring
  / interactive see-through).
- **Dark is default; light is the mirror.** Both authored from day one; dark tuned first.

### Palette candidates (decided live in the studio — `/design/foundations`)

Three directions render as live swatch sets; the operator picks one, it locks into `theme.ts`.
**Recommended: A.** All share the architecture (bg / surface-1 / surface-2 / border / text /
text-muted / accent / accent-tint / focus + functional status set); only hue + chroma differ.

**A — "Caisson" cold-steel teal (RECOMMENDED).** Accent hue ~205 (cold harbor water = the instrument
light). Tightest fit to the name, the mood, AND the market gap (off the saturated-green devtool
crowd). Dark anchors:

```
--cs-bg          oklch(0.16 0.012 220)   wet dark steel
--cs-surface-1   oklch(0.20 0.013 220)
--cs-surface-2   oklch(0.25 0.014 220)
--cs-border      oklch(0.32 0.012 220)   hairline (solid, not alpha)
--cs-text        oklch(0.96 0.004 220)
--cs-text-muted  oklch(0.72 0.012 220)   ~7:1 on bg, AA body
--cs-accent      oklch(0.74 0.115 205)   the instrument light
--cs-on-accent   oklch(0.17 0.02 220)
--cs-accent-tint oklch(0.26 0.040 205)   8% wash surface (explicit)
--cs-focus       = accent
```

**B — "Pressure" deep moss (impeccable seed-182).** Accent hue ~150, a deep cultivated green
(`oklch(0.40 0.106 150)` = "wet stone under shadow" as the deep tint; lifted to `oklch(0.70 0.13
150)` for the accent). Distinctive because it is _deep + desaturated_, not neon — sidesteps the
bright-green reflex while keeping the "all checks pass" semantic adjacency. Neutrals tint hue ~160.

**C — "Bulkhead" near-monochrome.** No chromatic brand accent; cool-steel neutrals (tint hue ~235),
primary CTA is a white fill, the single signal reserved for focus is a restrained cool steel
`oklch(0.78 0.04 230)`. Maximum gravitas (Linear/Vercel). Risk: lower brand recall.

### Functional / status (all candidates, never color-alone — pair glyph + label)

```
success oklch(0.72 0.15 150)   warning oklch(0.78 0.13 75)
danger  oklch(0.65 0.18 25)    info    oklch(0.70 0.12 240)
```

## Typography

**impeccable font procedure.** Brand-voice words (physical object): **engineered · exact ·
load-bearing** — a machinist's certified gauge, a structural blueprint, a pressure-rated bulkhead.
Reflex-rejected (training defaults, banned): Inter, Space Grotesk, IBM Plex, DM Sans. Mono is used as
**evidence/data** (token names, audit artifacts, code), never as costume "technical" decoration.

### Type candidates (decided live — `/design/typography`)

**1 — "Instrument" (RECOMMENDED).** Sans **Geist** + mono **Geist Mono** — one family, two cuts,
free (OFL), built for developer products; dense, neutral, unmistakably production-infra. Mono carries
audit artifacts + token names. (Defended vs reflex: Geist is not on the reject list; chosen for the
infra identity, not category reflex.) Wardfile-aligned alternate: Hanken Grotesk + JetBrains Mono.

**2 — "Structural" (distinctive).** Sans **Hubot Sans** (GitHub's variable engineered grotesk, more
mechanical character) + mono **Martian Mono** (wide, technical) for labels/eyebrows. More ownable.

**3 — "Quiet minimal."** Single family (Geist) across everything, hierarchy by weight + size only —
maximum restraint (Linear). Reads calmest; least typographic personality.

### Scale

Modular, ratio ≥1.25, fluid `clamp()` on headings. Display ceiling ≤6rem; letter-spacing floor
≥-0.04em on display. Light-on-dark: +0.05 line-height and body weight 350 (light type reads heavier).
`text-wrap: balance` on h1–h3, `pretty` on prose. Body line length 65–75ch.

## Token architecture

Wardfile-proven pattern (refines specs/03 §2's vanilla-extract _mechanism_ — same typed-contract
guarantee, identical values; **flagged as a reversible build-decision to ratify**, not a brand fork):

- **Source of truth:** flat typed TS objects in `packages/ui/src/tokens/` — `foundation.ts` (type
  scale / spacing / radius / weights / font stacks), `palette.ts` (primitive OKLCH ramps),
  `theme.ts` (semantic light/dark roles), `candidates.ts` (the A/B/C option sets), `index.ts` barrel.
- **Emit:** `packages/ui/scripts/gen-tokens-css.ts` → committed `packages/ui/styles/tokens.css`
  (`--cs-*` CSS vars, `:root`/`[data-theme]`). Deterministic, drift-guarded.
- **Two layers:** primitive (`palette.ts` ramps) → semantic (`theme.ts` roles). Dark mode redefines
  only the semantic layer.
- **Consume:** apps import `@caisson/ui/styles/tokens.css` + read TS objects for candidate rendering.

## Layout

Generous, varied spacing (`clamp()` that breathes). Flex for 1D, Grid for 2D; breakpoint-free grids
via `repeat(auto-fit, minmax(280px, 1fr))`. Semantic z-index scale. Cards only when the best
affordance; never nested. Swatch/specimen surfaces in the studio are data-dense by design.

## Motion

Minimal and intentional. Ease-out exponential (quart/quint), no bounce/elastic. Theme toggle +
swatch hover are the only motions in this pass. Every animation has a `prefers-reduced-motion`
crossfade/instant fallback. No reveal-on-scroll reflex.

## Components

Deferred (scope this pass = palette + type only). Next: button / surface / text primitives rendered
in a live `/design/components` gallery with `[data-theme]` toggle (Wardfile pattern).

## Studio surfaces (this pass)

`apps/studio` (Next 15, port 3020), dark by default, `[data-theme]` light toggle:

- `/` — design hub: readiness board + links.
- `/design/foundations` — the three palette candidates as live swatch sets + contrast read-out;
  recommended marked. The decision surface for the accent fork.
- `/design/typography` — the three type candidates as live specimens (scale, weights, mono sample);
  recommended marked.

Later passes add: `/design/motion`, `/design/components`, `/design/wordmark`, `/design/voice`.
