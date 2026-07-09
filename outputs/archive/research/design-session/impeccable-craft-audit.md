# Impeccable Craft Audit — Caisson `apps/site` marketing surface

**Date:** 2026-06-27
**Auditor:** `gw-frontend-designer` (impeccable detector pass, refero-grounded)
**Scope:** `apps/site` marketing (`/`, `/compliance`, `/ai-kit`, `/local-first`, `/agentic-dev`, `/pricing`), shared layout, `site-nav` / `site-footer` / `theme-toggle` / `waitlist-form`, `lib/contrast.ts`, and the `packages/ui` token contract (`foundation` / `theme` / `candidates`).
**Authority order applied:** brand (`design-system.md` + locked ADRs 0040–0042) > craft (impeccable) > research (Refero). Nothing here relitigates a LOCKED ADR; ADR-0042 is the one foundation flagged for _expansion_ this session.

---

## 0. Method & verdict

This is a **detector pass**: I read every file in scope, resolved every `--cs-*` reference against the generator (`gen-tokens-css.ts`) to confirm no broken tokens, computed the live WCAG ratios for every painted text/UI pair (script in scratchpad, `culori.wcagContrast` — the same engine `lib/contrast.ts` wraps), and grounded the visual forks in a Refero style pass.

**Headline:** the surface is _correct and on-voice_ — tonal-surface-plus-hairline depth is applied consistently, no `#000`/`#fff`, no shadows, OKLCH throughout, evidence-over-adjectives copy is real. What it is **not yet** is _crafted_: heroes are half-empty on desktop, the code block (the literal hero motif and the whole "show the receipt" thesis) is a flat monochrome `<pre>`, there is zero motion, cards that are links have no hover affordance, the light theme ships **4 real contrast failures** (including error text), and the contrast guard that should catch them tests a stale hand-copy of the tokens and omits the exact failing pairs. The inline-`style={{}}` duplication has the hero `<h1>` block copy-pasted byte-identical across 6 files.

**Refero grounding (the peer set this surface lives in):**

- **Warp** — `https://warp.dev/terminal` (Refero `40a9c295…`) — near-black canvas, elevation by surface-color steps only (no shadows), a _single_ chromatic accent reserved for eyebrows, display tracking −0.04em mandatory, code-block-as-hero, an explicit motion system (0.4s mechanical ease for state, 0.15s hover, **never** transform on nav). This is Caisson's design twin; its discipline is the bar.
- **SST** — `https://sst.dev` (Refero `7b6c53c7…`) — code block is _the_ visual motif with semantic syntax color and a split hero (headline + code card side by side). Directly relevant to Caisson's empty-right-half heroes and monochrome code.
- **Depot** `depot.dev` (`707c2922…`), **Supabase** `supabase.com` (`28aeb534…`), **Inngest** `inngest.com` (`46bfdc1b…` — amber single-instrument-light, closest to the "cold-steel teal" concept), **Linear changelog** `linear.app/changelog` (`11d3e58a…`), **Trunk** `trunk.io`, **Checkly** `checklyhq.com` — the full dark-devtools cohort, all using tonal+hairline depth.

---

## 1. Severity-tagged findings

### P0 — ship-blockers (a11y / correctness)

**P0-1 · Light-theme error text fails WCAG AA.**
`--cs-danger` = `oklch(0.65 0.18 25)` (`candidates.ts:13`) is painted as the waitlist **error message** text (`waitlist-form.tsx:90`, `color: var(--cs-danger)`). Computed ratio in light theme: **3.42:1 on `--cs-bg`**, **3.28:1 on `--cs-surface-1`** — both below the 4.5:1 floor for 14px body text. This is the one string a user _must_ read when something breaks, and it is illegible to low-vision users in light mode. (Dark mode passes: 5.51 / 5.13.) Fix: darken the light-theme danger token (e.g. `oklch(0.52 0.20 25)` → ~5.6:1) or add a `dangerText` role distinct from the `danger` fill.

**P0-2 · The contrast guard tests a stale hand-copy and omits the failing pairs.**
`lib/contrast.ts` exists and is _correct_, but it is **only** exercised by `contrast.test.ts`, which (a) hard-codes a duplicate of the dark/light token values inline (`contrast.test.ts:7–25`) instead of importing them from `@caisson/ui`, so a palette edit in `candidates.ts` leaves the test passing against dead values; and (b) checks only a subset — it verifies `fgMuted`-on-`bg` but **not** `danger`-on-`bg`, `danger`-on-`surface1`, `accent`-on-`surface1`, or `accent`-on-`accentTint`, which are exactly the pairs that fail (P0-1, P1-1). The guard gives false confidence. Fix: import the live `darkTheme`/`lightTheme`, and enumerate _every_ painted pair (drive it from a pair manifest).

