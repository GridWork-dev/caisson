---
date: 2026-07-07
status: research — NOTHING here locks; every recommendation is an operator-decision input
sources:
  - wave1-research-legs.md (7 legs: turbostarter · ui_reference · positioning · pricing · paddle · aeo · channels)
  - wave2-ui-patterns.md (10 sites: vanta · drata · secureframe · shipfast · makerkit · supastarter · saaspegasus · clerk · resend · workos)
method: 17 sonnet agents, live web (exa + crawl4ai), 2026-07-06/07; operator screenshots (getRoman.ai, Analyse, TurboStarter) as seeds. Prior positioning ADRs treated as challengeable inputs per the operator's research directive — the locks themselves stand until re-locked.
---

# Pre-launch research synthesis — 2026-07-07

## TL;DR

1. **Positioning:** the market's dominant vocabulary is "boilerplate / starter kit"; compliance-first is a
   real sub-niche selling at 2–5× generic prices ($999–1,999 Clynova vs $199–599 ShipFast-tier) — but it is
   **invisible in mainstream discovery** (zero compliance products in any 2026 "best boilerplate" roundup).
   Every wedge company that broadened (Vanta, WorkOS) did it **after** wedge traction, never at launch.
   The shipped site is internally inconsistent: hero is 100 % compliance, nav already treats six bundles as
   peers, and a dedicated `/compliance` route exists unused as an acquisition landing page.
2. **Pricing:** $329/$399 entry anchors sit exactly in the market band — keep. $1,049/$2,059 are defensible
   and possibly **under**-priced (no comp ships WORM/field-crypto/OSCAL at any price; market ceiling
   $1,276–1,499). One structural flag: the market's $599–799 band buys **seats** (Makerkit Team ≤5 devs
   $599; Supastarter Startup ≤5 seats $799), so $629/$739 single-seat bundles invite a "why no seats?"
   comparison. 40 % renewal beats the only disclosed comp (Makerkit ~50 %), but 6 of 9 comps advertise
   "lifetime updates included" — copy must carry the difference.
3. **Paddle:** the dunning question in CAISSON-25 is answered by docs — **default = auto-cancel after 7
   retries / 30 days** (2025-01-09 platform changelog); set Retain → CANCEL explicitly at go-live (Retain
   cannot be tested in sandbox). Verification is the go-live long pole (1–3 weeks; #1 rejection cause is
   entity-name mismatch; unconditional refund policy required; support offerings must read as software,
   not consulting). Catalog recreation is fully API-scriptable — PaddleHQ publishes an official agent
   skill for exactly this; the "manual operator act" can become an operator-approved script run.
4. **AEO:** llms.txt is dead as a citation lever (five independent 2026 studies, incl. Ahrefs 137 k
   domains) — keep a minimal file for coding agents only. What works: **comparison pages** (strongest
   content-type predictor, Spearman 0.65; 21+ pages ≈ 900 % more AI-search sessions), **FAQPage schema**
   (+45 % to +350 %), fully-populated **Product schema** on bundle pages, **directory listings** (54.5 %
   of distinct AI citation sources), Perplexity-first sequencing. Open frame nobody owns: _"own your
   compliance infrastructure vs rent a Vanta/Drata subscription."_
5. **Channels:** at $329–2,059 the buyer is agencies (30 %) + regulated teams (10 %), not launch-day
   impulse buyers. Best-evidenced paid channel: security/dev newsletter sponsorship (ThreatSpike
   $25–75 k pipeline/campaign; Rubrik $100 k off a $5–10 k test; entry at Bytes $99–299/issue).
   Affiliate at 30 % = $315/Compliance referral, $618/Everything — 3–5× competitor payouts at zero fixed
   cost. Skip AppSumo (40–50 % take + 70–90 % discount mandate) and Reddit-as-cadence (r/SaaS 60-day cap).
6. **UI:** 17 agents produced a ranked pattern catalog (below). The through-line: **every winning device
   for this buyer is an honest artifact** — real code, real file tree, real architecture, real math.
   Caisson's copy law isn't a constraint here; it's the strategy the best references already run.

---

## 1. Positioning (operator decision D1 — the big one)

**Evidence:**

