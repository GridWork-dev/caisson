# DESIGN.md — Caisson brand book

The operating manual for Caisson's visual system (the as-built lock — supersedes the
pre-implementation seed, recoverable in git history). Locked by **ADR-0042** (palette + type center)
and **ADR-0078** (mark · iconography · illustration · motion · elevation). The `impeccable` craft
flow reads this file as design context; every marketing/docs surface conforms to it. Tokens are the
contract — `packages/ui/src/tokens` → `--cs-*` (run `bun run gen:tokens` after a token edit).

> **One line:** a dark, technical, pro-tool instrument. Wet steel, one cold instrument light,
> evidence over adjectives. It reads as production-grade because it _is_.
>
> **Mood anchor:** a pressurized steel caisson sunk in cold harbor water — wet dark steel, a single
> instrument light, holds under load. The bg is wet steel; the accent is the instrument light;
> nothing else glows.

---

## 1. Logo — wordmark + glyph

- **Wordmark:** lowercase `caisson` in Martian Mono, fixed optical tracking (`-0.02em`).
  **Monochrome always** — the accent never enters the wordmark (protects the ≤10% accent budget).
  `Caisson` capitalized is allowed in prose and `<title>` tags.
- **Glyph:** the **waterline-over-chamber** mark (a hairline waterline above a chambered box = a
  watertight foundation holding under load). Abstract geometry, **not** an icon-mascot. The favicon
  (`app/icon.svg`) carries the accent waterline; in-product (`<Wordmark/>`, `<Glyph/>`) it is
  monochrome.
- **Clearspace:** keep clear space ≥ the glyph's cap-height on all sides. Never recolor, rotate,
  outline, gradient, or stretch the wordmark. Nav = glyph + wordmark; footer/OG = glyph + wordmark +
  "compliance-grade infrastructure" descriptor.

## 2. Color

Palette A "cold-steel teal" (hue ~205), one light + one dark theme, **dark is the default**. OKLCH
throughout; neutrals tinted toward the accent hue (chroma 0.008–0.014), pure gray banned. **No
hard-coded hex in the rendered DOM.** Sanctioned hex exceptions (each a context that cannot resolve
`--cs-*`): (1) build-time satori images (`opengraph-image.tsx`, `apple-icon.tsx`, `app/icon.svg`);
(2) browser-chrome metadata that takes no CSS var (viewport `themeColor`, `manifest.ts`
`theme_color`/`background_color`); (3) the last-resort `global-error.tsx` boundary (replaces the
root layout, renders without the token stylesheet); (4) the `@media print` block. All four mirror
the locked palette hex — never an off-brand value.

- **Accent discipline ≤10%.** Accent (`--cs-accent`) appears only on: the primary CTA, the eyebrow,
  the focus ring, the status glyph, and load-bearing code tokens. If accent is on a fourth surface in
  one viewport, cut one.
- **Status is never color-alone** — always glyph + label (`<StatusChip/>` pairs a glyph with
  `--cs-success/warning/danger/info`). WCAG AA at every semantic pair.
- **Surfaces:** `--cs-bg` → `--cs-surface-1` → `--cs-surface-2` is the depth ladder; `--cs-border`
  hairlines separate, `--cs-border-strong` for emphasis. Alpha washes are a smell — use explicit
  tint tokens (`--cs-accent-tint`).

## 3. Type

- **Hubot Sans** — display + body. Body weight **400** (`--cs-weight-body`), never below (350 risked
  thin low-contrast body on dark — ADR-0078 §8).
- **Martian Mono** (`--cs-font-mono`) — the brand surface: wordmark, eyebrows, labels, control-IDs,
  stat tiles, and **all numerals** (tabular figures: `.cs-num` / `font-variant-numeric: tabular-nums`).
- **JetBrains Mono** (`--cs-font-mono-code`) — **multi-line code blocks only** (Martian is too wide
  for read-critical code; the hero RLS denial is long).
- Self-hosted via `next/font` (no render-blocking Google `<link>`). Display type is fluid `clamp()`
  (`--cs-text-display` / `.cs-display`); tracking floor `-0.04em`; `text-wrap: balance` on headlines;
  body line length 52–75ch.

## 4. Iconography

A **Lucide line workhorse** at **2px stroke on a 24px grid**, monochrome, accent only on
active/status — plus **bespoke domain glyphs** for concepts stock libraries lack (`rls`, `worm`,
`audit-chain`, `fail-closed`, `field-crypto`, `evidence-pack`, `caisson`). One surface: `<Icon
name=… />`. Never reach for raw Unicode box glyphs (`▣▤▥`). Reserve the 1px hairline for dividers,
not icons.

