# Current-State Brand + Token Audit — framing the Caisson brand expansion

**Session:** Design · Brand · SEO · Copy (branch `design/brand-site-seo`)
**Date:** 2026-06-27
**Scope:** Audit the LOCKED ADR-0042 design-system foundation (palette A cold-steel teal hue~205 +
type 2 "Structural" Hubot Sans / Martian Mono; OKLCH typed tokens → `--cs-*` `tokens.css`) for
COMPLETENESS as a _brand system_, and enumerate what a brand-EXPANSION must ADD. This session may
supersede ADR-0042 via a new append-only ADR; palette/type are **not** forced to change but the
foundation is to be widened.
**Surfaces:** visual · brand · seo · copy.
**Method:** read the token source + the live site chrome, then a Refero style-research pass for the
dark-technical-devtool competitive set.

---

## 1. What ADR-0042 actually locked (the floor that exists)

The locked foundation is a **color + type + spacing token contract** — genuinely good, WCAG-clean,
and architecturally disciplined — but it is a _token system_, not yet a _brand system_. Concretely
present today:

| Layer                                     | Status                               | Evidence                                                                                 |
| ----------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------- |
| Semantic color (dark + light)             | ✅ complete, OKLCH, WCAG AA verified | `packages/ui/src/tokens/candidates.ts:17-54`; ADR-0042 (fg 17.27:1, accent 8.77:1 large) |
| Functional/status color                   | ✅ success/warning/danger/info       | `candidates.ts:10-15`                                                                    |
| Type scale + weights + leading + tracking | ✅ modular ~1.25, display clamp      | `foundation.ts:7-66`                                                                     |
| Spacing (4px base) + radius scale         | ✅                                   | `foundation.ts:43-65`                                                                    |
| Font families (Hubot Sans / Martian Mono) | ✅ locked                            | `theme.ts:39-42`; `candidates.ts:142-149`                                                |
| Token → CSS emit pipeline (`--cs-*`)      | ✅ deterministic, CI-guardable       | `scripts/gen-tokens-css.ts`; `styles/tokens.css`                                         |
| Theme switch (data-theme + no-flash)      | ✅                                   | `theme-toggle.tsx`; `layout.tsx:37`                                                      |
| Status-never-color-alone (glyph+label)    | ✅ accessibility floor               | `global.css:276-290`                                                                     |

**The gap:** everything above is the _substrate_ a brand sits on. None of the things that make a
brand _recognizable and ownable_ exist yet. The brand is currently carried entirely by a single
lowercase mono word, "caisson," set in the body mono font.

---

## 2. The eight missing brand-system layers (the expansion surface)

| #   | Brand layer                  | Current state                                                                                                                                               | Severity                                        |
| --- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 1   | **Logomark / wordmark**      | Plain `<span class="mark">caisson</span>` in Martian Mono; **no mark**. (`site-nav.tsx:21`, `site-footer.tsx:39`)                                           | HIGH — no brand recall asset                    |
| 2   | **Iconography**              | Ad-hoc **Unicode geometric glyphs** `▣ ▤ ▥ ▦ ▧ ⊘` as feature icons (`page.tsx:14-26`, `ai-kit/page.tsx:14-39`). No designed set.                            | HIGH — looks like a placeholder                 |
| 3   | **Illustration / texture**   | **None.** Pure flat fills; one code block as the only hero visual.                                                                                          | MED — defensible (evidence-first) but undefined |
| 4   | **Motion tokens**            | **None** in `foundation.ts`. Two hardcoded `transition: …120ms ease` in `global.css:166,205`; only the `prefers-reduced-motion` guard.                      | MED — magic numbers, no language                |
| 5   | **Elevation**                | Deliberately **shadowless** (tonal + hairline). Stated only as a CSS _comment_ (`global.css:2-3`), not a token or named law.                                | MED — strong decision, uncodified               |
| 6   | **Accent discipline (≤10%)** | Followed in practice; codified only as ADR prose ("Restrained strategy"). No usage rule in the system.                                                      | LOW — works, undocumented                       |
| 7   | **Data-viz / status system** | 4 functional tokens exist; **no chart palette**, sequential/categorical scales, or chart-on-dark guidance.                                                  | LOW — no dashboards shipped yet                 |
| 8   | **OG / favicon / app-icon**  | OG template exists but **hardcodes hex + has no mark** (`opengraph-image.tsx`). **No favicon, no icon.svg, no apple-icon, no webmanifest, no theme-color.** | HIGH — bare browser tab + SERP                  |

---

## 3. Refero research — the dark-technical-devtool competitive set (steal-list)

A style search for "dark technical developer infrastructure brand" and "minimal geometric logomark /
blueprint aesthetic" returned Caisson's _exact_ peer set. Eight concrete tactics to steal:

1. **Axiom (axiom.co)** — "near-black foundation, depth through tonal separation rather than heavy
   shadow … single vivid orange accent like a precision spotlight, used sparingly … high signal."
   This is **Caisson's exact recipe, validated** — confirms KEEP shadowless + single-accent ≤10%.
   _Steal: the "one accent as instrument spotlight" framing for the accent-discipline rule._
