# Refero research — Pricing page + Edition/product-page layout

Scope: `apps/site/app/(marketing)/pricing/page.tsx` + the four edition pages
(`compliance/`, `ai-kit/`, `local-first/`, `agentic-dev/`). Research-first design driver:
`refero` MCP (styles → screens → flows) grounded against the Caisson brand floor
(ADR-0042 cold-steel teal + Structural type; `global.css` `--cs-*` primitives) and the
binding constraints (ADR-0040 buyer firewall = no base-vs-competitor table; ADR-0048 = SKU
structure shown, **no hard prices**, converts to waitlist).

Authority order applied throughout: **brand floor > impeccable craft > Refero reference.**
Refero INFORMS; the cold-steel-teal / hairline-border / no-shadow / mono-accent floor WINS.

---

## 1. Reference corpus (cited)

### Styles — visual direction (all dark "command-center", hairline borders, sparse accent, mono for technical data — a near-exact match for Caisson's floor)

| Ref                                                               | Source        | Why it matters for Caisson                                                                                                                                                                                                                                                                                             | Refero                                   |
| ----------------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| **Depot** `707c2922`                                              | depot.dev     | **Closest analog.** Carbon-black `#04040b` canvas, single green accent reserved for CTA + key highlight only, 6px radius, depth via layer-color + a `rgba(255,255,255,.06) 0 1px 0 inset` top-highlight (NOT shadows), mono for "technical data displays". This is Caisson's exact recipe with teal swapped for green. | https://refero.design/styles (depot.dev) |
| **Inngest** `46bfdc1b`                                            | inngest.com   | Charcoal `#0c0a09`, **one** amber accent "like a precision highlight rather than a decorative color", grid/geometric abstract graphics, cards at 0px radius OR pills at 9999px. Reinforces accent discipline.                                                                                                          | inngest.com                              |
| **Supabase** `28aeb534`                                           | supabase.com  | Near-black layered surfaces, green accent "sparingly but decisively" for brand mark + primary CTA only; modular grid; dark UI-snippet imagery.                                                                                                                                                                         | supabase.com                             |
| **Linear / Changelog** `11d3e58a`                                 | linear.app    | Type-as-hero, **medium-weight** (not bold) headlines, capsule pills, 8px rounding, borders+tonal-shift depth. The "quiet premium" register.                                                                                                                                                                            | linear.app/changelog                     |
| **Trunk** `09af2984`                                              | trunk.io      | Blueprint line-art overlays; accent used "like status signals inside an otherwise monochrome technical system" — directly relevant to Caisson's glyph status pills.                                                                                                                                                    | trunk.io                                 |
| **Sauce Labs** `906ed1ac`                                         | saucelabs.com | **Dark-teal** command-center (our hue ~205), mint activation accent, comparison cards "like polished presentation slides".                                                                                                                                                                                             | saucelabs.com                            |
| **Grafbase** `5f21d79b`                                           | grafbase.com  | "Comparison cards that feel like polished presentation slides" — a feature-comparison pattern that reads as content, not a spreadsheet.                                                                                                                                                                                | grafbase.com                             |
| **Doppler** `38dc3537`                                            | doppler.com   | Secrets/infra peer; instrument-panel mood, dark framed product mockups, 20px-radius translucent panels.                                                                                                                                                                                                                | doppler.com                              |
| **Elementor** `86351665`                                          | elementor.com | Surface-**inversion** checkerboard rhythm to separate bands — a no-shadow way to break section monotony.                                                                                                                                                                                                               | elementor.com                            |
| HashiCorp `8f7b11aa`, Checkly `0a2ad49e`, LaunchDarkly `2ca53e3f` | —             | Enterprise-dark corroboration: flat orderly cards, hierarchy via border + alignment not elevation.                                                                                                                                                                                                                     | —                                        |

### Screens — concrete pricing/edition patterns