### P1 — high (craft floor / a11y / brand)

**P1-1 · Light-theme accent glyphs miss AA.** `--cs-accent` on `--cs-surface-1` = **4.32:1**, on `--cs-accent-tint` = **3.81:1** (light theme). The status glyphs (`.cs-status .glyph`, `global.css:287`) and the pricing `+` bullets (`pricing/page.tsx:146`) render at these pairs. They are `aria-hidden` decorative, so this is not a hard SC 1.4.3 failure, but they are _meaningful_ marks at small size and sit right under the 4.5 line — any hue drift breaks them. Razor-thin neighbours: light eyebrow accent-on-bg = **4.51**, light button label `onAccent`-on-`accent` = **4.51**. Three values within 0.02 of failing is a system with no margin. Fix: nudge light-theme `accent`/`onAccent` ~3–4% darker.

**P1-2 · No motion system at all.** The only transitions in the codebase are 120ms `color`/`border`/`background` on nav links and `.cs-btn` (`global.css:166`, `205–209`). There is no hover affordance on cards, no press feedback, no scroll-reveal, no copy-button, no theme-switch transition. The `prefers-reduced-motion` block (`global.css:369`) is correctly in place — but it currently guards _nothing_. For a brand whose adjectives are "calm, exact, mechanical," the absence of motion reads as _unfinished_, not _restrained_. (See Fork V-1 for the inventory.) Evidence: Warp ships a documented 0.4s-state / 0.15s-hover system; Linear/Inngest both do a subtle scroll reveal.

**P1-3 · Clickable cards have zero hover affordance.** The edition cards on `/` (`page.tsx:175–202`) and the footer/SKU cards are `<Link>`s, but `.cs-card` (`global.css:232–237`) has no `:hover` rule — no border brighten, no surface step, no cursor cue beyond the anchor default. A clickable card that looks identical on hover fails the most basic affordance test. Fix: `.cs-card` as a link → hover steps `surface-1 → surface-2` and `border → border-strong` (tonal, no shadow — on-brand). This is also the natural home for the depth-on-hover the no-shadow rule otherwise forbids.

**P1-4 · The code block — the hero motif — is a flat monochrome `<pre>`.** `.cs-code` (`global.css:304–315`) paints every line in a single `--cs-fg`. But the code blocks _are the pitch_: `ERROR: permission denied` (`page.tsx:106`), `BREAKER OPEN` (`ai-kit/page.tsx:105`), `chain intact … 0 breaks` (`compliance/page.tsx:60`), `egress none` (`local-first/page.tsx:98`). The single most load-bearing lines on the site render visually flat, indistinguishable from comments. Both SST and Warp treat the code surface as the hero object (SST with semantic syntax color, Warp on a distinct deeper surface with chrome). This is the highest-leverage craft gap. Fix: see Fork V-3 (semantic line-tint + chrome + label), not full rainbow highlighting.

**P1-5 · Heroes are half-empty on desktop.** Every hero is a single left-aligned column inside a 1140px container, with the lede capped at 62–64ch and the code block at 60–62ch (`page.tsx:78,102`). The entire right half of every hero above the fold is dead space. The reference set overwhelmingly splits the hero (SST headline-right/code-left, Polar form-left/JSON-right, Warp CTA + code side-by-side). Fix: see Fork V-2 (split hero, code/terminal as the right anchor).

**P1-6 · Fonts bypass the brand-floor loader and the body weight may not load.**
(a) `design-system.md:40` mandates `next/font` with `display: swap`; the site instead injects a raw `<link rel="stylesheet">` to `fonts.googleapis.com` (`layout.tsx:43–49`) — render-blocking, two extra preconnects, no self-host, and it must be in the ADR-0047 CSP (which "names only plausible.io"). (b) The body weight is `350` (`foundation.ts:24`) but the Google href requests the discrete instances `wght@300;400;500;600;700` (`layout.tsx:33`), **not** the continuous axis `wght@300..700`. Whether 350 renders depends on Google clamping discrete tuples to a range — fragile and implementation-dependent. Fix: move to `next/font` (self-host Hubot Sans + Martian Mono) **or** request `:wght@300..700` so the 350 axis instance is guaranteed; and confirm the font origins are in the CSP.

**P1-7 · No `og:image` / Twitter card.** `layout.tsx:20–26` sets `openGraph` title/description/url but **no `images`**, and there is no `twitter` block. Every share of `caisson.sh` on Slack/LinkedIn/X renders as a bare text link — for a launch surface this is a measurable conversion leak. (SEO surface.) Fix: add a static OG image (the hero `ERROR: …fail-closed` transcript on the dark canvas would be perfectly on-brand and on-voice) + `twitter:card=summary_large_image`.

### P2 — medium (polish / consistency / debt)

