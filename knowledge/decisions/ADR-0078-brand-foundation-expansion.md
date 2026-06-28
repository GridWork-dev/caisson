# ADR-0078 — Brand foundation expansion: mark · iconography · illustration · motion · elevation

**Status:** accepted · 2026-06-27 (Design·Brand·SEO·Copy session — operator-locked across three picker
rounds). **Supersedes:** ADR-0042 (widens it — the locked palette/type center is **kept**; this ADR
adds the mark, wordmark, icon, illustration, motion, and elevation layers, and supersedes ADR-0042's
"depth = tone + hairline, never shadows" rule). **Relates:** ADR-0040 (hero, LOCKED), ADR-0041 (name,
LOCKED), specs/03 (design framework), specs/04 (voice), ADR-0079/0080/0081 (this session). Evidence:
`outputs/specs/design-brand-site-seo/FORK-BOARD.md` (brand forks B1–B27), `outputs/research/design-session/`.

The first locked foundation (ADR-0042) fixed the **token center** — palette A "cold-steel teal" + type 2
"Structural" (Hubot Sans + Martian Mono). That center is **unchanged**. This ADR expands the center into a
full brand system: a logomark, an icon language, an illustration motif, a motion language, and an
elevation scale. Authority order: research informs, impeccable craft laws execute, ADR-0040/0041 stay locked.

## 1. Palette & type — KEEP, widen the mono pairing

- **Palette A (cold-steel teal, hue ~205) is kept** as locked (ADR-0042) — the only researched candidate
  that clears WCAG AA at every semantic pair and escapes the saturated green/violet devtool crowd; tight
  fit to the name and the "instrument light on wet steel" anchor. (B1)
- **Type direction kept** (Hubot Sans display/body), with the **mono pairing revised for code legibility**:
  **Martian Mono** is retained for the brand surface — wordmark, eyebrows, labels, control-IDs, stat tiles,
  and **all numerals (tabular)** — but **multi-line code blocks adopt a narrower code mono** (JetBrains
  Mono, `ui-monospace` fallback) because Martian Mono is very wide and hurts read-critical code (the hero
  RLS denial is long). This is a widening of type 2, not a revert to Geist. (B2, B13, B22)

## 2. Logomark — wordmark + one geometric glyph

- **Wordmark + a single restrained geometric glyph.** The lowercase mono `caisson` wordmark stays primary;
  a **waterline-over-chamber** glyph (a hairline waterline above a chambered box = a watertight foundation
  holding under load) is added for favicon/avatar/chip/tight contexts. It is **abstract geometry, not an
  icon-mascot** (ADR-0041 bans mascots, not geometry — Vercel-triangle precedent). The framed glyph doubles
  as the **maskable app-icon**, closing the missing-favicon gap. (B3, B4)
- **Wordmark treatment:** lowercase `caisson` in a lightly-customized Martian Mono lockup (fixed optical
  tracking + one signature detail), **monochrome always** (the accent never enters the wordmark, protecting
  the ≤10% budget). `Caisson` capitalized is allowed in prose and `<title>` tags. Mark-only in the nav;
  mark + "compliance-grade infrastructure" descriptor in the footer and OG; retire or use the dead
  `.cs-brand .sub` slot. (B5, B6, B27)

## 3. Iconography — line workhorse + bespoke domain glyphs

Replace the ad-hoc Unicode box glyphs (`▣▤▥▦▧`, page.tsx:14) with a real system: a **line workhorse**
(Lucide or Phosphor) tuned to **2px stroke on a 24px grid** with 2px-soft joins, monochrome, accent only on
active/status; **plus ~8–12 bespoke domain glyphs** for the compliance concepts stock libraries lack (RLS,
WORM, audit-chain, fail-closed, per-tenant field-crypto, evidence-pack, the caisson cross-section). Reserve
the 1px hairline for dividers, not icons. (B7, B8)

## 4. Illustration & the caisson motif — blueprint + waterline, no mascot

A three-part visual language: **(a)** blueprint / cross-section **schematics** for the "how it holds"
architecture story; **(b)** real **code / CI / audit artifacts** as proof (the artifact is the headline,
specs/04 §3); **(c)** one signature **waterline-device motif** — a recurring horizontal hairline + gradient
with depth-darkening toward the bottom (the OG accent-bar is a proto-version), animatable under §6. **No
photography, no 3D glass blobs, no stock diving-bell clip-art.** (B9, B10)

## 5. Per-edition identity — one accent, icon + label