- Category language: "SaaS boilerplate/starter kit" is what buyers search; "production-grade" is a
  qualifier, not a category. "Compliance boilerplate" is a separate, smaller, higher-value discovery
  channel (GRC terms, not dev-tool roundups).
- The compliance sub-niche monetizes 2–5× higher (Clynova $999–1,999) and Caisson's compliance CPC
  research (spec 00) already said 10–50× CPC vs other categories.
- Sequencing evidence is one-way: Vanta (600 customers pre-website, SOC2-only → platform at scale),
  WorkOS (SSO wedge → platform after OpenAI/Cursor adoption). Nobody successfully launched broad.
- Site truth: hero = compliance-only; nav marketplace panel = six equal bundles; `/compliance` route
  exists; the "umbrella" section argues production rigor without naming the other five bundles.

**Options (none auto-decided):**

- **(a) Minimum-diff, research-recommended [high confidence]:** keep the compliance hero; insert the
  six-bundle grid immediately after the hero (asset already exists in the nav panel); repoint all
  compliance-specific acquisition (ads, outbound, SOC2/HIPAA SEO) at `/compliance` so `/` stops doing
  double duty. ~1 section of work.
- **(b) Dual-door hero [medium confidence]:** first-scroll split — "Building something regulated?" →
  Compliance · "Building for production?" → five bundles/Everything. Documented pattern for genuinely
  two-sided audiences (Etsy/Airbnb dual-persona; ~60 % of scored SaaS heroes carry a secondary path).
- **(c) Full platform-first rewrite:** matches the operator's larger-scope instinct but contradicts the
  wedge-first evidence pre-traction; a broad claim with zero customers is weaker than a sharp one.
- **(d) Keep as-is:** preserves the sharpest hook; forecloses generic-boilerplate discovery entirely.

## 2. Pricing (operator decisions D2/D3)

| Anchor                                | Verdict                          | Evidence                                                                                                                                                                          |
| ------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agentic-Dev $329 / Provenance $399    | **Keep**                         | Exactly the $199–399 single-dev band (ShipFast/TurboStarter/Makerkit/Supastarter)                                                                                                 |
| Local-first $629 / AI-Production $739 | **Flag: seat mismatch**          | Market's $599–799 buys ≤5 seats; consider a seat allowance at these tiers or copy that pre-empts the comparison                                                                   |
| Compliance $1,049 / Everything $2,059 | **Defensible; room UP not down** | Ceiling comps $1,276–1,499 (Gravity Elite, Supastarter Agency) with commodity feature sets; zero comps ship WORM/field-crypto/OSCAL                                               |
| 40 % renewal                          | **Keep number; fix copy**        | Beats Makerkit's ~50 %; but "lifetime updates included" is the category default (6/9 comps) — the subscription must visibly buy more than updates (credits, coverage, support)    |
| À-la-carte modules                    | **Price high, steer to bundle**  | Only precedents are $1–3 convenience add-ons (DiggaByte) — anchoring anywhere near that undercuts the bundle story; module prices should make the bundle read as the obvious deal |

## 3. Paddle production runbook delta (feeds CAISSON-25 + launch-runbook)