## 5. Illustration & the caisson motif

Three-part visual language — **no photography, no 3D glass blobs, no stock diving-bell clip-art:**

1. **Blueprint / cross-section schematics** for the "how it holds" architecture story.
2. **Real code / CI / audit artifacts as proof** — the artifact IS the headline (a framed terminal
   showing the _real_ fail-closed RLS denial, not a marketing illustration).
3. One signature **waterline-device motif** — a recurring horizontal hairline + gradient darkening
   toward the bottom (the OG accent-bar is a proto-version), animatable per §7.

## 6. Elevation & depth

Tonal surface + hairline is the **default**. The **elevation scale** (`--cs-shadow-sm/md/lg`) and the
accent **instrument-glow** (`--cs-glow-accent`) are the deliberate elevation step — cards on hover,
overlays/modals, the framed hero artifact, the primary-CTA hover glow. Shadow is a step, not the
baseline. Utilities: `.cs-elevate-{sm,md,lg}`, `.cs-glow`, `.cs-card--interactive`. (This supersedes
the seed's "never shadows" rule — ADR-0078 §7.)

## 7. Motion — expressive, tokenized

Motion is the one place Caisson allows technical ambition. Fully **tokenized**: `--cs-duration-{fast,
base,slow}` (120/180/240ms), authored curves `--cs-ease-{out,reveal}` (**never the default `ease`**).

- **Transform/opacity-first.** A signature hero animation may demonstrate a real fail-closed event
  (an RLS denial, an audit-chain link appending, a WORM lock engaging) and/or the waterline motif.
- **`prefers-reduced-motion` is honored** and content is **never stuck at `opacity:0`** (the
  `.cs-reveal` hidden state is gated on `.cs-js`; reduced-motion forces it visible).
- **No** animation on keyboard-initiated or high-frequency (≥100/day) actions; **no** looping
  typewriter or gimmick. Scroll reveal is **fade-up-once** (`<Reveal/>`).

## 8. Accent slots (the checkable list)

In any one viewport, accent (`--cs-accent`) is permitted on **only**: 1. the primary CTA
(`.cs-btn--primary`) · 2. the section eyebrow (`.cs-eyebrow`) · 3. the focus ring (`:focus-visible`)
· 4. the active status glyph / chip · 5. load-bearing code tokens (`.cs-tok-accent`). Anything else
uses `--cs-fg`, `--cs-fg-muted`, or a surface tone.

## 9. The anti-boilerplate law — is / is not

Caisson **is**: evidence-forward · dense and fast · keyboard-friendly · spec-sheet honest · dark
pro-tool · monospace-for-proof. The artifact carries the claim.

Caisson **is not** — these boilerplate tells are **banned**:

- ❌ strike-through "was $X now $Y" prices or any scarcity/countdown timer
- ❌ emoji bullet points or emoji in headings
- ❌ "make $$$", revenue screenshots, fake dashboards, testimonial-with-stock-headshot walls
- ❌ gradient-hero SaaS-template look, floating 3D blobs, mesh gradients
- ❌ exclamation-mark hero copy, "🚀 Launch faster", growth-hack voice
- ❌ "we are SOC 2 certified" (Caisson generates evidence; it is **not** an auditor — never imply
  certification; the honesty boundary is technical-vs-administrative)
- ❌ a competitor-vs-competitor feature table for the hero (ADR-0040)
- ❌ rainbow per-bundle colors (one accent; bundles differ by icon + label, ADR-0078 §5)

## 10. Voice (pointer)

Prose voice, banned phrasing, and the dev-kit-noun register live in `specs/04-voice-and-brand.md` +
ADR-0080 (never "platform" / "automate compliance"; owned vocabulary; answer-first). The canonical
cross-surface signature is **"Fail-closed by construction."**

---

_Tokens: `packages/ui/src/tokens` (candidate A/B/C record lives in `candidates.ts`, append-only — the
lock is the `SELECTED_*` pointer in `theme.ts`). Primitives: `packages/ui/src/components` (`Hero`,
`Section`, `Card`, `CodeBlock`/`Terminal`, `StatusChip`, `CredentialStrip`, `BundleCard`,
`SkuMatrix`, `Icon`, `Wordmark`, `Reveal`, `MobileNav`, `Button`, `Faq`, `FeatureGrid`,
`ThemeToggle`, `AppShell`, `DataTable`, `MetricStat`, `MoneyCell`, `LedgerList`, `StatusPill`,
`EmptyState`, `ErrorState`, `LoadingState`, `Glyph`). SEO → ADR-0079, copy → ADR-0080, pricing →
ADR-0081._