**P2-1 · Hero `<h1>` block is copy-pasted inline across 6 files.** The identical 11-line `style={{ fontSize: var(--cs-text-display) … maxWidth }}` object appears in `page.tsx:66–77`, `compliance:91–100`, `ai-kit:62–72`, `local-first:49–58`, `agentic-dev:47–58`, `pricing:168–178`. Same for the CTA row (`page.tsx:83–90` ×4) and the card-head flex (`page.tsx:184–191`, `pricing:219–226`). Drift is now a matter of _when_. (See Fork V-5.)

**P2-2 · Heading semantics for card titles are inconsistent.** Card titles are an `<h3>` on `/compliance` (`compliance:159`) but a `<span class="cs-card-title">` on `/` editions (`page.tsx:192`) and a `<div class="cs-card-title">` on the SKU cards (`page.tsx:225`, `pricing:227`). And the **footer column headings** ("Editions"/"Product"/"Resources") are rendered as `<div class="cs-status">` (`site-footer.tsx:50–54`) — a status-pill style standing in for a heading, with no heading element. Screen-reader heading navigation is uneven page-to-page. Fix: settle one rule (card title = `<h3>` when the card has body content; footer headings = real `<h2>`/`<h3>` or `<p>` with an `id` + `aria-labelledby` on the `<nav>`).

**P2-3 · `.cs-status` is overloaded four ways.** It is the class for: real status pills ("Roadmap", `agentic-dev:41`), in-card eyebrow labels (`page.tsx:142`), footer headings (`site-footer.tsx:51`), and form success/error (`waitlist-form.tsx:39,89`). One visual token doing four semantic jobs makes every future change ambiguous. Fix: split into `.cs-pill` (status), `.cs-label` (card eyebrow), `.cs-msg` (form feedback); footer heading gets its own.

**P2-4 · `.cs-btn` has no `:active` and no real `:disabled`.** `global.css:194–229` defines base + primary/ghost hover only. The waitlist submit gets the `disabled` attribute (`waitlist-form.tsx:83`) but no disabled styling — a disabled "Joining…" button looks identical to an active one (just label-swapped). No press feedback anywhere. Fix: `:active { filter: brightness(0.95) }` or a 0.5px nudge; `:disabled { opacity: .55; cursor: not-allowed }`.

**P2-5 · Flat hierarchy between hero and section heads.** Display clamps up to 5.5rem (88px); the very next level, `.cs-section-title`, is `--cs-text-3xl` = 30px (`global.css:118`). The scale _defines_ `4xl` (2.5rem) and `5xl` (3.25rem) (`foundation.ts:16–17`) but **nothing on the marketing pages uses them** — section heads jump straight from an 88px hero to 30px. The mid-scale is dead weight and the page reads as "one giant title, then everything is small." Fix: promote primary section titles to `4xl`, or introduce a `2xl` sub-hero on the long edition pages.

**P2-6 · The theme switch is an instant repaint.** No `color`/`background` transition exists on `body`/surfaces (`global.css:52–63` has none), so toggling Dark/Light in the nav (`theme-toggle.tsx`) hard-cuts every surface at once — jarring on a site whose whole tone is "calm." Fix: a scoped `transition: background-color 200ms, color 200ms` on `body` and `.cs-card`/`.cs-nav`/`.cs-code`, guarded by `prefers-reduced-motion`. (Decide vs. intentional-instant — Fork V-1.)

**P2-7 · Spacing rhythm is uniform and set inline.** Every `.cs-section` is a flat 96px block (`--cs-space-24`, `global.css:97`); the inter-element gaps (eyebrow→title→lede→grid) are set ad-hoc inline per section (`marginTop: var(--cs-space-8)` ≈ 30 occurrences) rather than by a flow rule. Result: a dense 6-card grid section and a single-sentence "umbrella" statement section (`page.tsx:114`) get the exact same vertical envelope, and the rhythm can't be tuned in one place. Fix: a `.cs-stack`/`.cs-flow > * + *` owns intra-section spacing; vary section padding by density (sparse statement sections can breathe more).

**P2-8 · Nav does not adapt below 860px.** `.cs-nav` (`global.css:143`) is a flex row with brand + **5** links + a segmented Dark/Light toggle, and there is no collapse, hamburger, or disclosure at any width (`site-nav.tsx` has no responsive branch; the only `@media` is for grids/footer). At ~700px this row crowds or wraps. Fix: collapse the link set into a menu below ~760px (and/or move the theme toggle into it).

**P2-9 · `.cs-tag` does not differentiate meaningful states.** "Hero", "#2", "Free · AGPL", "Roadmap" all render the same muted hairline chip (`global.css:293–302`). "Hero" (the flagship) and "Roadmap" (not shipped) carry opposite weight but look identical. Fix: a variant for the flagship (accent-tinted) and one for roadmap/unshipped (dimmer or dashed border).

