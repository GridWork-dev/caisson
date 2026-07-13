---
updated: 2026-07-13
status: live
grounds:
  - knowledge/decisions/ADR-0040-positioning-hero.md
  - knowledge/decisions/ADR-0080-copy-messaging-expansion.md
  - specs/04-voice-and-brand.md
  - outputs/archive/kickoffs/positioning.md
---

# Positioning

## Who it's for

Three ICP segments, one buyer firewall (ADR-0040):

- **ICP-1 (primary, hero):** the Compliance Builder — a dev/founder/agency building regulated
  SaaS (SOC 2, HIPAA, legal, fin-ops, health). Has the compliance budget. Buys to skip 3–6 months
  of regulated-data plumbing and to walk into an audit ready.
- **ICP-2:** the AI-Product Engineer who just hit the production wall — metering, spend caps,
  eval regressions, missing guardrails.
- **ICP-3 (flank):** the Local-first/Privacy Builder. Enters through the free open-core flank,
  converts up later.
- **Anti-ICP (refused at the paid hero tier):** the price-shopping "just want a starter kit"
  buyer. Caisson does not compete with generic boilerplate kits for this buyer — that segment is
  served only by the free flank, and the compliance hero is never discounted to win them.

## The wedge and the umbrella

Two-layer positioning, not a single claim (ADR-0040):

- **Umbrella (the house):** a production-grade codebase library — the load-bearing
  infrastructure cheap boilerplates skip. The common enemy is happy-path boilerplate: everyone
  ships auth + Stripe + a landing page; nobody ships the parts that matter when you get audited,
  when the AI bill spikes, when a tenant's rows leak across RLS, when a regulator asks for
  evidence. One promise houses every bundle — no orphans.
- **Hero wedge (what acquisition leads with): Compliance.** It's the front door; the
  production-rigor umbrella is the house it opens into.

**Why compliance leads** (evidence, not preference, per ADR-0040): compliance CPC runs 10–50×
every other cluster at low keyword difficulty (winnable SEO, high-budget B2B buyers); it's the
cleanest unserved gap, named unprompted 3× in the market scan ("no turnkey full-stack compliance
starter" — RLS + WORM + audit chain); comparable dev-kits prove willingness-to-pay (compliance
kits clear 5–10× generic-kit pricing); it scored the strongest baseline in the opportunity ranking
(9/9/9/9 on baseline/defensibility/WTP/recurring); and the compliance-update subscription is the
single strongest recurring-revenue lever in the market. The SERP is currently owned by finished
compliance platforms (Vanta/Drata class), not dev-kits — a picks-and-shovels gap under them.

**Bundle roles under the umbrella** (ADR-0040, roles carried 1:1 into the six-bundle catalog per
ADR-0257/0258): Compliance = paid hero / front door · AI-Production = strongest #2 ("same rigor,
applied to AI infra"; intersects compliance via EU AI Act Annex IV) · Local-first = the free flank
(top-of-funnel awareness, not a revenue line) · Agentic-Dev = narrowest, positioned post-wedge ·
Provenance = net-new signing/audit-chain carve · Everything = the roll-up.

## What Caisson is NOT

- **Not a platform.** "Platform" is the term 5 of 6 competitors use — a direct category
  collision. Caisson is a library / codebase / substrate / kit (ADR-0080 §1).
- **Not "automate compliance."** That phrase is Secureframe's owned claim; Caisson doesn't make
  that promise (ADR-0080 §1).
- **Not certified, and never implies it is.** Caisson ships the technical controls; the
  organizational program (HR/vendor/incident-response policy) and the actual third-party audit
  remain the buyer's. Caisson generates the evidence — it does not confer the certification
  (ADR-0080 §3, the "flag, never guess" honesty boundary carried into copy from ADR-0006).
- **Not a scanner / detective control.** That's the compliance.tf frame — after-the-fact
  detection. Caisson's claim is prevention at the construction layer (ADR-0080 §4).
- **Not the generic $199-starter-kit competitor**, and never positioned as one on the hero tier.
  The better-than-a-cheap-kit claim appears once, as a footnote, never as a comparison table —
  repeating it drifts toward the exact comparison-table energy the firewall exists to avoid
  (ADR-0040 buyer firewall; ADR-0080 §5/Rejected).
- **Not hypey.** No "revolutionize / seamless / effortless / unlock / supercharge / cutting-edge /
  next-generation / leverage / empower / delight," no emoji, no exclamation marks in a hero, no
  manufactured urgency — regulatory deadlines are real and get cited by name (SOC 2 CC6.x, HIPAA
  §164.312, EU AI Act Annex IV); nothing else is (specs/04 §3–§4).

## Canonical positioning

**One sentence:** Caisson is compliance-grade infrastructure for regulated SaaS — the
fail-closed RLS, WORM storage, and audit chain a happy-path boilerplate skips, wired and tested
before your first customer instead of retrofitted after your first audit.

**One paragraph:** Everyone ships auth, Stripe, and a landing page. Nobody ships the parts that
are load-bearing when a tenant's rows leak across a broken RLS policy, when an auditor asks for
signed evidence instead of a screenshot, or when a regulator wants a control mapped to a specific
clause. Caisson is a production-grade codebase library built around that gap: a compliance
edition that leads (SOC 2, HIPAA, audit-ready by construction — ADR-0040), under a production-rigor
umbrella that also covers AI infrastructure, local-first/privacy-first AI, and governed agentic
tooling. It's a library, not a platform — you own the code, you run the audit, Caisson generates
the evidence.

## Tagline, headline, subhead (locked — specs/04 §1, §6)