| Ref                                                         | Source                     | Steal                                                                                                                                                                                                                                             | Refero                                                           |
| ----------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **n8n change-plan** `211e2c7a` / `7c99aec2` / `e1b2f987`    | app.n8n.cloud              | **THE price-less-card pattern.** Starter/Pro cards show price + "Select"; Enterprise/Custom cards show **no number** — just "Contact sales" in the price slot. Proves a card lineup can mix priced + price-deferred slots without looking broken. | n8n.io                                                           |
| **Anthropic pricing** `63588e00`                            | anthropic.com              | Toggle pills (Claude.ai vs **API**) splitting one-time-consumer vs usage models on one page — analog for a one-time ⇄ subscription toggle.                                                                                                        | https://refero.design/pages/63588e00-2d34-4bbb-b7cc-4c067bd57d4c |
| **OpenAI pricing** `48b87627`                               | openai.com/chatgpt/pricing | 5 cards + comparison table + **FAQ accordion** + logo wall; mixed "Get Free"/"Contact sales" CTAs. The canonical pricing-page skeleton.                                                                                                           | openai.com                                                       |
| **Linear pricing** `5d709fa1`                               | linear.app/pricing         | Dark, 4-column, comparison table, logo row, CTA band — the dark-mode reference build.                                                                                                                                                             | linear.app/pricing                                               |
| **Vercel /oss** `46479315`                                  | vercel.com/oss             | Dark **2×3 project-card grid** — the edition-lineup-as-grid analog (a "family of things" overview, not a price grid).                                                                                                                             | vercel.com/oss                                                   |
| **Framer Plugins** `2a490224`                               | framer.com/plugins         | Dark hero whose primary CTA is **"Join the waitlist"** (no pricing at all) — direct analog for a waitlist-converting product page.                                                                                                                | framer.com/plugins                                               |
| **Column /fednow** `b23324ad`                               | column.com                 | "Developer infrastructure bank": email-for-early-access hero **beside a dark code-snippet panel** — same evidence-led, dev-infra register as Caisson.                                                                                             | column.com/fednow                                                |
| Stage.so `51c020e8`, Rive `59d7249e`, RevenueCat `0dd86030` | —                          | Dark 3–4-tier + matrix corroboration; near-universal **FAQ accordion**.                                                                                                                                                                           | —                                                                |

### Flows — the waitlist journey

The corpus has no rich "early-access waitlist for a dev product" flow; the closest are
booking-waitlists (Fresha `2375`) and full signup/onboarding (Polar `11379`, Manus `10420`,
Tella `384`). Takeaway for Caisson: the waitlist is **one inline email field + a confirmation
state** (already the ADR-0046 seam, `components/waitlist-form.tsx`), so the design problem is
not a multi-step flow — it is **where the single capture sits on each page** and what the
post-submit confirmation says. Framer Plugins `2a490224` and Column `b23324ad` are the
inline-capture references.

---

## 2. Current-state read (what's built today)

- **Pricing** (`pricing/page.tsx`): hero + `caisson entitlements` terminal → editions in a
  **2×2 grid** (`cs-grid--2`, Compliance = `cs-card--accent`) → commerce model (4-card row)
  → subscriptions (2 cards) → EU-AI-Act add-on (lone card) → waitlist. Every price slot is
  the **identical** `EarlyAccess()` pill ("○ Early access — join the waitlist"), repeated
  ~12×. The "$199 kits" footnote sits at the very bottom under the form. No FAQ. No
  edition×capability matrix. No links out to the four edition pages.
- **Edition pages**: structurally **divergent**. Compliance = 6 sections (3-guarantee deep
  dive each with evidence transcript + per-tenant crypto + evidence-pack + retrofit callout
  - SKU + waitlist). AI-Kit = hero + named-failure + 6-module `--3` grid + policy block + SKU
    `--4` + waitlist. Local-first = hero + 5-piece `--3` grid + ANN evidence + AGPL note (CTAs
    = Docs + GitHub star, **not** waitlist) + waitlist. Agentic-Dev = roadmap badge + 4-piece
    `--2` grid + framing + SKU `--3` + waitlist.
