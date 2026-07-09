---
title: "Site presentation rework — IA consolidation, nav rebuild, product depth pages, full analytics, copy + sweep"
status: FORKS LOCKED — ADR-0237 (2026-07-03 fifth picker round, second sitting); build unblocked, waves sequenced after the glossary batch-1 merge. Fork sections kept verbatim as the decision record; locks in the ADR.
tags: [ui, frontend]
proposed-adr: "the next free ADR number at lock (0237+; ceiling 0236 — re-verify against main per ADR-0088)"
adr-interactions: supersedes ADR-0191 (three-route marketplace → unified hub, per the F1 lock) and the ADR-0082 Agentic-Dev roadmap exception (rider 2 — FULL V1-live posture) · extends ADR-0189–0196 remainder (single buy-verb, drawer-vs-cart, WCAG 2.2 AA, Martian-mono, ⌘K) · extends ADR-0118 (F8 split analytics) · governed by ADR-0080 (copy laws) + true-to-built as floor · ADR-0078/0189 brand system TWEAKABLE by the designer lane (rider 1 — explicit design-system changes in the build PRs, not silent drift) · consumes the section-union renderer (ADR-0232/0235) · pricing numbers untouched (ADR-0227)
originating: operator directive 2026-07-03 — "multiple pricing pages conflict, full analytics wired, SEO coherent, copy rewrites, product cards with depth + media, nav rework, footer cleanup, general sweep; execute the clear items, picker the design forks"
---

# SPEC — Site presentation rework

## Goal (WHAT + WHY)

**WHAT:** One coherent buyer-facing presentation layer: a marketplace IA where /pricing, /modules,
and /build stop competing; every module, edition, and subscription is a clickable card that opens a
depth surface with a media slot (placeholder art now — real media is a later phase, TBD); a rebuilt
primary nav (centered links, card-style dropdown panels, cart right, search repositioned, bespoke
icons); the full commerce funnel wired into analytics on both sinks; a copy rewrite of the main
buyer path; a derived (drift-proof) footer; and a general cleanup sweep.

**WHY:** The store converts only if a prospect can hold it in their head. Today the pricing story
is spread across three overlapping routes (718-line /pricing doing eight jobs; /modules and /build
absent from nav AND footer — the best surfaces are the least discoverable); "compliance" names a
module, an edition, and a subscription with no visual disambiguation; the funnel is analytically
invisible (zero commerce events — the ask-AI widget is the only instrumented surface); and the nav
buries the catalog behind one disclosure. Presentation is the product's first proof of rigor.

## Current state (cite real files — ground truth, 2026-07-03)

- **Routes SOT:** `apps/site/lib/routes.ts` (`MARKETING_ROUTES`) → nav/footer-editions/sitemap
  derive. `/modules` + `/build` registered but `nav: false` and hand-omitted from the footer.
- **Nav:** `components/site-nav.tsx` — logo left → EditionsMenu disclosure (ADR-0190 card panel)
  - flat links (Pricing, Docs) → CartTrigger → right cluster (search trigger, Get-started, theme
    toggle) → mobile drawer under 900px.
- **Pricing surfaces:** `/pricing` (8 sections incl. a good/better/best ladder, 4 edition cards,
  an à-la-carte teaser, a SKU matrix duplicating the edition includes, subscriptions, licensing),
  `/modules` (RSC shell + `ModuleCatalog` client facets: edition × 3 price bands), `/build`
  (`StackBuilder`: toggle rows + sticky total rail + cheapest-covering-upgrade hint — the best UX
  on the site), plus per-edition pages with price CTAs, plus the cart drawer. 15 modules / 4
  editions / bundle / 2 paid plans (`lib/pricing.ts` + `lib/catalog.ts`, Paddle SANDBOX ids).
- **Name collision:** module `compliance` ($299) vs edition `compliance` ($799) vs plan
  `compliance-updates`; module `ai-kit` ($149) vs edition `ai-kit` ($599).
- **Analytics:** `PlausibleInit` (root layout, cookieless, env-gated) — custom events ONLY from
  the ask-AI widget; `PostHogInit` (dashboard layout only, `identified_only`, ADR-0118) — no
  custom captures. No view-item / add-to-cart / begin-checkout / purchase events anywhere.
- **SEO:** buildMetadata + JSON-LD builders + MARKETING_ROUTES-derived sitemap + llms.txt/llms-full
  routes + robots; glossary hub/spokes + section-union renderer landing via the ADR-0235 batch-1
  build (in flight — feat/glossary-batch-1).
- **Footer:** `components/site-footer.tsx` — Editions/Legal derive; Product + Resources
  hand-authored (admits it in a comment); "Security" label points at `security.txt` while the real
  `/security` page is missing entirely; Modules/Build/Glossary absent.