**P2-10 · `:focus-visible` applies a global `border-radius`.** `global.css:70–74` sets `border-radius: var(--cs-radius-sm)` on _every_ focused element. On a focused inline link or a pill button this momentarily reshapes the element's corners on focus (it does not clip the outline). Harmless but sloppy. Fix: drop the `border-radius` from the global focus rule; let each component own its radius.

**P2-11 · Dead CSS / unused affordances.** `.cs-brand .sub` (`global.css:187–191`) is defined but never rendered (the brand only emits `.mark`). The `--cs-text-4xl`/`5xl` scale steps are unused (P2-5). Minor, but the system already carries cruft at scaffold stage.

**P2-12 · Inline `--cs-link` color instead of a class.** `style={{ color: "var(--cs-link)" }}` is repeated on the "see the full lineup" links (`page.tsx:239`, `compliance:315`, `ai-kit:217`). There is no `.cs-link` / link-in-prose style, so inline links elsewhere inherit body color with no underline and no hover. Fix: a `.cs-link` class (color + underline-offset + hover), and an inline-prose-link default.

**P2-13 · Waitlist input is inline-styled and weakly wired for a11y.** The `<input>` carries an 11-property inline style (`waitlist-form.tsx:67–78`) instead of a `.cs-input` class, has no `:focus` treatment beyond the global outline, the visually-hidden label uses the legacy `left:-9999px` technique (`:55`), and the error `<p role="alert">` is not linked to the field via `aria-describedby`. Fix: `.cs-input` class with a focus ring; `.sr-only` clip pattern; `aria-describedby` → error id; `aria-invalid` on error.

**P2-14 · No skip-to-content link.** Sticky nav (`global.css:144`) + 5 links means keyboard users tab the nav on every page before reaching `<main>`. A standard `Skip to content` link is absent. Fix: add a visually-hidden-until-focus skip link as the first focusable element.

**P2-15 · Eyebrow tracking is tight for an uppercase mono label.** `.cs-eyebrow` uses `--cs-tracking-wide` = 0.02em (`global.css:113` / `foundation.ts:40`). Uppercase mono "instrument labels" read better wider — Warp tracks eyebrows at 0.1em. At 0.02em the eyebrow reads as cramped small-caps rather than a deliberate terminal-prompt label. Fix: a dedicated `--cs-tracking-eyebrow` ≈ 0.08–0.12em.

**P2-16 · The hero eyebrow duplicates the tagline, then the H1.** On `/`, the eyebrow is the locked tagline verbatim (`page.tsx:63–65`) immediately above the H1 — two brand lines stacked before any new information. On-brand but redundant; consider making the eyebrow a section/context label ("Compliance edition · Hero") and letting the tagline live once (footer + meta). (Copy surface — non-locked placement.)

---

## 2. Token-integrity spot-check (passed)

Every `--cs-*` referenced by the pages resolves to an emitted variable (verified against `gen-tokens-css.ts:36–64`): `--cs-text-display`, `--cs-tracking-tighter`, `--cs-leading-tight`, `--cs-weight-semibold`, `--cs-space-{1..24}`, `--cs-link`, `--cs-danger`, `--cs-on-accent`, `--cs-accent-tint`, `--cs-border-strong`, `--cs-radius-pill`, `--cs-tracking-wide`. No broken-token references found. The OKLCH discipline (no hex, no `rgba`) holds across `global.css`, every page, and `candidates.ts`. Depth = tonal surface + hairline border with **zero** `box-shadow` — verified site-wide, fully on-brand and consistent.

**Full computed WCAG matrix** (engine: `culori.wcagContrast`; 4.5 = AA body, 3.0 = AA large/UI):

| Pair                    | Dark     | Light       | Note                                              |
| ----------------------- | -------- | ----------- | ------------------------------------------------- |
| fg / bg                 | 17.27 ✅ | 16.78 ✅    | body                                              |
| fg / surface1           | 16.10 ✅ | 16.08 ✅    | card heading                                      |
| fgMuted / bg            | 7.84 ✅  | 7.19 ✅     | lede                                              |
| **fgMuted / surface1**  | 7.31 ✅  | 6.88 ✅     | card body (`.cs-muted`) — _untested by the guard_ |
| fgMuted / surface2      | 6.45 ✅  | 6.40 ✅     |                                                   |
| fgMuted / accentTint    | 6.21 ✅  | 6.07 ✅     | muted in accent card                              |
| accent eyebrow / bg     | 8.77 ✅  | **4.51 ⚠️** | razor-thin in light                               |
| **accent / surface1**   | 8.18 ✅  | **4.32 ❌** | status glyph in light                             |
| **accent / accentTint** | 6.95 ✅  | **3.81 ❌** | glyph in accent card, light                       |
| link / bg               | 10.04 ✅ | 5.57 ✅     |                                                   |
| onAccent / accent       | 8.63 ✅  | **4.51 ⚠️** | button label, razor-thin                          |
| **danger / bg**         | 5.51 ✅  | **3.42 ❌** | error text — light                                |
| **danger / surface1**   | 5.13 ✅  | **3.28 ❌** | error text in form — light                        |

