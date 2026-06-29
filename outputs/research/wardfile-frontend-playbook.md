# Wardfile frontend playbook — transplantable marketing-site + UI system

> **Provenance.** Operator-supplied synthesis (2026-06-29) of how the Wardfile repo builds its
> marketing site + UI, written to be lifted onto another project. **Mechanism (copy this)** is split
> from **Wardfile brand (swap this)** throughout. This is the **reference input** for Caisson's
> ground-up marketing-site rebuild + design-system lock initiative. An external input, not yet a
> Caisson decision — design forks get locked via picker → ADR.
>
> **Caisson already has much of layers 1–2** (ADR-0042 palette/type → ADR-0078 brand expansion;
> `packages/ui` token contract; `apps/studio` gallery; OKLCH token objects → generated `tokens.css`;
> `DESIGN.md`). The initiative's job: map this playbook onto the current system → adopt / harden /
> swap-brand / fill gaps, lock it, sketch in `apps/studio`, then rebuild `apps/site` ground-up.

## The one big idea

Everything hangs off one move: **tokens are authored as typed TypeScript, then code-generated into a
committed CSS-variable sheet.** TS is the source of truth; CSS variables are the build output; every
component reads only `var(--wf-*)`, never a raw value. That single indirection makes the whole system
swappable — rewrite the token TS, regenerate, and every component + marketing page reskins via CSS
cascade with zero component edits.

Three things stack on top:

1. A **component kit** consuming only tokens (Radix behavior + co-located plain CSS + `data-*` variants).
2. A **marketing surface** that's mostly server-rendered data files over a tiny set of brand
   primitives, plus a "real assets, not mockups" video pipeline.
3. A **3-layer quality system** — human doctrine, deterministic CI gates, advisory critic — wired into
   a research→ADR-lock→build→audit→deploy cadence.

## 1. Stack & framework (copy wholesale)