2. **Linear changelog (linear.app/changelog)** — "borders and tonal shifts instead of shadows …
   **monochrome icon clusters** as functional focal points." _Steal: the monochrome thin-stroke icon
   set replacing the Unicode glyphs; validates formalizing shadowless as law._
3. **Depot (depot.dev)** — "instrument-panel aesthetic … green-filled primary CTAs against muted
   secondary controls." Same single-accent grammar, different hue. _Steal: CTA hierarchy discipline._
4. **Trunk.io (trunk.io)** — "**blueprint-inspired** … faint technical line art, schematic curves,
   subtle diagram-like overlays … engineered, high-precision mood." _Steal: the blueprint/schematic
   illustration motif — directly on-metaphor for a "caisson" cross-section._
5. **Operate.so (operate.so)** — "ledger-like … faint grid and fine ruled lines … technical chart
   or archived record sheet." _Steal: a faint engineering-grid / ruled-ledger texture for large dark
   fields (evidence/audit register adjacency)._
6. **Supabase (supabase.com)** — "outlined icons, line-based illustrations … brand mark + primary
   CTA carry the single green accent." _Steal: outlined-icon style + accent reserved for mark+CTA._
7. **19-86.fr / mostlikely.at** — "blueprint precision, 1px rules, tabular alignment, oversized
   typographic monument … architectural notation + granular texture." _Steal: an oversized
   wordmark-as-monument hero treatment; optional micro-grain on dark fills._
8. **gt-planar.com** — "hairline borders, small boxed labels, **zero-radius interface
   instrumentation** … command-line systems vibe." _Steal: a hard-edged "instrument label" chip
   variant for technical metadata (version, hash, status)._

**Convergent finding:** every credible peer expresses brand through (a) tonal-depth + hairline (no
shadow), (b) one decisive accent ≤10%, (c) a **real outlined-icon set**, and (d) **schematic/blueprint
line-art**, not photography or 3D. Caisson already has (a) and (b); it is missing (c) and (d). The
research strongly endorses keeping palette A + the shadowless/single-accent grammar and spending the
expansion budget on **mark + icons + schematic motif + favicon/OG**.

---

## 4. Keep-or-revise: palette A + type 2

**Palette A — KEEP (high confidence).** Cold-steel teal hue~205 is the _only_ direction in the
candidate set that escapes the saturated-green devtool crowd (Depot/Supabase/Doppler/Trunk all
green) while staying in the "instrument light on wet steel" lane. It clears WCAG AA at every pair
(ADR-0042), and the OG mirror hex `#43bcd0` (`opengraph-image.tsx:17`) reads as a confident, ownable
cyan-teal. No evidence to reopen.

**Type 2 "Structural" — KEEP, with one craft caveat (medium confidence).** Hubot Sans is a strong,
ownable engineered grotesk — good call past the impeccable reflex-reject families (Inter/Plex).
**Martian Mono is the one thing to pressure-test:** it is a _very wide_ mono (designed for short
labels), and the brand uses mono heavily for _running evidence_ — the hero `<pre>` code block
(`page.tsx:105-108`), `.cs-code`, eyebrows, tags, nav, footer headings, theme toggle. At 14px in a
multi-line denial block, Martian Mono's width hurts density and can wrap awkwardly. Options below
(Fork V-15). The wordmark also currently _is_ Martian Mono — fine, but it means the mark has no
distinct optical identity from body chrome.

---

## 5. Token-system craft notes (impeccable lens)

- **Motion is un-tokenized.** `120ms ease` appears as a literal in two rules. impeccable law: motion
  belongs in tokens (duration scale + named easings). Add `--cs-duration-*` + `--cs-ease-*` to
  `foundation.ts` so every transition references the same language; the reduced-motion guard already
  exists (`global.css:369`). (Fork V-7.)
- **Elevation is a comment, not a contract.** "depth = tonal surface + hairline borders, never
  shadows" (`global.css:2-3`) is a real brand law doing real work, but a future contributor adding a
  dropdown/modal has no sanctioned way to separate same-tone surfaces. Either formalize "no shadows"
  as a brand law _and_ provide an overlay-only separation primitive, or it will be violated ad hoc.
  (Fork V-8.)