Three ❌ + two ⚠️, all light-theme, none currently asserted by `contrast.test.ts`.

---

## 3. Visual / craft decision forks

Each is a real open decision. `individual:true` = brand-expansion or hero-adjacent → present to the operator on its own, not batched.

| #   | Surface | Decision                                              | Recommend                              | Conf   | Individual |
| --- | ------- | ----------------------------------------------------- | -------------------------------------- | ------ | ---------- |
| V-1 | visual  | Motion tier                                           | **B: Restrained system**               | high   | no         |
| V-2 | visual  | Hero composition                                      | **A: Split, code as right anchor**     | high   | yes        |
| V-3 | visual  | Code-block treatment                                  | **B: Semantic tint + chrome + label**  | high   | no         |
| V-4 | visual  | Card elevation/hover                                  | **B: Tonal step on hover**             | high   | no         |
| V-5 | visual  | Inline-style → class refactor                         | **B: Extract recurring patterns**      | high   | no         |
| V-6 | visual  | Responsive breakpoint strategy                        | **B: Add intermediate + nav collapse** | medium | no         |
| V-7 | visual  | Type-scale hierarchy (hero→section)                   | **B: Promote section heads to 4xl**    | medium | no         |
| B-1 | brand   | Iconography system (replace geometric Unicode glyphs) | **B: Monoline custom set**             | medium | yes        |
| B-2 | brand   | Accent "instrument light" expression                  | **A: eyebrow + code-prompt only**      | medium | yes        |
| B-3 | brand   | Light-theme contrast remediation                      | **A: darken danger + accent**          | high   | no         |
| B-4 | brand   | Font delivery (next/font vs link)                     | **A: next/font self-host**             | high   | no         |
| S-1 | seo     | OG / social card                                      | **A: static branded OG + twitter**     | high   | no         |
| C-1 | copy    | Hero eyebrow redundancy                               | **B: context label, tagline once**     | low    | no         |
| C-2 | copy    | Pricing `$199 kits` jab                               | **A: keep (on named-enemy voice)**     | low    | no         |

### V-1 · Motion tier _(surface: visual)_

**Q:** What is the right restrained motion inventory for a "calm, exact, mechanical" infra brand that currently has none?

- **A: Color-only (status quo)** — 120ms color transitions, nothing else. _Tradeoff:_ safest, but reads unfinished and leaves `prefers-reduced-motion` guarding nothing.
- **B: Restrained system (recommended)** — (1) button `:active` brightness + 0.5px nudge; (2) card hover tonal step (V-4); (3) one scroll-reveal: fade + 8px rise, 400ms, staggered for grids, `IntersectionObserver`, hard-disabled under reduced-motion; (4) code-block copy-button fade-in; (5) 200ms theme-switch color crossfade. _Tradeoff:_ one focused build, gives the brand life without bounce.
- **C: Expressive** — add hero glyph pulse / code-block scanline / parallax. _Tradeoff:_ fights "calm"; off-brand.
  **Recommendation:** B. **Evidence:** Warp's documented system — 0.4s mechanical ease for state, 0.15s hover, _never transform on nav_ (Refero `40a9c295…` Motion System); Linear/Inngest both ship a subtle scroll reveal. **File:** `global.css:205,369` (transitions + the idle reduced-motion block).

### V-2 · Hero composition _(surface: visual — individual)_

**Q:** How to resolve the empty right half of every hero on desktop?

- **A: Split — code/terminal as the right anchor (recommended)** — headline+lede+CTA left (the column it already is), the evidence `<pre>` (today below the CTA) promoted to a framed terminal card on the right. _Tradeoff:_ fills the space, makes the proof the hero object, matches the peer pattern; needs a real responsive stack.
- **B: Centered stack** — center headline+lede+CTA+code (Supabase/Vapi). _Tradeoff:_ symmetric and simple, but loses the left-aligned "spec document" feel and keeps the code narrow.
- **C: Left column + ambient right** — keep single column, add a faint monochrome schematic of the RLS→WORM→audit-chain pipeline on the right (Trunk/Inngest blueprint motif). _Tradeoff:_ fills space without product UI, but decorative rather than evidential.
  **Recommendation:** A (home + edition heroes), optionally with C's faint blueprint grid as a section _background_ texture. **Conf:** high. **Evidence:** SST split hero (headline-right / code-card-left, Refero `7b6c53c7…` Layout); Polar onboarding split (form-left / JSON-right, Refero screen `9217d213…`); Warp CTA + code side-by-side. **File:** `page.tsx:60–111`.