## Workstreams

### A — Marketplace IA consolidation (Fork 1)

Stop the three-route competition. Whatever shape locks, the invariants hold: single buy-verb
(ADR-0192), cart drawer (ADR-0193), committed prices (ADR-0082/0227 — numbers untouched), and
every surface reachable from nav AND footer.

### B — Product depth pages (Fork 2)

Every module, edition, and subscription becomes a clickable card opening a depth surface: what it
is, what's in it (manifest-derived where possible), a real code artifact (ADR-0079 §2 discipline),
FAQ, intent-matched CTA, and a **media slot** — placeholder brand art now (deterministic per-item
generated tiles in the ADR-0078 system); real screenshots/motion are a LATER PHASE, deliberately
TBD. The section-union renderer (landing in glossary batch-1) is the natural chassis — module
detail pages are near-identical by construction (`codeArtifact`/`featureGrid`/`faq`/`cta` +
one new `media` section kind).

### C — Nav rebuild (Forks 3 + 4)

Operator direction: centered nav links; dropdown card-panels on a couple of items; cart moved to
the right cluster; search possibly left; bespoke icons; presentation-first. The ADR-0190 editions
panel pattern (rich card items: icon + label + one-liner + price) generalizes to the other
dropdowns. WCAG 2.2 AA floor (ADR-0194) and the 900px drawer split stay.

### D — Full analytics wiring (Fork 8 sets the posture; wiring itself is CLEAR)

Commerce funnel events end to end: `view_item` (detail surface), `add_to_cart`, `view_cart`,
`begin_checkout`, `purchase` (server-confirmed, from the Paddle webhook path — never
client-claimed), plus nav/search/dropdown engagement events. Both sinks stay env-gated no-ops
when unset. The ADR-0118 boundary (cookieless marketing) is the fork: where does PostHog start.

### E — SEO coherence pass (CLEAR)

- `Product`/`Offer` JSON-LD on every catalog card + detail surface (real committed prices);
  `ItemList` kept on /modules; breadcrumbs on all depth pages.
- llms.txt regenerated to cover the full route surface incl. glossary + depth pages; llms-full
  sections for the marketplace.
- One metadata sweep: every route through `buildMetadata`, descriptions answer-first, no
  duplicate titles; sitemap priorities sanity-checked after the IA lands.
- Glossary cross-linking: depth pages link the glossary terms they implement (curated, Fork-D
  ADR-0235 discipline — no auto-linking).

### F — Copy rewrite (Fork 7 scopes it)

gw-gtm-copywriter lane, ADR-0080 laws, adversarially verified like the glossary pipeline (the
Fork-B ADR-0235 pattern is now the house content pipeline: draft → honesty/copy-law skeptic →
revise → gate).

### G — Footer cleanup (CLEAR)

Footer columns derive from `routes.ts` (add a `footer` group/flag) — end the hand-authored drift;
fix the `security.txt` mislabel ("Security disclosure"), add the real `/security` page, add
Modules / Build / Glossary; keep llms.txt + GitHub + updates form; column set final shape falls
out of Fork 1's IA.

### H — General sweep (CLEAR)

Stale-comment fixes (module-catalog "// 14" vs 15), dead-copy grep, orphan-route check, one
Lighthouse a11y/perf pass per template after the rework, contrast-gate re-run, `next build`
bundle-leak check.

## Clear items (pre-authorized — execute without re-asking)

1. Footer derivation + mislabel fixes + missing links (G).
2. Analytics funnel wiring per the Fork-8 posture once locked (D) — event names above.
3. SEO coherence pass (E) in full.
4. Sweep items (H).
5. Placeholder media = deterministic brand-generated tiles; media phase itself stays TBD (B).
6. Copy pipeline mechanics (draft → skeptic → gate) regardless of Fork-7 scope.

## Open forks (operator-owned — do not auto-decide; recommendations labeled)

- **Fork 1 — Marketplace IA shape.** (a) Sharpen the 3 routes: /pricing = editions + bundle +
  subscriptions only; /modules = the à-la-carte catalog + module depth pages; /build = the
  configurator; kill the duplicate SKU matrix; heavy cross-linking. (b) Unified /marketplace hub
  (tabs: Editions · Modules · Build · Plans) with /pricing redirecting in (supersedes ADR-0191's
  3-route lock). (c) Keep the current split; label/cross-link fixes only.
  **Rec: (a)** — high confidence: fixes the confusion without re-litigating ADR-0191; each route
  gets ONE job and a nav/footer seat.