- **OG hardcodes hex by necessity but drifts by risk.** satori can't read OKLCH, so `C.accent =
"#43bcd0"` is mirrored by hand (`opengraph-image.tsx:11-19`). This is a sanctioned exception, but
  there is **no drift guard** — if the locked accent changes, the OG silently keeps the old hex. A
  generated-hex-mirror or a CI check should pair the two. (Fork S-21.)
- **`.cs-brand .sub` is defined but unused** (`global.css:187-191`) — a sub-label slot in the brand
  lockup exists in CSS but the nav renders mark-only. Decide whether the lockup is mark-only or
  mark+descriptor. (Fork C-25.)
- **Accent is well-contained** — primary CTA, eyebrow, focus, link, status glyph, selection. The
  ≤10% rule is honored; it just isn't written down as a usage rule anyone can check against.

---

## 6. Decision table — brand-expansion forks

Surfaces: **B** brand · **V** visual · **S** seo · **C** copy. `ind` = present to operator
individually (brand-identity-defining / name-hero-adjacent), not batched.

| ID   | Fork                                              | Rec                                                         | Conf | ind |
| ---- | ------------------------------------------------- | ----------------------------------------------------------- | ---- | --- |
| B-1  | Logomark: does Caisson get a mark, and what kind? | Wordmark + minimal geometric mark (caisson cross-section)   | high | ✅  |
| B-2  | Mark motif / metaphor                             | Caisson cross-section: a sunk chamber under a waterline     | med  | ✅  |
| B-3  | Monogram / app-icon mark (for favicon)            | Cross-section glyph in a square containment frame           | med  | ✅  |
| B-4  | Wordmark treatment                                | Keep lowercase "caisson", custom-tune Martian Mono tracking | med  | ✅  |
| B-14 | Palette: keep A or revise                         | KEEP palette A (cold-steel teal)                            | high | ✅  |
| V-15 | Type: keep type 2 or revise                       | KEEP Hubot Sans; audit Martian Mono at body/code sizes      | med  | ✅  |
| V-5  | Icon system: replace Unicode glyphs               | Adopt a thin-stroke line set (Lucide) + a few custom        | high | ✅  |
| V-6  | Illustration / texture motif                      | Blueprint schematic line-art + faint engineering grid       | med  | ✅  |
| V-7  | Motion tokens                                     | Add minimal duration + easing token scale                   | high | ✅  |
| V-8  | Elevation: formalize shadowless                   | Formalize as law + add overlay-only separation primitive    | high | ❌  |
| V-9  | Accent-discipline rule (≤10%)                     | Codify a written usage rule + lint note                     | med  | ❌  |
| V-10 | Data-viz / chart color system                     | Defer; stub a categorical scale from accent hue             | low  | ❌  |
| V-19 | Hero visual strategy                              | Keep evidence-first; add optional faint schematic backdrop  | med  | ✅  |
| V-20 | Surface texture (grain)                           | Add very subtle grain to large dark fills, OR stay flat     | low  | ❌  |
| B-17 | Secondary brand accent (sub-brands)               | Single accent only; sub-brands differ by label not hue      | med  | ❌  |
| S-11 | OG template: single vs per-route                  | Single template + add new mark; per-route as v2             | med  | ✅  |
| S-12 | Favicon / app-icon kit                            | Ship full kit (SVG + ICO + apple + maskable + manifest)     | high | ✅  |
| S-21 | OG hex-drift guard                                | Generate the OG hex mirror from tokens (or CI check)        | high | ❌  |
| S-23 | Organization JSON-LD with logo                    | Add Organization schema with `logo` once a mark exists      | med  | ❌  |
| S-24 | `theme-color` + color-scheme meta                 | Add `theme-color` (dark + light) meta                       | high | ❌  |
| B-18 | Brand book / usage doc                            | Author `DESIGN.md` brand book (logo/clearspace/do-don't)    | high | ❌  |
| C-25 | Brand lockup: mark-only vs mark+descriptor        | Mark-only in nav; mark+descriptor in footer/OG              | med  | ✅  |
| C-26 | Locked brand signature line                       | Lock "Fail-closed by construction." as the payoff line      | med  | ❌  |

(Full per-fork options, tradeoffs, recommendations, and evidence are returned in the structured
`forks` array of this session's output.)

---

## 7. Recommendation summary

1. **Supersede ADR-0042 with ADR-0050 "Brand-system expansion"** — it does not change palette/type;
   it _widens_ the foundation to a full brand system (mark, icons, motion tokens, elevation law,
   favicon/OG kit, brand book). Palette A + Hubot Sans stay; Martian Mono gets a craft pass.
2. **Highest-leverage, lowest-risk wins first:** favicon/app-icon kit (the tab + SERP are bare),
   `theme-color` meta, motion tokens, OG-hex drift guard, accent + elevation laws written down.
   These are token/meta plumbing — batchable, no identity debate.
3. **The identity decisions (mark, icon set, illustration motif, wordmark) are operator forks** —
   present individually; each has a clear recommendation grounded in the peer set above.
4. **Resist over-decorating.** The research is unanimous: the strongest peers (Axiom, Linear) win on
   _restraint_ — tonal depth, hairline, one accent, schematic line-art, no photography. Caisson's
   evidence-first hero (a real RLS denial, not a stock illustration) is already best-in-class; the
   expansion should sharpen the mark + icons + favicon, not add visual noise.

**Brand-floor note:** GridWork's `design-system.md` floor (copper on `#111009`, Inter/JetBrains,
`--gw-*`) is the _umbrella_ brand; Caisson is a productized **sub-brand** with its own locked
identity (ADR-0040/0041/0042, `--cs-*`). This is a deliberate, ADR-sanctioned divergence, not drift —
the expansion stays inside the Caisson identity, not the GridWork floor.