### V-3 · Code-block treatment _(surface: visual)_

**Q:** The code block is the hero motif and the entire "show the receipt" thesis — how much craft does it get?

- **A: Monochrome (status quo)** — flat `--cs-fg` on `surface-1`. _Tradeoff:_ the `ERROR`/`BREAKER OPEN`/`chain intact` proof lines render visually flat, indistinguishable from comments and from a plain card.
- **B: Semantic tint + chrome + label (recommended)** — give code a _distinct deeper_ surface (a near-black step below `surface-1`) with a top chrome bar carrying the command label ("psql", "caisson.ai.toml", "caisson where-compute"); tint **only** the load-bearing tokens — denial/`ERROR`/`BREAKER` → `danger`; `ok`/`intact`/`none`/`0 breaks` → muted `success`; comments + prompts → `fg-muted`/`accent`. Copy-button on install commands. _Tradeoff:_ one component build; turns the proof into something readable at a glance and reinforces fail-closed. Stays 3–4 colors, not rainbow.
- **C: Full syntax highlighting (Shiki at build)** — SST-style multicolor. _Tradeoff:_ most premium, but risks "rainbow" against the restrained palette and adds a build dependency for marketing copy.
  **Recommendation:** B. **Conf:** high. **Evidence:** Warp Code Snippet Block on a distinct `#353534` surface with chrome (Refero `40a9c295…`); SST "code block is the main visual motif" with semantic color (`7b6c53c7…`). **File:** `global.css:304–315`; the proof lines at `page.tsx:106`, `compliance/page.tsx:60`, `ai-kit/page.tsx:105`, `local-first/page.tsx:98`.

### V-4 · Card elevation / hover _(surface: visual)_

**Q:** How do cards (several are clickable links) express depth and affordance under a no-shadow rule?

- **A: Flat tonal + hairline (status quo)** — `surface-1` + 1px border, no hover. _Tradeoff:_ on-brand but no affordance; clickable cards look inert.
- **B: Tonal step on hover (recommended)** — rest `surface-1`/`border`; hover `surface-2`/`border-strong` (clickable cards add an `accent`-tinted border); 150ms. _Tradeoff:_ gives depth-via-tone (the one place the no-shadow brand _can_ express elevation) and a real affordance.
- **C: Hairline + inner top highlight** — add a 1px top inset lighter edge for a screen-like bevel (Depot "restrained inset lighting"). _Tradeoff:_ more craft, risks fussiness; best reserved for the accent card only.
  **Recommendation:** B, with C applied only to `.cs-card--accent`. **Conf:** high. **Evidence:** Depot inset-lit cards (`707c2922…`); Warp surface-step elevation `#121212→#1e1e1d→#353534` with _no_ borders/shadows (`40a9c295…` Surfaces). **File:** `global.css:232–243`; clickable cards at `page.tsx:175`.

### V-5 · Inline-style → class refactor _(surface: visual)_

**Q:** How much of the inline `style={{}}` should become reusable classes?

- **A: Leave inline** — _Tradeoff:_ fast, but the hero `<h1>` block is byte-identical in 6 files and will drift.
- **B: Extract recurring patterns (recommended)** — `.cs-display` (hero h1), `.cs-cta-row`, `.cs-card-head`, `.cs-input`, `.cs-link`, `.cs-includes`, `.cs-stack`. Keep genuinely one-off positioning inline. _Tradeoff:_ a contained CSS pass; kills the duplication, one source for the hero.
- **C: React component layer** — `<Hero>`, `<Card>`, `<CodeBlock>`, `<SkuGrid>`. _Tradeoff:_ most maintainable, biggest refactor; right once the page count grows.
  **Recommendation:** B now, C as the page set grows. **Conf:** high. **Evidence (file:line):** identical hero block at `page.tsx:66–77`, `compliance:91–100`, `ai-kit:62–72`, `local-first:49–58`, `agentic-dev:47–58`, `pricing:168–178`; CTA row `page.tsx:83–90` (×4); card-head `page.tsx:184–191` + `pricing:219–226`.

### V-6 · Responsive breakpoint strategy _(surface: visual)_

**Q:** Is a single 860px breakpoint enough?