| Layer               | Choice                                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Runtime/PM          | **Bun** (PM + test runner); app on Node runtime                                                                                            |
| Language            | **TS strict-max** — `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, no `any`, no `console.log` |
| Framework           | **Next.js 15 App Router**, React 19 (RSC default, narrow client islands)                                                                   |
| Kit packaging       | **Workspace package shipping raw `.tsx`** (no bundler/dist) + `transpilePackages` in consumers                                             |
| Behavior primitives | **Radix** (`radix-ui` unified pkg) — behavior only, you own all styling                                                                    |
| Styling             | **Plain co-located CSS files**, one per component, reading `var(--wf-*)`. No Tailwind, no cva, no CSS Modules, no vanilla-extract          |
| Icons               | `@phosphor-icons/react` + `optimizePackageImports`                                                                                         |
| Video               | **Remotion** (React→MP4) + **Playwright** (live capture) + ffmpeg encode                                                                   |
| Validation          | **Zod `.strict()`** at every boundary                                                                                                      |
| Boundaries          | `fetchWithTimeout`, `crypto.randomUUID()`, `crypto.timingSafeEqual()`                                                                      |

Deliberate unusual choice: **no class-string library.** Variants are `data-*` attributes styled by
attribute selectors in CSS — keeps variant logic out of JS, makes theming pure cascade.

## 2. The component system / UI kit (the reusable recipe)

**Two-tier token split** — copy exactly:

- **Tier 1 — mode-independent** (`foundation.ts` + raw `brand.ts` + `motion.ts` + status palette):
  fonts, sizes, the 4px space scale, radius, the _one_ breakpoint ladder
  (`xs30 sm40 md48 lg60 xl72 2xl90` rem), easings, raw palette. Don't change light/dark.
- **Tier 2 — semantic, mode-flipping** (`theme.ts`): `bg / surface / surfaceRaised / fg / fgMuted /
border / borderStrong / accent / link / focus / scrim / shadow*`. Concrete `lightTheme` +
  `darkTheme` objects.

**The generator** (`css.ts` → `gen-tokens-css.ts`) walks the TS and emits four blocks into a committed
`tokens.css`:

```
:root { …static + light… }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { …dark… } }
[data-theme="dark"]  { …dark… }   /* manual override wins over system */
[data-theme="light"] { …light… }
```

Dark mode is **three-pronged for free**: system media query, manual `data-theme` override, and a
`ThemeToggle` that seeds from OS, follows live until first click, then pins + persists to
`localStorage`, with a pre-paint inline script to kill FOUC.

**Component recipe** (every component):

- `forwardRef`, `"use client"` only where needed, `asChild` via Radix `Slot`.
- Variants as `data-variant` / `data-size` / `data-status` / `data-surface` attributes.
- Co-located `.css` keys off those attributes:
  `.wf-button[data-variant="primary"] { background: var(--wf-accent) }`.
- Multi-token components use a **local indirection var** — `[data-status="x"]` sets
  `--pill-color/--pill-tint/--pill-glyph` from the matching `--wf-*`, one base rule consumes them.
  Light/dark "just works" because the underlying `--wf-*` already flip; the component never branches on theme.
- BEM-flavored names: block `wf-button`, element `wf-button__icon`.

**Packaging:** `exports` map points at raw source (`"./components/*"`, `"./tokens"`, `"./brand"`,
`"./styles/tokens.css"`). Consumers set `transpilePackages: ["@yourkit/ui"]` + import the CSS once at
root layout. A second consumer — a **`studio/` live gallery** — imports the same kit so gallery +
product can't drift.

**Kit-first rule (a standard):** new reusable UI lands in the package, _never inlined on a screen._
Build order is always tokens → primitives → domain components.

_Swap for a new project:_ token **values** (palette, fonts, radius feel), the brand mark, domain
components. _Keep:_ the two-tier split, the generator, the `data-*`+co-located-CSS recipe, raw-TS
packaging, kit-first rule.

## 3. The marketing site architecture

**Route group per host.** `app/(marketing)/` (apex) vs `app/(app)/` (app subdomain) — parenthesized
groups, zero URL impact; the host split is in `middleware.ts` by Host header, not routing config.

**Server-first, narrow islands.** Pages are RSC. Only `"use client"` islands: nav (disclosure),
waitlist form, video player, billing-cycle toggle. Even the comparison table + landing template are RSC.

**Programmatic SEO = one template + N data files.** A single typed server component (`IntentLadder`)
defines a fixed scaffold — hero → optional proof stats → category card grid → product grid → native
`<details>` FAQ → closing CTA. Each of N keyword landing pages is a **pure data file**: a `metadata`
call + a typed content object + `return <IntentLadder content={content}/>`. Adding an SEO page = one
data file. One `MARKETING_ROUTES` array feeds `sitemap.ts` 1:1.

**Centralized SEO module** (`_seo.ts`): `pageMetadata()` returns canonical + OpenGraph + Twitter;
`jsonLdString()` escapes `<` so a value can't close the script tag; schema.org builders for
Organization, SoftwareApplication, **VideoObject**, FAQPage, Breadcrumb. JSON-LD is CSP-exempt so it
renders cleanly even under a `force-dynamic` (nonce-CSP) layout.

**"Real assets, not mockups" video pipeline** — the standout. Remotion can only render React you give
it; it can't screen-record an app. So:

```
boot the real app hermetically against a marketing seed (Postgres testcontainer + migrations + seeded demo workspace, next start)
  → Playwright captures real screens (desktop+mobile × light+dark)   [reuses the e2e/audit boot+drive substrate]
  → Remotion composites PNGs into hero.mp4 (16:9) + hero-vertical.mp4 (9:16), synthetic cursor + click-ripple on the "value moment"
  → ffmpeg web-encode (~11MB → ~2MB)
  → commit ONLY the encoded deliverables under public/