The four editions are differentiated by **domain icon + label only**, under one accent (at most a single
muted secondary for the free AGPL flank) — never a per-edition rainbow that dilutes the single instrument
light. Editions read as "the same rigor on an adjacent problem" under the compliance umbrella (ADR-0040),
never as co-heroes. (B14)

## 6. Motion language — EXPRESSIVE, tokenized

Motion is the **one place Caisson allows technical ambition** (operator overrode the restrained
recommendation). A **signature hero animation** demonstrates a real fail-closed event — an RLS query denied
across tenants, an audit-chain link appending, a WORM lock engaging — and/or the waterline/depth motif;
parallax/depth on the hero focal point is permitted. **Bounded by craft law:** fully **tokenized**
(`--cs-duration-{fast,base,slow}` ≈ 120/180/240ms with exit ~20% faster + `--cs-ease-out` authored curves,
never the default `ease`), **transform/opacity-first**, `prefers-reduced-motion` honored with content **never
stuck at `opacity:0`**, **no animation on keyboard-initiated or high-frequency (≥100/day) actions**, and
**never a looping typewriter or gimmick**. The motion tokens land in `foundation.ts`; the existing
reduced-motion reset (global.css:369) finally guards something real. (B11, V3, V36, V41)

## 7. Elevation & depth — ADD an elevation + glow scale (supersedes the no-shadow rule)

ADR-0042 / global.css declared "depth = tonal surface + hairline borders, never shadows." This ADR
**supersedes that rule**: the expanded brand carries a **tokenized elevation scale** —
`--cs-shadow-{sm,md,lg}` + a single accent **instrument-glow** `--cs-glow-accent` — used for cards,
overlays/modals, and the hero focal point, to match the expressive motion direction (operator chose "add
full elevation + glow scale"). Tonal-surface + hairline remains the **default** for flat content; shadow/glow
is the **deliberate elevation step**, not the baseline. Status is still **never color-alone** (glyph +
label, retained from ADR-0042). (B17, B25, V18, V25, V37)

## 8. Brand laws (locked as a set)

- **Code blocks are always-dark** (even in light theme), a restrained cold-steel Shiki theme tuned to the
  palette — code is the evidence hero. (B12)
- **All numerals render in Martian Mono tabular figures** (deltas, counts, ids, dates, balances). (B13)
- **Accent discipline ≤10%:** accent appears only on the primary CTA, the eyebrow, the focus ring, and the
  status glyph — codified as a checkable slot list. (B16)
- **Canonical signature:** "Fail-closed by construction." is the locked cross-surface payoff. (B21)
- **OG hex CI-asserted** against the OKLCH tokens so the sanctioned satori hex exception cannot drift. (B26)
- **Body weight bumped to 400** on dark (350 risks thin low-contrast body), verified against the contrast
  matrix. (B23)

## 9. Brand book — DESIGN.md

Author `DESIGN.md` (logo usage + clearspace, color, type, motion tokens, icon grid, accent slots, elevation,
do/don't, and the **anti-boilerplate "is / is not" law** banning the boilerplate tells: strike-through
prices, scarcity timers, emoji-bullets, "make $", revenue screenshots, gradient-hero, light marketing,
exclamation hero). The `impeccable` flow reads DESIGN.md as design context (`identity/design-doctrine.md`
§5), so it also improves future agent output. (B18, B19)

## Rejected

Warm-copper palette (operator kept teal A); reverting type to Geist (kept Hubot/Martian, widened mono);
wordmark-only (leaves the favicon/avatar gap); per-edition hue-shift rainbow (dilutes the single instrument
light); staying strictly shadowless (operator chose an elevation + glow scale); near-static color-only motion
(operator chose expressive); a full surface-grain texture (deferred — flat reads premium); a per-edition data-viz
color system (deferred — no dashboard surface yet, stub a categorical scale when one ships).

## Binding

ADR-0042's palette A + Structural type stay the locked center. This ADR **widens** that center with the
mark, wordmark, iconography, illustration/waterline motif, expressive tokenized motion, and an elevation +
glow scale — and **supersedes ADR-0042's never-shadows depth rule and emit-mechanism note**. Token additions
(motion, elevation, code-mono, glyph + icon assets, favicon kit) land in `packages/ui` + `apps/site` in the
**build session** (this session is doc-only). The studio candidate sets stay append-only; changing the locked
palette/type pick still moves the `SELECTED_*` pointer (ADR-0042). DESIGN.md is authored before the build
session's first brand commit.