- **Tokens**: `--cs-*` only; depth = tonal surface + 1px hairline border, **never shadow**
  (`global.css:3`). Accent (`--cs-accent`, teal hue ~205) currently appears on eyebrow, glyph,
  the `+` include-bullets, accent-card border — broader than the Depot/Inngest "accent =
  CTA + key highlight only" discipline.

---

## 3. Fork board

Each fork = an open design decision with concrete options, a recommendation (confidence +
evidence). `individual: true` = brand-expansion / hero-adjacent → surface to operator
one-by-one, not batched.

### VISUAL

**V1 — Edition lineup layout on /pricing (the hierarchy problem).**
Today all four editions are equal cells in a 2×2; the Compliance **hero** reads the same
size as the Agentic-Dev **roadmap** edition, flattening the ADR-0040 sequence.

- A. Keep 2×2 equal grid — simplest, but contradicts "Compliance is the front door."
- B. **Featured lead + 3** — Compliance spans the full top row (or a 2-col span), the other
  three sit beneath. Restores hierarchy without a price grid.
- C. Vertical "spec rows" — each edition a full-width row (name · summary · includes · status),
  Compliance first and visually heavier.
- Reco: **B** — a bento "lead card spans, three follow." Confidence: high. Evidence: ADR-0040
  "Compliance = front door"; Vercel /oss `46479315` grid + OpenAI `48b87627` featured-tier
  convention; impeccable "match emphasis to importance."

**V2 — Price-slot treatment (the repeated "Early access" pill).**
The identical `EarlyAccess()` pill renders ~12× and is the weakest, most repetitive element.