- **A: Single 860 (status quo)** — _Tradeoff:_ 4-up SKU grid persists to 861px (~200px cards, cramped) then snaps to 1-up; nav never collapses.
- **B: Intermediate + nav collapse (recommended)** — 4→2 at ~1024, {2,3}→1 at ~680, nav links → disclosure at ~760. _Tradeoff:_ a handful of media queries; fixes the cramped mid-range and mobile nav.
- **C: Container queries** — per-grid `@container`. _Tradeoff:_ modern and robust, but a larger rewrite of the grid helpers.
  **Recommendation:** B now, C as the forward path. **Conf:** medium. **Evidence (file:line):** `global.css:268` (only grid breakpoint), `:339` (footer), `site-nav.tsx` (no responsive branch). Heuristic: 4 cards need ≥240px each → 4-up wants ≥~1040px.

### V-7 · Type-scale hierarchy _(surface: visual)_

**Q:** The jump from an 88px hero to a 30px section head is abrupt and the 4xl/5xl steps are unused — fix the mid-scale?

- **A: Keep (status quo)** — _Tradeoff:_ one big title then everything small; flat.
- **B: Promote section heads to 4xl, add a 2xl sub-hero on long pages (recommended)** — _Tradeoff:_ restores a legible H1→H2→H3 ladder, puts the defined-but-dead scale steps to work.
- **C: Lower the display ceiling** — pull the hero down toward 4xl so the gap closes from the top. _Tradeoff:_ calmer, but surrenders hero impact.
  **Recommendation:** B. **Conf:** medium. **Evidence (file:line):** `global.css:118` (section title = 3xl), `foundation.ts:16–20` (4xl/5xl/display defined; 4xl/5xl unused on marketing).

### B-1 · Iconography system _(surface: brand — individual)_

**Q:** The status glyphs are geometric Unicode (`▣▤▥▦▧⊘◷○✓!`) that differ only by interior fill and are near-indistinguishable at 12–14px — adopt a real icon system?

- **A: Keep Unicode geometrics** — _Tradeoff:_ zero deps, but they read as "five boxes" and carry no meaning; `!`/`✓`/`◷` are a different visual language (punctuation vs geometry).
- **B: Monoline custom set (recommended)** — a small mechanical line-icon set (lock/shield = RLS, vault = WORM, chain-link = audit chain, gauge = metering, circuit = breaker, disk = local-first), single stroke weight, accent-on-hover. _Tradeoff:_ a design task, but it's the brand-expansion this session is chartered for (ADR-0042 widening) and turns five identical boxes into meaning.
- **C: Established monoline set (Lucide/Phosphor, restyled)** — _Tradeoff:_ fast and consistent, less ownable than a bespoke set.
  **Recommendation:** B (or C as a bridge). **Conf:** medium. **Evidence (file:line):** glyph defs across the `EVIDENCE`/`MODULES`/`PIECES`/`GUARANTEES` arrays (`page.tsx:14–27`, `ai-kit:13–43`, `local-first:15–40`, `compliance:16–63`); `global.css:287` (`.cs-status .glyph`). Warp/Depot icons: monoline, single-weight, ~16–20px, monochrome.

### B-2 · Accent "instrument light" expression _(surface: brand — individual)_

**Q:** Where is the single teal accent allowed to appear (the "one instrument light in cold water" north star, `candidates.ts:5`)?