- **Tagline (persistent category line):** "Compliance-grade infrastructure for regulated SaaS."
- **Hero headline:** "Fail-closed by construction."
- **Hero subhead:** "Fail-closed Postgres RLS, S3 Object-Lock WORM, and an append-only audit
  chain — wired and tested before your first customer, not backfilled after your first audit."
- **Approved alternate headlines** (campaign/A-B use): "Audit-ready from the first commit." ·
  "Stop adding compliance later." · "Ship the proof, not just the product."
- **Retrofit-cost line** (unclaimed lane — no competitor prices the live-DB rip-out): "SOC 2 from
  scratch: $80k, 6–9 months. RLS + WORM + audit-chain retrofit into a live DB: months more. Both,
  wired on day one." Home page keeps the shorter altitude version ("costs months"); the full
  figures run on `/compliance` (ADR-0080 §4).
- **War-room line** (the retrofit line's reactive sibling — CAISSON-99, Cookiy 45-transcript
  buying-journey finding: compliance gets built in unplanned "war-room" sprints when a prospect
  or partner demands proof mid-deal; nobody markets to that trigger moment): "Install the
  controls before the deal that demands them." Runs on `/compliance` (Who-it's-for, the card
  paired with the retrofit-cost card). Always interview-attributed, never a case study —
  ADR-0319 R5 holds until design-partner conversions exist.
- **Weeks-saved sign-off line** (CAISSON-98, the Cookiy top platform recommendation: approval is
  two-tiered — a champion picks, finance signs off on a "weeks of engineering time saved"
  translation): the 4–8-engineering-week range is the interviewees' OWN in-house build estimate
  (study 019f4a11) and is always phrased as buyers' numbers, never a Caisson benchmark
  (ADR-0080 §3/rejected list — no fabricated benchmarks, no salary math). Runs beside the price:
  home how-to-buy footnote + the `/compliance` pricing-card footnote.

## Message hierarchy

1. **Category claim** (tagline) — compliance-grade infrastructure, for regulated SaaS specifically.
2. **Mechanism claim** (hero H1/subhead) — fail-closed by construction: RLS + WORM + audit chain,
   named by technology, not adjective.
3. **Contrast claim** — "A scanner is a smoke detector. Caisson is the fail-closed construction"
   (the sharpest incumbent contrast, aimed at the compliance.tf/Vanta/Drata detection-frame
   competitors — ADR-0080 §4).
4. **Cost claim** — the retrofit-math line, quantifying the alternative (build it yourself, later,
   into a live database) against wired-on-day-one.
5. **Bundle-specific claim** (per ADR-0040 roles + specs/04 §9) — every non-compliance bundle
   reads as "the same rigor, applied to `<their problem>`" under the compliance-led umbrella, never
   as a co-equal hero: AI-Production = rigor + control over the token-bill/eval-regression
   spike; Local-first = sovereignty ("your data never leaves the device"); Agentic-Dev =
   governance (a governed kernel, not "autonomous magic").
6. **Footnote claim** (once, never a table) — better base than a $199 generic kit.

## Proof points (evidence over adjectives — specs/04 §3, ADR-0080 §2)

Caisson's proof strategy is code-as-proof, not logo walls or star ratings. The real substrate
artifacts that carry the claims:

- **Offline Ed25519 license verification** — the registry entitlement/license layer verifies
  signed license tokens without a network round-trip; this is the mechanism EU AI Act Annex IV and
  other framework packs are gated behind as entitlement-scoped modules, not core (ADR-0040).
- **S3 Object-Lock WORM** — append-only, tamper-evident audit storage; the retention/escalation
  mechanics are their own locked line (see `knowledge/decisions/ADR-0202`, `ADR-0230` for current
  posture — governance-mode object lock now, compliance-mode at the launch flip).
- **Fail-closed Postgres RLS** — row-level security that denies by default rather than allowing by
  default; the hero mechanism named directly in the H1/subhead.
- **Append-only audit chain** — a verifiable, hash-chained audit trail (`verifyChain` output is
  itself a proof artifact, per ADR-0080 §2).
- **OSCAL control mappings** — machine-readable control-to-clause mapping (SOC 2 CC6.x, HIPAA
  §164.312, EU AI Act Annex IV framing) underpinning the "precise scope, never over-claim" honesty
  law (ADR-0080 §3; OSCAL version lock in `knowledge/decisions/ADR-0179` region).
- **CI green-checks proof strip** — "6/6 checks green: build·lint·unit·integration·standards-gate·
  golden-file" substitutes for a customer-logo wall pre-launch (ADR-0080 §2).

## Open items / staleness note

ADR-0080's conversion-copy law (§5) was written when the site had no checkout ("no checkout —
ADR-0087/0081," waitlist CTAs, "indicative — final pricing set before launch"). That frame is
superseded: the site is live self-serve with committed prices and real checkout (ADR-0082,
reaffirmed FULL V1-live with no roadmap/waitlist framing anywhere by ADR-0237 rider 2). The wedge,
umbrella, ICP firewall, voice floor, and proof strategy in this file are unaffected — they govern
message content, not checkout state. Pricing _structure_ is CLOSED: the catalog-doctrine round
locked 2026-07-06 (ADR-0257 vocabulary · ADR-0258 numbers) — editions dissolved into six bundles
(Compliance, AI-Production, Local-first, Agentic-Dev, Provenance, Everything), every commercial
package individually priced, live in Paddle SANDBOX. Current numbers live in
`pricing-packaging.md`. Body prose above uses the bundle vocabulary directly (not an
edition-to-bundle alias).