```

Playback: `<video muted loop playsInline>` gated two ways — **reduced-motion** → static poster, never
start; **IntersectionObserver** → only download/play once scrolled into view.

**Conversion + experimentation, no third-party vendor:** waitlist is a progressive-enhancement server
action (plain `<form action>` upgrading on hydration) over a separately-tested injectable core (Zod,
idempotent `onConflictDoNothing`). A/B assigned **in middleware** via Web Crypto, pinned to a cookie,
written onto the DB row → conversion is a `GROUP BY`. Pre-launch held behind a **coming-soon
middleware gate** (edge-secret + preview-cookie bypass, constant-time compared).

_Swap:_ copy, landing-page content data, brand primitives. _Keep:_ route-group-per-host, template+data
SEO system, centralized `_seo.ts`, capture→Remotion→encode pipeline, gated video player, server-action
waitlist, in-house cookie A/B, coming-soon gate.

## 4. The workflow / cadence

**Locked cadence:** `research → synthesis → grill → design → ADR lock → code`. **No product code
before the spec it implements is locked.**

**One-operator rule:** never auto-decide an open fork. Decisions wait on a live board; once locked →
an **append-only ADR** (never edited — supersede with a later one).

**Design-first sequencing:** lock functional tokens + voice (brand-neutral) → scaffold kit primitives
→ build screens consuming the kit. Brand palette/mark run _in parallel_ because they only set CSS-var
values, so they never block the skeleton. _"Experience drives tokens; tokens + brand drive components.
Each layer is a hard input to the next."_

**Parallel disjoint-tree worktree streams.** Product ∥ design/marketing run as separate branches in
isolated git worktrees off clean main, merged at a barrier. Allowed concurrently _because they touch
disjoint trees_ (`app/states/services` vs `(marketing)/packages/ui`). Remediation runs as **sub-passes
(each its own PR), reconciled by whole-app re-audit at the barrier, not per-surface.**

**Each phase = a 7-act loop:** SPEC (declares tags) → PLAN → EXECUTE (kit-first, atomic) → VERIFY
(goal-backward, gate green + visual proof) → SWEEP → (EVAL) → SHIP (conditional audits on
`ui`/`frontend`/`security` tags).

## 5. The quality system — three strictly-separated layers

The most transferable insight: **don't let a fuzzy AI critic score be your gate.** Split quality into
three layers.

**Layer 1 — Doctrine (human-readable, derived).** `DESIGN.md` is explicitly _distilled from_ the
authoritative token code, not vice-versa — on conflict, the token source wins. Backed by append-only ADRs.

**Layer 2 — Deterministic gates (these block CI).** All in one `bun run check`:

- **Contrast** — WCAG AA over the full token-pair matrix (text 4.5:1, non-text 3.0:1) in **both**
  modes; APCA advisory-only; `--suggest` prints minimal-shift passing hexes.
- **Anti-slop guard** — project-specific regex/AST guard banning house AI-slop tells (side-stripe
  borders, inset edge-bars, pseudo-element accent rails, gradient-clipped text, redundant eyebrows).
  Exists _because the generic `impeccable detect` misses house-specific tells._
- **Copy guard** — parses each file with the **TypeScript compiler**, inspects only string-literal +
  JSX-text contents (never comments/identifiers), bans em-dashes + an AI-slop phrase list in
  user-facing copy.
- **Breakpoint guard** — every `@media` width must be a rung on the one rem ladder (media queries
  can't read CSS vars, so this prevents drift).
- **Token-CSS drift guard** — committed `tokens.css` must byte-match the generator output, so editing
  a token without regenerating fails the suite.
- **axe a11y** (browser E2E, both modes — catches rendered-DOM contrast the matrix can't enumerate) +
  **visual sweep** (~46 surfaces × theme × {desktop, 390px}, asserts no horizontal overflow via a
  **boundingRect detector**, because `scrollWidth` false-greens on clipped overflow).

**Layer 3 — Advisory critic (never blocks).** A `gw-frontend-designer` agent reads 4 screenshots +
the component/token source per surface, scores a 40-pt Nielsen rubric. Its band score **swings ±6
run-to-run, so it's advisory** — tells you where to look, never gates. Findings flow into a
**stable-ID TOML ledger** (`findings.toml`): id = `sha256(workflow∷surface∷normalized-title)`, status
`open|accepted|fixed`; a `reconcile()` step classifies each run into new/regressed/closed/unchanged so
trivial rewording doesn't fork a finding and a fixed-then-reappearing issue flips to `regressed`.

_Swap:_ the specific banned tells, palette thresholds. _Keep:_ the three-layer separation,
gate-on-deterministic-not-on-critic-score, the TS-compiler copy guard, the stable-ID reconciling
ledger, axe-both-modes + boundingRect overflow.

## What to lift, in order

1. **Tokens-as-TS + codegen-to-CSS-vars** (two-tier: foundation/raw vs semantic-flipping). Everything depends on this.
2. **Component recipe**: Radix behavior + co-located CSS + `data-*` variants + local indirection vars. Kit-first rule.
3. **Raw-TS workspace package** + `transpilePackages` + a `studio/` live gallery consumer.
4. **Marketing**: route-group-per-host, `IntentLadder` template + data-file SEO pages, centralized
   `_seo.ts`, server-action waitlist, middleware A/B + coming-soon gate.
5. **Video pipeline**: hermetic-boot → Playwright capture → Remotion composite → ffmpeg → commit encoded only.
6. **3-layer quality**: doctrine ADRs / deterministic CI gates / advisory ledgered critic.
7. **Cadence**: research→ADR-lock→build→audit→deploy, disjoint-tree worktree streams, 7-act phases.