- A. Keep uniform status pill on every card.
- B. **Price-shaped placeholder** — occupy the slot where a price would live with a deliberate
  glyph + "Pricing at early access" so the card reads as a real SKU card with a _deferred_
  number (n8n's Enterprise/Custom pattern), then ONE shared CTA at section level.
- C. Quiet inline link "Pricing → join the waitlist" demoted to footnote weight.
- Reco: **B** — borrow n8n's price-less-slot so the cards look intentional, not unfinished;
  collapse the per-card CTA to one section CTA. Confidence: high. Evidence: n8n `211e2c7a`
  (price slot → "Contact sales"); ADR-0048 (no number, convert to waitlist).

**V3 — SKU-card surface treatment.**

- A. Keep flat `cs-card` (hairline + `--cs-surface-1`).
- B. **Add the Depot inset top-highlight** (`box-shadow: inset 0 1px 0 rgba(255,255,255,.06)`)
  — a 1px engineered "lift" that is NOT a drop shadow, so it honors the no-shadow floor.
- Reco: **B** for SKU + edition cards. Confidence: medium. Evidence: Depot `707c2922` Feature
  Card token (`--shadow-feature-card`, inset only) — the no-shadow-but-not-flat technique.

**V4 — Edition-page TEMPLATE skeleton (the core ask: a repeatable template across 4 editions).**
The four pages diverge structurally; a buyer moving Compliance → AI-Kit → Local-first hits a
different IA each time.

- A. Keep bespoke per page — each edition gets a hand-built structure.
- B. **Shared skeleton, variable depth**: `hero (eyebrow + H1 guarantee + lede + CTA pair +
evidence transcript)` → `the named failure / why-now band` → `pieces grid` → `0–N deep-dive
evidence sections (Compliance = 3, others = 1)` → `SKU strip` → `waitlist`. Each page fills
  the same slots; Compliance simply runs deeper.
- C. Rigid identical template — same section count everywhere (forces thin editions to pad).
- Reco: **B** — a shared skeleton with a depth dial. Confidence: high. Evidence: the kickoff's
  explicit "repeated template across 4 editions" ask; impeccable consistency law; the pages
  already share 80% of their parts (`cs-section`/`cs-card`/`cs-code`/`Includes`).

**V5 — Pieces/module-grid density standardization.**
Compliance uses 1-col deep cards, AI-Kit/Local-first `--3`, Agentic-Dev `--2`.

- A. Keep per-page ad hoc.
- B. **Rule by count**: ≤4 pieces → `--2`; 5–6 → `--3`; deep-evidence pieces → 1-col. Applied
  consistently across all four.
- Reco: **B**. Confidence: high. Evidence: current inconsistency (`compliance` cs-grid vs
  `ai-kit` --3 vs `agentic-dev` --2); impeccable rhythm/alignment.

**V6 — Roadmap edition (Agentic-Dev) visual differentiation.**
A not-yet-shipped edition currently looks identical to shipped ones (only a status pill marks it).

- A. Identical card styling + status pill (current).
- B. **Dashed/ghost treatment** — dashed hairline border + slightly reduced surface contrast
  on the roadmap cards, signalling "wired slot, not yet built" (mirrors the EU-AI-Act
  "registry-gated, entitlement-scoped" not-yet-authored framing).
- C. Watermark/"ROADMAP" plate behind the hero.
- Reco: **B** (dashed = "scaffolded slot"), reused for the EU-AI-Act add-on card. Confidence:
  medium. Evidence: ADR-0040 "scaffold only an empty named slot"; Trunk `09af2984` status-
  signal language; honesty floor (`specs/04` show-don't-assert).

**V7 — Section rhythm / band separation.**
Every section is a top-hairline band at identical padding; six in a row read monotone.

- A. Keep uniform hairline rhythm.
- B. **Alternate surface tone** on the commerce + add-on bands (`--cs-surface-1` vs `--cs-bg`)
  — Elementor/Depot Night-Sky↔Carbon alternation, depth via tone not shadow.
- Reco: **B**, sparingly (≤2 toned bands per page). Confidence: medium. Evidence: Depot
  `707c2922` "alternating Night Sky/Carbon sections"; Elementor `86351665` surface-inversion;
  no-shadow floor (`global.css:3`).

**V8 — Commerce-model section (one-time/bundle/per-module/subscription).**
Today: 4 equal cards. The defining message is the **one-time-vs-recurring** distinction.

- A. Keep 4-card row.
- B. **2-axis split** — a "buy once / own it" pair vs a "subscribe / keep it current" pair,
  visually grouped, so the no-lock-in contrast (vs SaaS) is structural not just verbal.
- C. Anthropic-style toggle (one-time ⇄ subscription) revealing each set.
- Reco: **B**. Confidence: medium. Evidence: Anthropic `63588e00` model-split toggle; ADR-0040
  "Compliance Updates is a distinct SKU"; the no-lock-in differentiator in current copy.

**V9 — Hero evidence transcript treatment.**
Each page opens with a static `caisson <cmd>` `<pre>`. Strong brand move; under-leveraged.

- A. Keep static.
- B. Subtle reveal (lines fade/step in on view; respects `prefers-reduced-motion` already in
  `global.css:369`).
- C. Tabbed mini-widget (e.g. pricing hero: `entitlements` / `editions` / `subscriptions` tabs).
- Reco: **B** on edition heroes, **C** considered for the pricing hero. Confidence: low.
  Evidence: Column `b23324ad` code-panel hero; impeccable motion = reveal, not decoration.

### BRAND

**B1 — Accent-color discipline on the commerce surface.** `individual: true`
`--cs-accent` currently paints eyebrow + glyph + the `+` include-bullets + accent-card border.
The closest analogs reserve the accent for CTA + one key highlight only.

- A. Keep current broad accent usage.
- B. **Tighten**: accent only on primary CTA + the Compliance hero card's marker; demote the
  `+` bullets and eyebrows to `--cs-fg-muted`, keep glyphs accent-tinted only on status pills.
- Reco: **B**. Confidence: high. Evidence: Depot ("strictly for accents and interactive
  elements") + Inngest ("the singular visual indicator") + Supabase ("sparingly but
  decisively"); ADR-0042 cold-steel restraint. Brand-system-level → present individually.

**B2 — Brand glyph/iconography system.** `individual: true`
Pages use arbitrary Unicode box glyphs (▣ ▤ ▥ ▦ ▧ ⊘ ○ ◷ ▤). They carry no consistent meaning
and several repeat across unrelated concepts.

- A. Keep ad-hoc Unicode glyphs.
- B. **Define a meaning-bound glyph set** (e.g. ◷ = roadmap/pending, ○ = available, ▣ =
  guarantee/control, ⊘ = cap/block) documented in the brand book — still type-rendered,
  WCAG-safe (glyph + label, never color-alone, per `global.css:276`).
- C. Commission a real monoline SVG icon set tuned to the mono type (Martian Mono) and stroke
  weight of the wordmark.
- Reco: **B** now (cheap, locks meaning), **C** as a brand-expansion follow-up. Confidence:
  medium. Evidence: Inngest/Trunk monoline-icon systems; ADR-0042 "status pill never
  colour-alone". Brand-expansion adjacent → present individually.

**B3 — CLI-as-brand on the commerce surface.** `individual: true`
The `caisson <cmd>` transcript is the signature brand artifact. On commerce pages it only ever
shows _status output_.

- A. Keep transcripts to status/output only.
- B. **Extend the metaphor** to the purchase concept — e.g. `caisson buy --edition compliance`
  / `caisson entitlements` as the literal "how you own it" device, making ownership feel like a
  command, not a checkout.
- Reco: **B**, restrained (one purchase-flavored transcript on /pricing). Confidence: medium.
  Evidence: the existing `caisson entitlements` block (`pricing/page.tsx:192`); brand voice
  "evidence over adjectives". Brand-expression decision → present individually.

### SEO

**S1 — Add an FAQ section + `FAQPage` JSON-LD to /pricing.**
Every pricing reference in the corpus carries an FAQ accordion (OpenAI `48b87627`, Fourthwall,
Teachable, RevenueCat `0dd86030`, Vectary, Dropbox, Pixso); Caisson's has none. FAQ content
("Is Local-first really free?", "One-time vs subscription — what's the difference?", "What is
an edition?", "Do I own the source?") is rich-result-eligible and captures the exact
long-tail queries a no-price page should own.

- A. No FAQ (current).
- B. **FAQ section + `FAQPage` structured data** (static, in-MDX/JSON-LD; no server route —
  ADR-0045 compatible).
- Reco: **B**. Confidence: high. Evidence: corpus-wide FAQ ubiquity; FAQPage rich-result
  eligibility; ADR-0045 static-export.

**S2 — Reciprocal internal linking pricing ⇄ editions.**
Compliance & AI-Kit link to `/pricing`; Local-first & Agentic-Dev do **not**; `/pricing`
links to **none** of the four edition pages.

- A. Keep current sparse linking.
- B. **Wire both directions** — every `/pricing` edition card → its edition page; every
  edition SKU strip → `/pricing` ("see the full lineup", as compliance/ai-kit already do).
- Reco: **B**. Confidence: high. Evidence: crawl-depth + internal PageRank flow; the existing
  one-directional links prove the pattern (`compliance/page.tsx:315`, `ai-kit/page.tsx:216`).

**S3 — Per-edition OpenGraph images.**
One global OG image (`opengraph-image.tsx`) serves all routes today.

- A. Keep one global OG.
- B. **Per-route `opengraph-image.tsx`** for each edition + /pricing (edition name + one-line
  guarantee on the brand surface) — better social CTR for shared edition links.
- Reco: **B**, low priority. Confidence: medium. Evidence: per-page titles already diverge
  (each edition has bespoke `metadata`); static OG generation is ADR-0045-safe.

**S4 — Structured data for the SKU surface without prices.**
Layout JSON-LD is a single `SoftwareApplication` with `Offer { availability: PreOrder }` and
no `Product` entities.

- A. Keep minimal `SoftwareApplication`.
- B. **`Product` + `Offer` per edition** with `availability: PreOrder`, **price omitted**
  (allowed; `priceCurrency`/`price` simply absent) + `Organization` publisher.
- C. Add `ItemList` of editions for the lineup.
- Reco: **B + C**, prices omitted until the operator locks them (ADR-0048). Confidence: medium.
  Evidence: schema.org PreOrder Offer permits absent price; ADR-0048 no-number rule.

**S5 — Keyword alignment of edition H1s/titles to the high-CPC clusters.**
ADR-0040: compliance CPC 10–50× every other cluster at low KD. Compliance title already
targets "fail-closed infrastructure for regulated SaaS" (good).

- A. Keep current titles.
- B. **Tune H1/H2/title** toward the winnable compliance long-tails (e.g. "multi-tenant RLS
  starter", "SOC 2 / HIPAA SaaS boilerplate", "audit-ready Postgres template") without
  keyword-stuffing the voice.
- Reco: **B** for Compliance + AI-Kit (EU-AI-Act intersect); leave Local-first/Agentic-Dev
  brand-led. Confidence: medium. Evidence: ADR-0040 CPC/KD evidence; current Compliance title
  already leans this way.

### COPY

**C1 — Reduce the "Early access — join the waitlist" repetition.**
The phrase appears ~12× on /pricing alone.

- A. Keep one canonical phrase on every card (rhythm, but heavy repetition).
- B. **One section-level CTA** + a single quiet per-card marker; vary the _waitlist section_
  CTA copy ("Numbers land with the invite" is already good).
- Reco: **B** (pairs with V2). Confidence: high. Evidence: impeccable "reduce cognitive load /
  repetition"; the phrase density in `pricing/page.tsx`.

**C2 — Pricing hero headline.**
"Own the code, or subscribe." is clean and captures the model, but is wedge-neutral.

- A. Keep "Own the code, or subscribe."
- B. **Lead with the wedge** — e.g. "Audit-ready. Yours to own." then the model as sub.
- Reco: **A** (the model duality IS the page's job; the wedge leads the _home_ + Compliance
  hero, not /pricing). Confidence: medium. Evidence: ADR-0040 (compliance leads _acquisition_);
  /pricing intent = explain the commerce model.

**C3 — Placement of the "$199 kits" firewall footnote.**
Currently the very last line, buried under the waitlist form (`pricing/page.tsx:357`).

- A. Keep it at the bottom (current).
- B. **Move it adjacent to the edition lineup / commerce band** where the base-vs-cheap-kit
  contrast is contextually live — still one line, never a table (ADR-0040 firewall held).
- Reco: **B**. Confidence: medium. Evidence: ADR-0048 "generic base appears once, as a
  footnote, never a comparison table" — placement is open, the format is locked.

**C4 — Primary-CTA verb standardization by edition tier.**
"Request early access" (Compliance, AI-Kit) vs "Read the docs"+"Star on GitHub" (Local-first)
vs form-only (Agentic-Dev).

- A. Keep per-page bespoke CTAs.
- B. **Standardize by tier**: paid editions → "Request early access" (primary) + "Read the
  docs" (ghost); free AGPL flank → "Star on GitHub" + "Read the docs" (no waitlist primary,
  correct for free); roadmap → "Join the list".
- Reco: **B**. Confidence: high. Evidence: ADR-0040 edition roles (free flank = top-of-funnel
  awareness, not waitlist revenue); current divergence is unsystematic.

**C5 — Commerce "no lock-in" reassurance line.**
The one-time-vs-subscription distinction is the differentiator vs SaaS; "No lock-in" appears
as an H2 but the reassurance is thin.

- A. Keep as-is.
- B. **Add one reassurance line**: "You own what you buy outright; subscriptions are optional,
  layered on top, and cancel without taking your code." Pairs with V8.
- Reco: **B**. Confidence: medium. Evidence: ADR-0040 one-time ownership model; voice floor
  (concrete guarantee over adjective).

**C6 — Edition×capability matrix copy (firewall-safe "what's in each").**
Every pricing reference carries a comparison matrix; Caisson deliberately has none because of
the ADR-0040 firewall. But the firewall forbids **base-vs-COMPETITOR** tables — a
**plan-vs-plan** (edition × included-module) matrix is allowed and is the single most-requested
scannable artifact on a pricing page.

- A. Keep prose-only (no matrix) — safest, but buyers can't scan "what do I get in each".
- B. **Add an edition × module matrix** (rows = modules: auth, RLS, WORM, audit-chain, field-
  crypto, metering, caps, evals, guardrails, compute-seam, privacy-gate, agent-kernel…; cols =
  the 4 editions; cells = included / add-on / —). Explicitly NOT a competitor column.
- C. A lighter "each edition includes" chip-list per card (no grid).
- Reco: **B** — it is the biggest missing pattern and is firewall-compliant. Confidence: high.
  Evidence: OpenAI `48b87627` / Linear `5d709fa1` / Rive `59d7249e` matrices; ADR-0040 firewall
  is specifically "base vs cheap-boilerplate **comparison table**", not a within-product matrix;
  ADR-0003 "editions are compositions of the same base" — a composition matrix is on-brand.

---

## 4. Craft / decision summary table

| #   | Surface | Fork                                 | Reco                                  | Conf    |
| --- | ------- | ------------------------------------ | ------------------------------------- | ------- |
| V1  | visual  | Edition lineup hierarchy on /pricing | Featured lead + 3                     | high    |
| V2  | visual  | Repeated price-slot pill             | n8n price-less slot + 1 section CTA   | high    |
| V3  | visual  | SKU-card surface                     | Depot inset top-highlight (no shadow) | medium  |
| V4  | visual  | Edition-page template                | Shared skeleton, variable depth       | high    |
| V5  | visual  | Pieces-grid density                  | Rule by count (--2/--3/1-col)         | high    |
| V6  | visual  | Roadmap edition differentiation      | Dashed/ghost "scaffolded slot"        | medium  |
| V7  | visual  | Section band rhythm                  | Alternate surface tone (≤2 bands)     | medium  |
| V8  | visual  | Commerce-model layout                | 2-axis buy-once vs subscribe          | medium  |
| V9  | visual  | Hero transcript treatment            | Reveal-on-view; tabbed on /pricing    | low     |
| B1  | brand   | Accent discipline                    | Tighten to CTA + hero marker          | high*   |
| B2  | brand   | Glyph/icon system                    | Meaning-bound set now, SVG later      | medium* |
| B3  | brand   | CLI-as-brand on commerce             | Extend metaphor, restrained           | medium* |
| S1  | seo     | FAQ + FAQPage JSON-LD                | Add it                                | high    |
| S2  | seo     | Reciprocal pricing⇄edition links     | Wire both directions                  | high    |
| S3  | seo     | Per-edition OG images                | Per-route, low priority               | medium  |
| S4  | seo     | SKU structured data sans price       | Product+Offer PreOrder, ItemList      | medium  |
| S5  | seo     | H1/title keyword alignment           | Tune Compliance/AI-Kit clusters       | medium  |
| C1  | copy    | "Early access" repetition            | Section CTA + quiet marker            | high    |
| C2  | copy    | Pricing hero headline                | Keep ownership-duality line           | medium  |
| C3  | copy    | "$199 kits" footnote placement       | Move adjacent to lineup               | medium  |
| C4  | copy    | CTA verb by tier                     | Standardize paid/free/roadmap         | high    |
| C5  | copy    | No-lock-in reassurance               | Add one line                          | medium  |
| C6  | copy    | Edition×module matrix                | Add it (firewall-safe)                | high    |

`*` = brand-expansion adjacent → surface to operator individually, not batched.

## 5. Constraints honored (non-negotiable)

- **No hard prices anywhere** (ADR-0048) — every recommendation keeps the price slot deferred.
- **No base-vs-competitor comparison table** (ADR-0040) — C6's matrix is within-product
  (edition × own-module) only; the "$199 kits" line stays a one-line footnote (C3).
- **Compliance hero, no co-heroes, no geo-restriction** (ADR-0040) — V1 elevates Compliance.
- **Cold-steel teal floor, no shadows, hairline depth** (ADR-0042 / `global.css:3`) — V3/V7
  use inset-highlight + surface-tone, never drop shadows.
- **Waitlist conversion, static export, no server route** (ADR-0045/0046) — S1/S4 are static
  JSON-LD; the CTA target is unchanged.
