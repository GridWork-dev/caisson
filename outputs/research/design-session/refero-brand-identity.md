# Brand-Identity Reference Research — Caisson

**Session:** Design · Brand · SEO · Copy (branch `design/brand-site-seo`)
**Surface:** Brand identity expansion — wordmark/logomark · iconography · illustration/texture · motion
**Date:** 2026-06-27 · **Tooling:** refero MCP (styles + screens + image) → exa (motion + logo landscape)
**Status:** research → fork board. NO product code. Locked ADR-0040/0041 not relitigated; ADR-0042 may be widened by a new append-only ADR.

---

## 0. Current state (what Caisson has today)

| Asset              | Current                                                                                                                                                                         | Source                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Wordmark           | Plain text `caisson`, `--cs-font-mono` (Martian Mono), `--cs-weight-medium`, `--cs-tracking-tight`, `--cs-fg` color                                                             | `apps/site/components/site-nav.tsx`, `global.css:174-191` |
| Logomark           | **NONE** — no glyph, no monogram                                                                                                                                                | —                                                         |
| Favicon / app-icon | **NONE** (no `icon.*`/`favicon.*`/`apple-touch-icon` in `apps/site`)                                                                                                            | bash check                                                |
| Iconography system | **NONE** — no icon set adopted or drawn                                                                                                                                         | —                                                         |
| Illustration       | **NONE**                                                                                                                                                                        | —                                                         |
| Texture            | **NONE** (pure tonal surfaces)                                                                                                                                                  | —                                                         |
| Motion             | Minimal: `color 120ms ease` link/btn transitions; `prefers-reduced-motion` blanket reset (`global.css:369`)                                                                     | `global.css`                                              |
| Proto-motif        | A 64×4px accent bar in the OG image is the only existing "graphic device"                                                                                                       | `apps/site/app/opengraph-image.tsx`                       |
| Palette (locked A) | bg `oklch(0.16 0.012 220)` (#0d1216), accent `oklch(0.74 0.115 205)` (#43bcd0 cold-steel teal), hairline borders, **"depth = tonal surface + hairline borders, never shadows"** | `packages/ui/src/tokens/candidates.ts`, `global.css:3`    |
| Type (locked 2)    | Hubot Sans (sans) + Martian Mono (mono, carries evidence)                                                                                                                       | ADR-0042                                                  |
| Mood anchor        | "Pressurized steel caisson sunk in cold harbor water; wet dark steel, **one instrument light**, holds under load"                                                               | ADR-0042                                                  |

**The brief in one line:** Caisson is a dark, technical, evidence-forward dev-infra + compliance brand whose wordmark is plain mono text and which has zero logomark, iconography, illustration, or motion language. This research grounds the expansion in real shipped brands and surfaces every open decision as a fork.

---

## 1. Reference corpus (refero + exa, cited)

### 1.1 Closest siblings — deep style pulls (refero `get_style`)

**Axiom** (`axiom.co`, style `6e9baa82`) — _the closest analog to Caisson's intended posture._

- Pure black `#000` base, layered graphite surfaces (`#111`/`#191919`), depth via tone not shadow (subtle `rgba(0,0,0,0.05)` only).
- **Single vivid orange `#DA5C2C` as the "single instrument light"** — used _exclusively_ for primary CTA + active state, never decorative. This is mechanically identical to Caisson's "one instrument light" teal `#43bcd0` and the ≤10% accent rule.
- **Monospace (BerkeleyMono) as the PRIMARY display font**, Inter as secondary helper — exactly Caisson's Martian-Mono-carries-evidence posture.
- **2px border-radius everywhere** = "industrial, precise"; 9999px pills reserved for specific elements.
- Icons: "simple, line-based, monochromatic" in Light Steel/Medium Gray. **No photography, no illustration — product screenshots + data-viz only.**
- Do/Don't: "Avoid using the accent for decorative purposes; it dilutes its impact as a CTA." "Do not introduce additional vibrant colors."

**Inngest** (`inngest.com`, style `46bfdc1b`) — _the iconography/texture reference without a mascot._

- "Midnight Grid Console" — charcoal `#0c0a09`, single amber `#cab16a` accent, control-panel metaphor.
- **Imagery = "abstract, geometric shapes and patterns… solid brand-colored blocks placed in a grid-like arrangement." No photography or detailed illustrations.** Icons "simple, outlined, monochromatic, functional."
- Cards 0px radius (sharp), buttons 9999px — a deliberate sharp/soft tension.
- This is the model for a brand TEXTURE that is geometric + atmospheric and never a character.

**Twingate** (`twingate.com`, style `f8c28758`) — _the security-brand illustration reference._

- "Midnight Terminal" — carbon `#0e0f11` → basalt → obsidian surface progression; whisper-weight headlines.
- **Imagery: "abstract, geometric diagrams and stylized product screenshots, rather than photography… monochrome base with glowing highlights in System Teal `#00cbaa`, emphasizing connectivity, security, and data flow."** Icons outlined, moderate stroke, tinted to accent.
- "Imagery functions primarily to explain complex concepts and visually reinforce the technical, secure identity, rather than decorative." → diagrammatic-as-illustration is the security-brand default.
- Note: Twingate's accent is teal — same family as Caisson's; validates teal-on-carbon as a security register.

**PlanetScale** (`planetscale.com`, style `c0f79217`) — _the engineered-monospace blueprint reference (light, but the discipline transposes)._

- **Monospace for ALL text** (`ui-monospace`, `-0.006em`), 0px radius, "architectural blueprint, technical monochrome."
- Logo wall: all third-party logos rendered in one steel-gray `#414141` on a strict bordered grid — "brand-agnostic, technical." No illustration, no photography.
- "Avoid drop shadows or gradients; rely on color contrast and solid borders." → identical depth philosophy to Caisson's hairline-border rule.

### 1.2 Wordmark/logomark systems — brand-book pages (refero `search_screens` + image)

- **Linear** (`linear.app/brand`, screen `183fc84a`) — _the north-star system, visually inspected._ Three explicit tiers:
  1. **Wordmark** (logomark glyph + "Linear" text) — _"should be used in all references as space allows. Monochrome usage preferred."_
  2. **Logomark** (the circle-with-diagonal-slash glyph, standalone) — _"For tight layouts or logo-only grids… a concise way to refer to Linear. Use with good judgment, as the wordmark has stronger brand recognition."_
  3. **Icon** (the chip — logomark on a rounded-corner dark tile) — _"where a 'chip' design is required."_
  - Color: "Magic Blue" (subtle desaturated blue) is _"typically reserved for backgrounds,"_ monochrome wordmark preferred. **= exactly Caisson's accent-reserved posture.**
- **Cursor** (`cursor.com/brand`, screen `9d7d6d6b`) — cream brand page, dark logo preview block, pill download CTA. Minimal media-kit IA.
- **Brand-book IA corpus** (for when Caisson authors `/brand`): n8n (`6f78763a`), Mapbox (`99e2fa3f` — clearspace/min-size/misuse cards), ElevenLabs (`364cd667` — logo + symbol assets + clearance + misuse grid), Runway (`add4c2b8` — B/W do-don't), Craft (`d37f3d3e`).

### 1.3 Competitor wordmark/symbol landscape (exa)

- **Vercel** — _abstract geometric symbol + separate custom wordmark._ The black equilateral triangle = "delta / deployment / forward progress," introduced 2020, registered TM. Pairs with a custom Geist-based geometric wordmark. Icon = white triangle on a black roundel. Palette: `#000` + `#0070F3` electric blue, "5 colors, accent only when it matters." Wordmark sometimes set as **"Vercel."** with a terminal period (Grain brand analysis). [designyourway.net/blog/vercel-logo, grainhq.app/brand/vercel]
- **The Stripe/Linear/Vercel shared system** [pixeldarts.com]: (1) monochrome base + ONE accent doing all the work ("Hermès orange" principle), (2) sharp/cold/geometric type ("engineered to look designed"), (3) high contrast + whitespace. "One color used sparingly hits harder than five used everywhere." → direct validation of Caisson's single-teal strategy.
- Landscape pattern: most dev-infra brands are EITHER a wordmark-only (PlanetScale, Axiom effectively, Railway, Render, Fly) OR symbol+wordmark (Vercel triangle, Linear glyph, Sentry, Supabase). A standalone _mascot_ is rare in this lane and reads as consumer, not infra — consistent with ADR-0041's mascot ban.

### 1.4 Texture / schematic illustration references (refero `search_screens`)

- **Raycast** (`9ab521ee`) — near-black + "cerulean blue technical illustrations, subtle grid/noise texture, bento feature tiles." The "subtle grid texture under a dark surface" reference.
- **teenage.engineering** (`c0c93880`) + **BYBORRE** (`0dea72da`) — **schematic / cutaway cross-section diagrams** as the primary visual. Directly relevant to a "caisson cross-section" motif: a layered orthographic cutaway reads as engineering, not mascot.
- **Operate** (`a0f473eb`, from style search) — "ledger-like… faint grid and fine ruled lines… technical chart / archived record sheet." The blueprint ruled-grid-as-texture reference.

### 1.5 Motion language (exa — grounded against current best practice)

Sources: pixicstudio "Micro-Transition Stack used by Linear and Raycast" (2026-05); `samber/cc-skills` + `vercel-labs/open-agents` motion skills; `niuben/awesome-motion-md` (named tiers); aiuxplayground motion-principles (Emil Kowalski / Linear).

- **Named tiers:** `linear-snappy` ("ultra-fast SaaS motion, tiny distances, crisp state changes"), `vercel-minimal` ("restrained developer-tool motion, subtle dark-mode-friendly effects, motion-as-product-demo"), `stripe-polished` (more stagger/depth/commercial).
- **Easing by interaction:** enter → ease-out (decelerate) `cubic-bezier(0,0,0.2,1)` (Linear modals); strong reveal `cubic-bezier(0.23,1,0.32,1)`; exit → accelerate `cubic-bezier(0.4,0,1,1)`, **always faster than enter**; on-screen move/morph → ease-in-out; hover/color → symmetric. **Never default `ease`/`ease-in-out` — "built-in curves lack strength."**
- **Duration:** scale with distance — micro/hover 100–150ms, standard (dropdown/tooltip) 150–250ms, modal/drawer 200–300ms. **Emil: under 300ms; 180ms ideal.** Exit ~20% faster.
- **Hard rules:** transform/opacity only, **never animate layout** (width/height/margin → reflow); **no animation on actions triggered 100+/day or via keyboard**; per-element `prefers-reduced-motion` (content must stay visible, no stuck `opacity:0`); start scale from `0.9` not `0`; transform-origin matches the trigger.
- **Anti-slop:** fade-up-on-every-section, scale-on-hover-by-reflex, parallax/scroll-jacking are the named smells.
- **Vercel hero = motion-as-product-demo** (the build-log animation IS the demo) — transposes directly to Caisson animating a fail-closed event.

---

## 2. Synthesis — the Caisson brand-identity direction (recommended)

Caisson sits almost exactly where **Axiom** sits (mono-primary, single instrument light, 2px-precise, no illustration, depth via tone) with **Twingate's** security-diagram illustration register and **Linear's** wordmark-tier discipline. The whole expansion should read as _instrument panel, not marketing site_. Recommended spine:

1. **Wordmark stays primary and monochrome**, set in a lightly-customized Martian Mono; add ONE restrained **abstract geometric logomark** (waterline-over-chamber / bulkhead-grid — geometry, never a character) to solve the favicon/avatar/chip gap. Accent never enters the wordmark.
2. **Iconography:** line/outline, monochrome, **2px stroke on a 24px grid**, Lucide as the workhorse + ~8–12 bespoke domain glyphs (RLS, WORM, audit-chain, fail-closed, the caisson mark). Accent only for active/status; status always glyph + label.
3. **Illustration:** diagrammatic/schematic + real UI/artifact screenshots; **no photography, no 3D blobs.** ONE signature background texture = a faint blueprint ruled-grid that can stratify into "waterline" bands (the metaphor as texture). One permitted rare "instrument-glow" on the single hero focal point; everything else flat.
4. **Motion:** `linear-snappy` for UI + `vercel-minimal` for marketing — authored ease-out curves, sub-200ms, transform/opacity only, one motion-as-demo hero (a fail-closed event animating), scroll-reveal capped to once + ≤8px, keyboard/high-frequency actions never animate.

Authority order honored: research informs → impeccable craft laws execute (OKLCH, never #000/#fff in DOM, real code) → ADR-0042 brand floor constrains (palette A + Structural type win) → audit verifies.

---

## 3. Fork board (exhaustive — operator-gated)

> Each fork: options (label — tradeoff), a recommendation, confidence, evidence. Brand-expansion + name/hero-adjacent forks are flagged **[individual]** (present one at a time, not batched). Numbering caveat: the brand-expansion ADR is a new append-only ADR at the next free number (the board's Wave-1 note runs through ADR-0077; pick the next free, e.g. ADR-0078+), **widening ADR-0042 without forcing a palette/type change.**

### A. Wordmark / logomark (surface: brand)

| #                   | Fork                                          | Options                                                                                                                                                                                                                                       | Recommend                                                                                                                | Conf | Evidence                                                                                                                   |
| ------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---- | -------------------------------------------------------------------------------------------------------------------------- |
| **B1** [individual] | Mark strategy                                 | A wordmark-only · B wordmark **+ logomark glyph** (Linear model) · C symbol+wordmark lockup (Vercel model)                                                                                                                                    | **B** — wordmark primary, a concise glyph for favicon/avatar/chip/tight layouts; solves the favicon gap without a mascot | high | Linear brand `183fc84a`; Vercel triangle; ADR-0041 (mascot banned ≠ geometric glyph banned)                                |
| **B2** [individual] | Logomark glyph concept                        | A monogram "C" (generic) · B **waterline-over-chamber** (a hairline waterline above a chambered box = "foundation under load") · C **bulkhead grid** (square split by a hairline cross = watertight compartments) · D abstract delta/keystone | **B or C** — abstract geometry encoding "watertight foundation / holds under load"; not literal, not a character         | med  | Vercel triangle precedent (abstract concept-mark); BYBORRE/teenage.engineering schematic cross-sections; ADR-0041 metaphor |
| B3                  | Wordmark case + terminal dot                  | A keep lowercase `caisson` · B `caisson.` trailing period (CLI/terminal cue, reinforces `caisson.sh`) · C accent on the dot only                                                                                                              | **A**, optionally **B** for the lockup                                                                                   | med  | ADR-0041 locks lowercase mono-adjacent; Vercel "Vercel." (Grain)                                                           |
| B4                  | Wordmark typeface treatment                   | A set in Martian Mono as-is (just text) · B **lightly-customized Martian Mono lockup** (fixed optical tracking + one signature detail) · C a different display cut                                                                            | **B** — ownable wordmark without a new typeface                                                                          | med  | ADR-0042 (Martian Mono); Axiom BerkeleyMono / PlanetScale mono wordmarks                                                   |
| B5                  | Wordmark color                                | A **monochrome always**, accent reserved for backgrounds/focus (Linear) · B accent-tinted wordmark/dot                                                                                                                                        | **A**                                                                                                                    | high | Linear brand page explicit; ADR-0042 accent ≤10%                                                                           |
| B6                  | Sub-brand / module marks (Attest, Provenance) | A own marks · B **typographic sub-brand only** (mono label, no separate logo)                                                                                                                                                                 | **B** — keep one mark                                                                                                    | med  | ADR-0041 sub-brands                                                                                                        |
| B7 [individual]     | Edition identity system                       | A one accent for all · B per-edition hue-shift of the accent · C **one accent, each edition = its domain ICON + label only**                                                                                                                  | **C** — compliance-led umbrella, no rainbow                                                                              | high | ADR-0040 (editions = "same rigor, adjacent problem," not co-heroes); ADR-0042 single accent                                |
| B8                  | Ship a public `/brand` page?                  | A ship now · B **internal `brand.md` now, public `/brand` at GA** · C defer                                                                                                                                                                   | **B**                                                                                                                    | med  | Linear/Cursor/Mapbox/ElevenLabs media-kit IA                                                                               |
| B9                  | Favicon / app-icon asset                      | A wordmark crop · B **logomark glyph on a 2px-radius dark chip** (Linear chip-icon)                                                                                                                                                           | **B** (depends on B1/B2)                                                                                                 | high | no favicon exists (bash); Linear "chip" icon                                                                               |

### B. Iconography (surface: visual)

| #                   | Fork                  | Options                                                                                                                                                                                                                        | Recommend                                                                                         | Conf | Evidence                                                                                 |
| ------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------- |
| **I1** [individual] | Icon system direction | A adopt **Lucide** (dev-tool default, shared with shadcn crowd) · B Phosphor (geometric, multi-weight) · C fully bespoke set · D **Lucide workhorse + ~8–12 bespoke domain glyphs** (RLS/WORM/audit-chain/fail-closed/caisson) | **D** — speed + ownership where it counts; stock glyphs don't exist for compliance concepts       | high | Axiom/PlanetScale/Twingate line-icon convergence; shadcn/Lucide ubiquity                 |
| I2                  | Style                 | A **line/outline monochrome** · B solid/filled · C duotone (fg + accent-tint)                                                                                                                                                  | **A**                                                                                             | high | Axiom "line-based monochromatic"; PlanetScale "outlined steel-gray"; Twingate "outlined" |
| I3                  | Stroke weight + grid  | A 1.5px / 24px (Lucide) · B **2px / 24px** (heavier, engineered) · C 1.25px hairline                                                                                                                                           | **B** — echoes Axiom's 2px-precise industrial feel; 1px hairline reserved for dividers, not icons | med  | Axiom 2px radius; hairline-border depth rule (`global.css:3`)                            |
| I4                  | Terminal/join corners | A sharp 0px (PlanetScale blueprint) · B **2px soft** (Axiom; matches `radius.sm`)                                                                                                                                              | **B**                                                                                             | low  | Axiom 2px vs PlanetScale 0px (both valid)                                                |
| I5                  | Accent in icons       | A never · B **active-nav/status only**, never decorative                                                                                                                                                                       | **B**                                                                                             | high | Inngest amber + Axiom orange discipline                                                  |
| I6                  | Status-glyph system   | distinct SHAPE per state (check / triangle-bang / octagon / i) at 2px + **always paired with a label**                                                                                                                         | adopt                                                                                             | high | ADR-0042 "status never color-alone (glyph + label)"                                      |

### C. Illustration / visual texture (surface: visual)

| #                   | Fork                         | Options                                                                                                                                                                                                                                        | Recommend                                                                                                 | Conf | Evidence                                                                                             |
| ------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------- |
| **X1** [individual] | Imagery posture              | A UI/screenshot only (Axiom) · B abstract geometric (Inngest) · C diagrammatic/schematic (Twingate/blueprint) · D **blend: schematics for "how it works" + real UI/artifact proof + one signature texture**                                    | **D** — no photography, no 3D blobs                                                                       | high | Axiom UI-only; Twingate diagrammatic; voice spec "the artifact is the headline"                      |
| **X2** [individual] | Signature background texture | A dot-grid · B **blueprint ruled-line grid** · C **hairline "waterline" stratification** (tonal bands + hairlines) · D none (pure tone)                                                                                                        | **C/B** — a faint blueprint grid that can stratify into waterline bands (metaphor as texture, not mascot) | med  | PlanetScale/Operate ruled grid; Raycast "subtle grid texture"; depth rule extends to a hairline grid |
| **X3** [individual] | Caisson metaphor as motif    | A **waterline device** (a recurring horizontal hairline/gradient + depth-darkening toward the bottom; the OG accent-bar is a proto-version) · B cross-section cutaway schematic (one hero only) · C bulkhead-grid framing · D none (copy-only) | **A** as the recurring restrained device + **B** for ONE hero "how it holds" schematic                    | med  | ADR-0041 metaphor (watertight foundation under pressure, no mascot); OG accent-bar; schematic refs   |
| X4                  | Depth / glow policy          | A strictly flat, no glow ever · B **one rare "instrument glow"** — a faint accent radial on the single hero focal point only                                                                                                                   | **B** — true to "one instrument light in cold water"; everything else flat (no shadows)                   | med  | ADR-0042 mood anchor; Axiom/Twingate subtle accent glow vs the no-shadow rule                        |
| X5                  | Code / artifact framing      | A **terminal/artifact card** (dark surface, hairline border, mono — the artifact IS the hero) · B raw inline · C browser-chrome mock                                                                                                           | **A**                                                                                                     | high | voice spec §5 "proof shown not asserted"; SST/Resend/Axiom                                           |
| X6                  | Logo wall / social proof     | A full-color logos · B **monochrome fg-muted logos in a hairline-bordered grid**                                                                                                                                                               | **B**                                                                                                     | high | PlanetScale "all logos steel-gray in a strict grid"; Langbase/Vapi                                   |
| X7                  | OG / social-card system      | formalize the **accent-bar + waterline + mono wordmark** OG template; per-edition variants                                                                                                                                                     | adopt                                                                                                     | med  | existing `opengraph-image.tsx`                                                                       |

### D. Motion (surface: visual)

| #                   | Fork                           | Options                                                                                                                                                                                   | Recommend                               | Conf | Evidence                                                                       |
| ------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ---- | ------------------------------------------------------------------------------ |
| **M1** [individual] | Motion tier                    | A **`linear-snappy`** (sub-200ms, tiny distances) · B **`vercel-minimal`** (restrained + motion-as-demo) · C `stripe-polished` (more stagger)                                             | **A for UI + B for marketing**          | high | motion.md (Linear sub-200ms; Vercel motion-as-demo); awesome-motion-md tiers   |
| M2                  | Easing tokens                  | A Material standard set · B **authored strong curves** (enter `cubic-bezier(0,0,0.2,1)`, reveal `cubic-bezier(0.23,1,0.32,1)`, exit `cubic-bezier(0.4,0,1,1)`) — **never default `ease`** | **B**                                   | high | motion.md "built-in curves lack strength"                                      |
| M3                  | Duration scale                 | `--cs-motion-fast 120ms` (hover/color) · `-base 180ms` (dropdown/tooltip) · `-slow 240ms` (modal/drawer); exit ~20% faster                                                                | adopt                                   | high | motion.md duration table; Emil "180ms ideal, <300ms"                           |
| M4                  | Property discipline            | **transform/opacity only; never animate layout** (width/height/margin)                                                                                                                    | adopt as law                            | high | motion.md "never transition layout properties (reflow)"                        |
| M5                  | Scroll-reveal policy           | A none (max restraint) · B **one subtle fade-up-once** (translateY ≤8px, opacity, 240ms, single trigger, not every block) · C parallax (reject)                                           | **B** with a hard cap                   | med  | motion.md anti-pattern "fade-up on every section"                              |
| M6                  | High-frequency / keyboard rule | **no animation on actions ≥100/day or keyboard-initiated** (command palette, nav)                                                                                                         | adopt as law                            | high | motion.md/Emil; specs/03 keyboard-friendly                                     |
| M7                  | Reduced-motion                 | keep the global reset (`global.css:369`) + **add opacity-preserving reveal fallbacks** (content visible, never stuck at `opacity:0`)                                                      | adopt                                   | high | existing block; motion.md "no opacity exceptions, content must remain visible" |
| **M8** [individual] | Motion-as-product-demo hero    | animate a **real fail-closed event** (RLS denying cross-tenant, an audit-chain link appending, a WORM lock engaging) as the Vercel-build-log-style hero demo                              | **yes** — one hero, the thesis animated | med  | motion.md "Vercel hero = product demo"; voice "proof shown not asserted"       |
| M9                  | Press / focus feel             | A spring overshoot on press (playful) · B **flat 120ms ease-out press + instant accent focus ring**                                                                                       | **B** — register is calm/understated    | med  | motion.md spring vs voice §7 "confidence through understatement"               |

---

## 4. Reference index (links)

**refero styles:** Axiom `6e9baa82-2f2f-4e77-8b0d-566325635dbe` · Inngest `46bfdc1b-2a29-454e-ad35-e01a41c59dcf` · Twingate `f8c28758-65d4-44a8-aa04-31c6b13e08a2` · PlanetScale `c0f79217-5105-4765-bf7a-8ccc9a3284c4` · Linear changelog `11d3e58a` · Depot `707c2922` · Langbase `6faf7a27` · Supabase `28aeb534` · Operate `a0f473eb` · Doppler `38dc3537` · HashiCorp `8f7b11aa` · Clutch Security `9f80b4b8`.

**refero brand/screen refs:** Linear brand `183fc84a-4f1b-466b-b094-7ec4a75bc713` (visually inspected) · Cursor brand `9d7d6d6b` · n8n brand `6f78763a` · Mapbox brand `99e2fa3f` · ElevenLabs brand `364cd667` · Runway brand `add4c2b8` · Craft brand `d37f3d3e` · Raycast `9ab521ee` · teenage.engineering `c0c93880` · BYBORRE schematic `0dea72da`.

**competitor URLs:** linear.app/brand · cursor.com/brand · planetscale.com · axiom.co · twingate.com · inngest.com · vercel.com · supabase.com · depot.dev · sst.dev · neverhack.com · 1password.com · fingerprint.com.

**exa motion sources:** pixicstudio.medium.com/the-micro-transition-stack-used-by-linear-and-raycast · github.com/samber/cc-skills (frontend-design-deslop/motion.md) · github.com/vercel-labs/open-agents (web-animation-design) · github.com/niuben/awesome-motion-md · aiuxplayground.com/skills/design-motion-principles.

**exa logo/brand sources:** designyourway.net/blog/vercel-logo · grainhq.app/brand/vercel · pixeldarts.com (four design principles behind Stripe/Linear/Vercel) · 1000logos.net/vercel-logo.

---

## 5. Downstream notes (for the later build session)

- New append-only ADR (next free number, widening ADR-0042) records the locked picks for B1/B2/B7, I1, X1/X2/X3, M1 — palette A + Structural type are NOT changed, only the foundation widened.
- `apps/site`: add `icon.svg`/`apple-icon.png` (logomark chip), a `BrandMark` component (wordmark + glyph lockup), motion tokens in `global.css` (`--cs-ease-*`, `--cs-motion-*`), a `<Texture>` waterline/grid background primitive, a status-glyph set.
- `packages/ui`: motion tokens belong in the token contract (foundation-level `motion` object → `gen-tokens-css.ts`), so editions inherit the same easing/duration floor; the icon set + status glyphs ship as `ui` primitives.
- Honor the brand floor: no #000/#fff in DOM (OKLCH only), depth via tonal surface + hairline borders, never shadows (the one permitted exception is the single rare instrument-glow, X4).