- **A: Eyebrow + code-prompt + focus only (recommended)** — accent stays a _rare_ signal: eyebrow labels, the `$`/prompt in code, primary CTA fill, focus ring. _Tradeoff:_ maximal restraint, maximal impact — exactly the Warp/Inngest discipline.
- **B: + accent hairlines on section dividers / active nav underline** — _Tradeoff:_ slightly more brand presence, small risk of diluting the signal.
- **C: + accent glow on the hero code block** — _Tradeoff:_ atmospheric, but glow/gradient is explicitly off the no-shadow, restrained brand.
  **Recommendation:** A. **Conf:** medium. **Evidence:** Warp "apply accent _only_ to eyebrow/subheading — never as button/background/decoration … a second hue breaks restraint" (Refero `40a9c295…` Do/Don't); Inngest single amber precision-highlight (`46bfdc1b…`). **File:** `candidates.ts:24` (accent hue 205), `global.css:114` (eyebrow accent).

### B-3 · Light-theme contrast remediation _(surface: brand)_

**Q:** How to fix the light-theme ❌/⚠️ values (P0-1, P1-1)?

- **A: Darken `danger` + `accent` in light, add `dangerText` role (recommended)** — light `danger` → ~`oklch(0.52 0.20 25)` (≈5.6:1); light `accent`/`onAccent` ~3–4% darker to clear 4.5 with margin. _Tradeoff:_ a token edit + regen; preserves hue, fixes every failing pair.
- **B: Never use `danger`/`accent` as small text in light** — route error text to `fg` + a danger glyph; glyphs decorative-only. _Tradeoff:_ dodges the math but loses the semantic color where it matters most (errors).
- **C: Raise the bar to AAA on the guard** — over-correct everything. _Tradeoff:_ over-engineered for a marketing surface.
  **Recommendation:** A, and rebuild `contrast.test.ts` to import live tokens + assert every painted pair (P0-2). **Conf:** high. **Evidence:** computed matrix §2; `candidates.ts:13,46–49`; `contrast.test.ts:7–25`.

### B-4 · Font delivery _(surface: brand)_

**Q:** Raw Google `<link>` vs the brand-floor `next/font`?

- **A: `next/font` self-host (recommended)** — self-hosts Hubot Sans + Martian Mono, no render-blocking external CSS, no Google preconnects, no CSP exception, zero layout shift, and lets the variable axis (`wght 300..700`) be requested cleanly so the **350** body weight actually loads. _Tradeoff:_ a build-config change.
- **B: Keep the link but fix the axis** — switch to `:wght@300..700`, add the font origins to the ADR-0047 CSP. _Tradeoff:_ smaller change, but keeps the external dependency + render-block + privacy hop.
  **Recommendation:** A. **Conf:** high. **Evidence:** `design-system.md:40` ("Loaded via Next.js `next/font` with `display: swap`"); `layout.tsx:33,43–49`; `foundation.ts:24` (body 350 vs discrete `wght` request); ADR-0047 CSP "names only plausible.io".

### S-1 · Social / OG card _(surface: seo)_

**Q:** Ship without an OG image?

- **A: Static branded OG + twitter card (recommended)** — render the hero `ERROR: …fail-closed by default` transcript on the dark canvas as a 1200×630 OG; add `twitter:card=summary_large_image`. _Tradeoff:_ one asset; on-voice (the proof _is_ the card) and recovers every social share.
- **B: Dynamic OG (`@vercel/og` / route)** — per-page generated cards. _Tradeoff:_ nicer per-edition, but ADR-0045 is a static export with no server routes — would need a build-time generator.
- **C: Plain wordmark OG** — _Tradeoff:_ trivial, but wastes the evidence-forward angle.
  **Recommendation:** A now, B (build-time) later. **Conf:** high. **Evidence (file:line):** `layout.tsx:20–26` (no `images`, no `twitter`).

### C-1 · Hero eyebrow redundancy _(surface: copy)_

**Q:** The hero eyebrow repeats the locked tagline verbatim directly above the H1 — keep both?

- **A: Keep both** — _Tradeoff:_ maximal brand repetition; slightly redundant.
- **B: Eyebrow → context label, tagline lives once (recommended)** — eyebrow becomes "Compliance edition" / "Edition #2"; tagline stays in meta + footer. _Tradeoff:_ less repetition, a touch less reinforcement. (Does not touch the locked H1.)
  **Recommendation:** B. **Conf:** low. **Evidence (file:line):** `page.tsx:63–65` (eyebrow = tagline) directly above `:76` (H1).

### C-2 · Pricing `$199 kits` line _(surface: copy)_

**Q:** Keep the closing jab "And yes — it's a better base than the $199 kits." (`pricing/page.tsx:357`)?

- **A: Keep (recommended)** — _Tradeoff:_ on the locked named-enemy / evidence voice (a concrete number, a named competitor class); confident.
- **B: Cut** — _Tradeoff:_ safer/more neutral, but surrenders a sharp differentiator the voice spec invites.
  **Recommendation:** A. **Conf:** low. **Evidence:** `specs/04-voice-and-brand.md` (named enemy = happy-path boilerplate; evidence over adjectives); `pricing/page.tsx:357`.

---

## 4. Recommended sequencing (if these forks resolve toward the recommendations)

1. **B-3 + P0-1/P0-2** — fix the light-theme contrast tokens and rebuild the guard to import live tokens + assert every pair. (Correctness; smallest diff, highest a11y value.)
2. **V-5** — extract the inline duplication to classes (`.cs-display`/`.cs-cta-row`/`.cs-card-head`/`.cs-input`/`.cs-link`/`.cs-stack`). (Unblocks every later change.)
3. **V-3 + V-4** — craft the code block (semantic tint + chrome + label + copy) and the card hover (tonal step). (The two biggest visual wins.)
4. **V-2** — split-hero composition with the code card as the right anchor.
5. **V-1** — the restrained motion system (now `prefers-reduced-motion` guards something real).
6. **B-4 + S-1 + P1-7** — `next/font`, OG/twitter card.
7. **V-6 + P2-8** — intermediate breakpoint + nav collapse.
8. **B-1 / B-2** — icon system + accent-discipline (brand-expansion, operator-individual).

---

_Engine note: WCAG matrix computed with `culori.wcagContrast` (the same dependency `lib/contrast.ts` wraps); pair list derived from actual painted combinations in the page sources, not the partial set in `contrast.test.ts`._