- **Fork 2 — Depth-surface shape.** (a) Routes: `/modules/[slug]` for all 15 via the section-union
  renderer (+ a `media` section kind); editions keep their pages (gain the media slot + card
  grammar); subscriptions get depth sections on /pricing. (b) In-place expanding drawers/modals
  over routes (no new URLs — weaker SEO, no deep links). (c) Modules only; editions/subs unchanged.
  **Rec: (a)** — high confidence: 15 indexable, linkable product URLs with Product JSON-LD is both
  the UX depth ask and an SEO surface; renderer amortized by construction.
- **Fork 3 — Nav arrangement.** (a) Operator sketch: logo far left → search beside it → CENTERED
  link row (with dropdowns) → right cluster: cart · Get-started · theme. (b) Logo left → centered
  links → right cluster: search · cart · CTA · theme (search stays right, one cluster).
  (c) Current arrangement, cart moved right of the CTA group only.
  **Rec: (b)** — medium confidence: centered links + one right-side utility cluster is the cleaner
  grid and keeps search a utility; but (a) is the operator's own sketch — this is pure taste.
- **Fork 4 — Dropdown set.** (a) Two card-panel dropdowns: **Editions** (4 rich cards, price +
  one-liner + icon) and **Marketplace** (Modules · Build · Pricing as cards), rest flat.
  (b) Three: + **Resources** (Docs · Glossary · Changelog · Security) folding the flat links away.
  (c) One "Products" mega-menu (editions + marketplace in a single wide panel).
  **Rec: (a)** — medium-high: two panels match the two real decision axes (which capability /
  how to buy) without mega-menu weight; Docs stays a flat top-level link (buyers go there
  constantly).
- **Fork 5 — Name-collision fix.** (a) Qualify DISPLAY labels only (ids/registry untouched):
  module rows read "Compliance Core", "AI Kit Runtime" (or per-function labels: "Evidence &
  control mapping") + a type chip (Module/Edition/Plan) everywhere a price appears.
  (b) Rename the colliding module ids properly (registry/manifest/Paddle ripple — breaking).
  (c) Type chips alone, names untouched.
  **Rec: (a)** — high confidence: kills the ambiguity at every surface a buyer sees, zero
  registry/entitlement risk pre-launch.
- **Fork 6 — Bespoke icons.** (a) Commission the designer lane: one bespoke in-brand icon per
  module/edition/plan (~21 marks, ADR-0078 system, single-accent ADR-0189 compliant) — used in
  nav panels, cards, depth pages. (b) Restyle the existing `Icon` set with per-edition accent
  treatments (cheaper, less distinctive). (c) Defer icons to the media phase.
  **Rec: (a)** — medium: "really focus on presentation" argues for bespoke; it is the single
  highest-craft-per-pixel investment on the card system.
- **Fork 7 — Copy-rewrite scope.** (a) The buyer path: home + /pricing + all card/depth copy +
  nav/dropdown microcopy. (b) Full marketing surface (adds edition pages, security, procurement,
  changelog framing). (c) Home only.
  **Rec: (a)** — medium-high: the buyer path is where the confusion cost lives; edition pages
  were recently reworked and D3 audit findings will catch stragglers.
- **Fork 8 — Analytics posture.** (a) Keep ADR-0118: Plausible custom-event funnel on marketing
  (cookieless, no consent banner) + PostHog `purchase`/revenue captured SERVER-SIDE from the
  Paddle webhook + PostHog client staying dashboard-only. (b) Extend PostHog JS to the marketing
  site (full funnels/replay pre-auth — supersedes ADR-0118's cookieless-marketing posture, likely
  consent banner). (c) Plausible-only everywhere (drop PostHog wiring beyond the dashboard).
  **Rec: (a)** — high confidence: full-funnel numbers with zero consent-banner cost; PostHog gets
  the money events server-side where they're authoritative anyway.

## Sequencing

1. Glossary batch-1 (in flight) merges FIRST — it lands the renderer + routes.ts/footer touches
   this SPEC builds on. The audit v2 PR is doc-only (no conflict).
2. Lock ADR (0237+) → wave 1: IA + nav + footer + name-qualification (the structural core).
3. Wave 2: depth pages + placeholder media + icons (Fork 6 lane) + copy rewrite (Fork 7 scope).
4. Wave 3: analytics wiring + SEO coherence pass + sweep (fast follows on the settled IA).
   Design research front-half per doctrine: refero patterns for nav/mega-panel + marketplace cards →
   gw-frontend-designer drives craft inside the brand floor (ADR-0078/0189); gw-persona-walkthrough
   critiques the rebuilt funnel before ship.

## Verification (goal-backward)

Can a cold prospect, in one session: understand the three ways to buy without re-reading; open any
module/edition/plan card to a depth page with real code + (placeholder) media; find Modules/Build
from nav AND footer; never see an ambiguous "compliance"; and does every funnel step emit exactly
one event into the locked sinks? Existing gates: contrast, WCAG 2.2 AA, next build, data-lints.