1. **Submit verification NOW, parallel to everything** — 1–3 week lead, no SLA. Pre-fix the four
   documented rejection causes: unconditional refund policy (no qualifiers), exact entity-name match
   (Paddle form = site ToS = payout bank account; single-member LLC: owner's SSN/EIN on the W-9, not
   the LLC's, when disregarded), the verbatim MoR disclosure sentence in ToS, support-bot framed as
   software-delivered.
2. **Dunning (closes CAISSON-25 item 1):** default is auto-cancel at day 30 after 7 retries;
   `subscription.past_due` → retries → `subscription.canceled`. Explicitly set Retain → Payment
   recovery → **Cancel** (cannot be verified in sandbox — post-flip config). Canceled subs can't be
   reinstated → consistent with the 40 %-renewal re-purchase design. Map entitlements: `past_due` =
   still-entitled (grace), revoke only on `canceled`.
3. **Catalog recreation: script it.** Official path: GET sandbox catalog → transform → POST to live
   (go-live checklist), or the PaddleHQ agent-skill (`skills/catalog-setup`, MCP server or Node SDK
   seed script). Tax category `saas` per product — **locks after first sale**. Still operator-gated;
   the script just replaces 35 dashboard clicks.
4. **Post-flip verification pass:** base URL, live keys/tokens, `pwCustomer` in `Paddle.Initialize()`,
   new live webhook destination + IP allowlist, every hardcoded `pri_`/`pro_` id swap.
5. **Checkout:** surface a VAT-ID field for EU B2B (reverse charge) instead of relying on
   post-purchase revision.

## 4. AEO action list (ranked)

1. **15–20 "Caisson vs X" pages** (ShipFast, Makerkit, Supastarter, Bedrock, compliance.tf, Clynova,
   Vanta/Drata/Delve as "own vs rent") — answer capsule in first 30 %, tables > prose, FAQPage schema,
   visible last-updated, honest trade-offs. The single strongest lever found.
2. **Product + FAQPage schema** on the six bundle pages (fully populated or not at all — generic
   schema is null-to-negative).
3. **Crawlability audit first** (73 % of sites have a silent blocker): SSR content in raw HTML,
   robots.txt explicitly allowing GPTBot/ClaudeBot/PerplexityBot/OAI-SearchBot.
4. **Directories:** SaaSHub, AlternativeTo ("alternative to ShipFast for compliance-first teams"),
   DevHunt, StackShare; Product Hunt at launch; G2/Capterra deferred until real reviews exist.
5. **3 niche explainers** on uncontested queries: WORM audit logs for SaaS, OSCAL export from a
   TS stack, multi-tenant RLS for compliance (FAQ-structured, table-heavy).
6. **llms.txt: minimal file, zero further investment** (five-study convergence on no citation effect;
   its only real consumers are coding agents — which does matter for create-caisson users).
7. Sequencing: Perplexity first, ChatGPT second; Claude lags for unknown brands — docs depth is the
   long-game Claude lever.

## 5. Launch channels — 90-day shape

- **Now → day 0 ($0):** publish/promote the Apache-2.0 base publicly, seed the Discord as the
  dev-rel surface (Supabase/Vercel model), founder build-in-public 90/10.
- **Day −14 → 0:** affiliate program live (30 %→50 % tiers; $315–618/referral economics do the
  recruiting), honest time-boxed launch discount only if a real one is wanted (no rotating scarcity).
- **Launch week:** PH + Show HN pointed at the open base/kernel story (not the $1k+ SKUs); one-shot
  r/SideProject + r/SaaS (60-day cap — not a cadence).
- **Weeks 2–6 ($3–8 k):** newsletter tests — one dev-generalist (Bytes $99–299) + one
  security/compliance list (TLDR InfoSec class) with UTM'd per-bundle landers; Rubrik pattern
  (test small → scale what converts).
- **Weeks 4–12:** founder outbound to agencies/healthtech consultancies with the Danda anchor
  ("de-risk SOC2/HIPAA prep before burning $15–50 k on a firm").
- **Ongoing:** 2–4 comparison/tutorial pieces per week; ROI-calculator page per bundle.
- **Skip:** AppSumo/LTD, Discord infiltration tactics, YouTube until newsletters prove ROI
  (then micro-tier $400–4.5 k on security-adjacent channels).

## 6. UI pattern catalog — build-wave candidates (merged, ranked)

**Tier 1 — this cycle (all honest-artifact by construction):**

1. **Real file-tree + real code bento** (TurboStarter; Supastarter's tree doubles as a linked ToC) —
   homepage. Caisson has 22 real modules to draw from; strongest possible substance proof.
2. **Architecture-isolation diagram + data-lifecycle flow** (getRoman) — the compliance-bundle page
   or a `/security` section: real tenancy-RLS boundary, WORM anchor chain, license-verify flow.
3. **Bundle-builder calculator** (WorkOS adaptation) — check modules à la carte, watch the running
   total pass the bundle price: proves the bundle discount mathematically from committed prices.
4. **"The Apache-2.0 base includes" tile grid** placed right under the bundle prices (WorkOS
   "batteries included" — the anxiety-relief beat, and ADR-0094's open-core story made visible).
5. **Module toggle-stack visual** (WorkOS hero) — per-bundle cards showing real module names ON/OFF.
6. **Badge strip + compliance check grid + framework tiles** (getRoman/Drata/Secureframe) — scoped
   strictly to real control mappings.
7. **Real annotated snippet per module page** (Resend "Integrate this morning" / WorkOS code tabs,
   TS-only single block) + live `@caisson/ui` component embeds where they exist (Clerk).
8. **Configure → Install → Customize 3-step** (Pegasus) — create-caisson made explicit above the grid.
9. **MCP feature-card sequence** (Analyse) — mcp-server module page + Agentic-Dev bundle.

**Tier 1 copy sweeps (near-zero cost):**
reassurance line under every price CTA ("one-time, source you own") · cumulative bundle narration
("everything in X, plus…") · named-mechanism headings (never "enterprise-grade") · upgrade-math FAQ
with the real formula (Pegasus) · talk-buyers-out FAQ ("only need one module? buy the module") (Clerk)
· `[PROBLEM]` eyebrows above feature sections (Drata) · build-vs-buy table with defensible engineering
estimates only (Makerkit) · specificity sweep — replace any generic claim with a real build-state
number · named-human FAQ signature + plain refund terms (Pegasus).

**Anti-patterns (explicitly do NOT adopt):**
price-hiding demo gates (all three compliance platforms — cite as caisson's contrast) · fake
scarcity/countdown + testimonial walls with MRR screenshots (ShipFast; wrong buyer, copy-law
violation) · invented trust strips ("8,500+ customers") · **"Under Development" roadmap block —
conflicts with the locked FULL V1-live posture (ADR-0237 rider 2); adopting it is an ADR amendment
fork, not a copy tweak** · placeholder partner/testimonial slots.

**Deferred (program-class, filed not built):** free-tools OSS ecosystem (package 2–3 Apache-base
pieces as standalone repos — real precedent: Envin/Extro/Loading-UI at 100–400 stars) · public
playground/live demo (repurpose the ADR-0224 live-harness flows) · customer wall/case studies
(post-first-buyers; Pegasus/Makerkit's clickable-live-product format is the copy-law-compliant
template) · founder-story block.

## 7. Cookiy program (funded $100, allocation locked: 4-study split)

- **Created this session (free):** survey **287453** — positioning frame test (compliance-hero vs
  platform-first descriptions, within-subject, expected-price per frame, forced choice + why +
  "what would you need to see before taking $1,000 seriously"); survey **211341** — Compliance VW
  pricing v2 with the real terms (12-mo updates window, 40 % ≈ $419 renewal, $499/yr Developer plan)
  and a ladder bracketing the actual price ($649/$1,049/$1,499/$2,499). The old 374111 is
  superseded (its updates question described a retired $1,499/yr model; patch tool can't edit
  question text).
- **Sequenced spend:** ~20 synthetic interviews ($4, instrument sharpening) → positioning survey
  N=60 ($30) → VW v2 N=60 ($30) → 3 real qualitative compliance-buyer interviews ($30) → ~$6 reserve.
- **Blocked on:** session restart so the Cookiy MCP picks up the rotated key (current session still
  authenticates with the old one; balance shows $1.20 — the $100 presumably sits on the new key's
  account). If the new key is a different account, both surveys recreate in two calls.

## 8. Operator decision menu

- **D1 Positioning/homepage:** (a) six-bundle grid after compliance hero + `/compliance` acquisition
  repoint [research rec] · (b) dual-door hero · (c) platform-first rewrite · (d) as-is.
- **D2 Seat allowance** at Local-first/AI-Production ($629/$739) — add seats, or counter-copy only?
- **D3 Compliance/Everything price** — hold, or take the "room up" signal before launch?
- **D4 UI build wave** — greenlight Tier 1 patterns + copy sweeps as one site kickoff?
- **D5 AEO program** — greenlight comparison pages + schema + directories + 3 explainers?
- **D6 Channels** — greenlight affiliate program + newsletter test budget + the 90-day sequence?
- **D7 Paddle** — greenlight verification submission prep + scripted catalog recreation + Retain=CANCEL?
- **D8 /updates roadmap block** — keep V1-live posture, or open the ADR-amendment fork TurboStarter's
  transparency pattern suggests?
