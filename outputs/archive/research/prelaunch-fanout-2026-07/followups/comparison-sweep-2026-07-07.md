---
title: "Competitor-comparison research memo — five categories, cited"
date: 2026-07-07
status: research — grounds future comparison content + the stack-fit matrix; nothing here locks
method: >
  exa (web_search_advanced_exa, web_fetch) + crawl4ai fanout, live web, 2026-07-07, plus reuse
  of already-verified pricing/positioning claims from wave1-research-legs.md (retrieved
  2026-07-06, cited as such below) to avoid re-fetching what the prelaunch fanout already
  nailed down. One mcp__pal__chat (gpt-5.2) sanity pass on the synthesized "who wins where"
  read before finalizing — see the Method note at the end of that section.
relation: >
  Companion to ../SYNTHESIS.md (D1-D8 decision menu) and ../cookiy-deep-analysis-2026-07-07.md
  (buyer-interview corpus). Where this memo cites a Cookiy-derived figure, it is explicitly
  flagged as a synthetic-persona proxy, not verified market data — do not upgrade it in future
  copy without the same caveat.
scope_note: >
  "Caisson" below means the Compliance bundle ($1,049) and Everything bundle ($2,059) unless
  noted — the categories below are compliance-adjacent by design; the other five bundles
  (AI-Production/Local-first/Agentic-Dev/Provenance) sit closer to category 3 (TS/Next
  boilerplates) and are noted only where directly relevant.
---

# Competitor-comparison research memo — 2026-07-07

## What this is / isn't

A cited sweep of five comparison categories a future "Caisson vs X" page or stack-fit matrix
would draw from. Every factual claim below carries a URL + retrieval date. Two prior research
docs already did the heavy lifting on categories 2 and 3 (`wave1-research-legs.md`, retrieved
2026-07-06) — this memo reuses those citations rather than re-fetching, and adds fresh research
on categories 1, 4, and 5, which the prior fanout didn't cover. Positioning/pricing decisions
stay with the operator; this is source material only.

---

## Comparison matrix

| Category                                                                                                                      | What you get                                                                                       | Delivery model                                                                                                               | Price (typical)                                                                                                                                          | Compliance depth                                                                                                             | Source access                                                                                                                                        | Lock-in                                                                 | Maintenance burden                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Caisson (Compliance/Everything)**                                                                                           | WORM audit storage, field-level crypto, tenancy-RLS, OSCAL export, compliance runtime — TS source  | One-time purchase, source you keep; optional 40%-of-list annual renewal for continued security patches                       | $1,049 / $2,059                                                                                                                                          | Purpose-built (dev toolkit for embedding controls in a product you sell)                                                     | Full source, MIT-adjacent open Base + commercial editions                                                                                            | None after purchase; renewal is optional                                | You own upgrades unless you renew                                                                      |
| **1. Build-it-yourself (OSS assembly)**                                                                                       | Whatever you wire together: better-auth + Drizzle + hand-rolled RLS + hand-rolled audit trail      | Free components, all-in engineering time                                                                                     | $0 in license fees; ~40 eng-hrs for RLS alone (external study) up to 3-6 eng-months for the fuller stack (internal, unverified proxy — see caveat below) | As deep as you build it — nothing is compliance-specific out of the box                                                      | 100% — you wrote it                                                                                                                                  | None                                                                    | 100% yours, forever                                                                                    |
| **2. Compliance-automation SaaS** (Vanta/Drata/Secureframe)                                                                   | Continuous evidence collection, audit orchestration, trust center, vendor-questionnaire automation | Subscription SaaS + a human audit relationship                                                                               | $10,500-$120,000/yr + $12k-$60k audit fees + $8k-$20k pentest; ~$35k-$80k all-in year 1 for a startup                                                    | Deep, but it's a _monitored platform_, not source code embedded in your product                                              | None — you rent access                                                                                                                               | High — the audit relationship + evidence history live in their platform | Zero (they run it) but recurring cost forever                                                          |
| **3. TS/Next boilerplates** (ShipFast/Makerkit/Supastarter/TurboStarter/SaaS Pegasus/Gravity)                                 | Auth+billing+DB+UI scaffold, some team/seat tiers                                                  | One-time purchase (mostly), lifetime-updates-included is the category norm                                                   | $199-$449 single-dev; $599-$1,499 team/seat tiers (5-10 seats)                                                                                           | None — zero comps in this set ship compliance-specific functionality                                                         | Full source                                                                                                                                          | None                                                                    | Yours; "lifetime updates" is the market default, unlike Caisson's windowed-then-optional-renewal model |
| **3b. create-t3-app** (the free floor of category 3)                                                                          | Next.js + tRPC + TS + Tailwind + Prisma/Drizzle + Auth.js, wired together                          | Free, MIT, CLI scaffold                                                                                                      | $0                                                                                                                                                       | None — explicitly "bring your own" for billing, multi-tenancy, admin, compliance                                             | Full source (you wrote none of the compliance layer)                                                                                                 | None                                                                    | 100% yours; T3 team maintains the scaffold, not your app                                               |
| **4. Source-available paid libraries** (Tailwind Catalyst, Sidekiq Pro/Enterprise, Metabase EE, PowerSync, ElectricSQL Cloud) | One best-in-class narrow capability (UI kit, job queue, BI, sync engine)                           | Mixed: buy-once-own-the-code (Catalyst) to metered-usage SaaS (PowerSync/Electric Cloud) to per-seat recurring (Metabase EE) | $149 one-time (Catalyst) to $269-$79,500/yr (Sidekiq Enterprise) to $20,000+/yr (Metabase EE) to usage-metered $0-$1,999/mo (PowerSync/Electric Cloud)   | None are compliance products; narrow scope done deep                                                                         | Varies — Catalyst is a literal ZIP you own; Sidekiq/Metabase ship source under a restrictive commercial EULA; PowerSync/Electric are hosted services | Low (Catalyst) to platform-dependent (PowerSync/Electric Cloud hosting) | Component-scoped only                                                                                  |
| **5. Platform-native** (AWS Audit Manager, AWS Config, Azure Policy, Microsoft Purview Compliance Manager)                    | Audits YOUR cloud resource configuration / employee SaaS usage posture                             | Usage-metered (AWS) or per-employee-seat bundled into an M365 tier (Azure/Purview)                                           | AWS Audit Manager ~$1.25/1,000 resource assessments ($586-$5,812/mo in AWS's own worked examples); Purview Suite $12-$60/user/mo                         | Posture/config auditing of _your own environment_ — not a toolkit for shipping compliance controls inside a product you sell | None — fully hosted, not embeddable                                                                                                                  | High — tied to the cloud/tenant                                         | Zero (managed) but wrong job for Caisson's use case (see below)                                        |

---

## Per-category cited claims

### 1. Build-it-yourself baseline

- **better-auth** is MIT-licensed, free, framework-agnostic TypeScript auth with 28,800+ GitHub
  stars, 940 releases, actively maintained (last push 2026-06-25). The maintainers built and then
  explicitly _removed_ a paid enterprise/dashboard tier from the docs in early 2026 (commits
  "fix: remove enterprise stuff", "remove: dashboard", "fix: remove pricing" on PR #8086,
  merged 2026-03-01) — it remains pure OSS, no paid tier exists today.
  EVIDENCE: https://github.com/better-auth/better-auth — exa GitHub fetch, stars/license/last-push, retrieved 2026-07-07 | https://github.com/better-auth/better-auth/pull/8086 — PR removing the enterprise/pricing docs, retrieved 2026-07-07

- **create-t3-app** is MIT-licensed, free, 28,700+ GitHub stars, scaffolds Next.js + TypeScript +
  Tailwind + tRPC + your choice of Prisma or Drizzle + Auth.js (NextAuth v5). The maintainers'
  own positioning: "this is NOT an all-inclusive template... we expect you to bring your own
  libraries." A 2026 comparison (StarterPick) puts T3's scaffold time at ~15 minutes vs. ShipFast
  ~2 hours vs. Supastarter ~4 hours — but that's scaffold time only; T3 explicitly ships no
  multi-tenancy, no admin panel, no payments, and (relevant here) no compliance layer at all.
  EVIDENCE: https://github.com/t3-oss/create-t3-app — exa GitHub fetch, stars/license, retrieved 2026-07-07 | https://create.t3.gg/ — "NOT an all-inclusive template" quote, retrieved 2026-07-07 | https://starterpick.com/guides/t3-stack-2026 — 2026-04-09, scaffold-time comparison table + feature matrix (Auth/Payments/Multi-tenancy/Admin panel/Time to deploy), retrieved 2026-07-07

- **The Postgres RLS slice specifically has a real, externally-benchmarked engineering cost.** A
  2026 architecture cost study (Appycodes) scoring the four mainstream multi-tenancy patterns
  found the single-DB/tenant_id/RLS pattern — the pattern Caisson's tenancy-RLS module ships —
  costs **~40 engineering hours (their "Architecture Onboarding Cost" metric)** to build from
  scratch: "schema design, RLS/policy setup, test coverage, observability for the chosen pattern,
  and tenant onboarding flow." This is the RLS slice only — it does not include WORM, field
  crypto, or OSCAL.
  EVIDENCE: https://appycodes.com (multi-tenant-architecture-cost-study-2026) — 2026-04-08, updated 2026-05-10, AOC=40hrs for single-DB/tenant_id/RLS pattern, retrieved 2026-07-07

- **The fuller-stack build-cost figure ($15k / 3-6 engineer-months for WORM+field-crypto+
  tenant-isolation+OSCAL combined) exists only in Caisson's own Cookiy buyer-interview corpus —
  and every one of those figures comes from synthetic personas, not real buyers.** Per the
  companion deep-analysis doc, 0 of 5 real Cookiy interviews ever reached a pricing or
  build-vs-buy question; the $15k/3-6mo figures are self-reported by LLM-simulated personas.
  Treat as a directional proxy for perceived cost, never as verified market data — do not present
  it adjacent to the externally-sourced numbers above without this caveat (PAL sanity-check
  flagged this explicitly; see Method note below).
  EVIDENCE: outputs/research/prelaunch-fanout-2026-07/cookiy-deep-analysis-2026-07-07.md (this repo, 2026-07-07) — Lens 3, "WTP ceilings mentioned" section, $15k/3-6mo build-cost proxies, synthetic-only tier

### 2. Compliance-automation SaaS (reused citations — already verified in wave1)

Vanta/Drata/Secureframe are continuous-compliance monitoring platforms with a human audit
relationship, not one-time code: Startup tier (<25 heads) $10,500-$15,000/yr, Growth (25-100)
$20,000-$36,000/yr, Enterprise (100+) $40,000-$120,000/yr, plus separately-billed SOC 2 Type II
auditor fees ($12,000-$60,000) and pentest fees ($8,000-$20,000/yr). All-in year-one budget for a
startup: $35,000-$80,000. Categorically different job than Caisson's dev-tooling bundle — this is
"a compliance program + evidence + monitoring for the company operating the product," not a
toolkit for embedding controls into that product.
EVIDENCE (reused, retrieved 2026-07-06 in wave1-research-legs.md): https://www.techplained.com/best-soc2-compliance-tools (via The Sector Post) — Vanta/Drata/Secureframe tier table + auditor/pentest fees + all-in year-one budget

### 3. TS/Next boilerplates (reused citations — already verified in wave1)

$199-$449 single-developer lifetime licenses (ShipFast, TurboStarter, Makerkit Personal,
Supastarter Solo) scale to $599-$1,499 at 5-10-seat team/agency tiers (Makerkit Team, Supastarter
Startup/Agency, Gravity Elite) — a seat/project-count ladder, not a feature-depth ladder. Zero
comps in this set ship compliance-specific functionality (WORM, field crypto, OSCAL) at any
price point. "Lifetime updates included" is the category default (6 of 9 comps); only Makerkit
(~50% renewal) and SaaS Pegasus gate updates behind any paid renewal at all.
EVIDENCE (reused, retrieved 2026-07-06 in wave1-research-legs.md): https://shipfa.st/ | https://www.turbostarter.dev/ | https://www.promptstoproduct.com/makerkit-review | https://supastarter.dev/llms.txt | https://www.saaspegasus.com/pricing/ | https://usegravity.app/pricing (full citation chain in wave1-research-legs.md "pricing" leg)

**New this session:** create-t3-app is the free floor beneath this whole tier — see category 1
above. A direct feature table (StarterPick, 2026) shows create-t3-app has no payments, no
multi-tenancy, and no admin panel out of the box, vs. ShipFast (Stripe configured, no
multi-tenancy/admin) and Supastarter (Stripe+LemonSqueezy, orgs+RBAC, admin panel) — none of the
three touch compliance.
EVIDENCE: https://starterpick.com/guides/t3-stack-2026 — comparison table, retrieved 2026-07-07

### 4. Source-available paid libraries (net-new research)

- **Tailwind Catalyst / Tailwind Plus** — $149 one-time for the Catalyst UI kit alone, or $299
  one-time for everything (500+ components, all templates, Catalyst), or $979 one-time for a
  25-seat team license. Delivered as a literal downloadable ZIP, not an npm package — "your
  components, not ours." License explicitly forbids redistribution, creating a competing UI
  kit/theme/page-builder, or reselling derivative products — i.e., a buy-once-own-the-code model
  with a no-compete clause, structurally the closest precedent to Caisson's "buy the source, keep
  it forever" pitch. No compliance functionality; pure UI.
  EVIDENCE: https://tailwindcss.com/plus/ui-kit — pricing $149/$299, "buy once, use forever", retrieved 2026-07-07 | https://tailwindcss.com/plus/license — full license text (redistribution/derivative-product restrictions), retrieved 2026-07-07

- **Sidekiq Pro/Enterprise** — free OSS core (LGPL); Pro is $99/mo or $995/yr flat
  (unlimited usage per organization); Enterprise starts at $269/mo scaled by production
  worker-thread count, with an unlimited-usage license at $79,500/yr and a separate
  redistribution/"Appliance" license ($14,995/yr Pro, $39,995/yr Enterprise) for vendors who want
  to embed Sidekiq inside a product sold to their own customers. Source ships to paying customers
  under a restrictive commercial EULA (no reverse engineering, no redistribution outside the
  license terms, cannot be used to build a competing product). Sidekiq runs its own public "Build
  vs Buy" page, explicitly reasoning "a senior developer is typically $10,000/mo or more... how
  many days or weeks will it take your team to piece together similar functionality?" — the same
  rhetorical frame a future Caisson comparison page would use.
  EVIDENCE: https://sidekiq.org/ — tier table, Pro $99/mo|$995/yr, Enterprise from $269/mo, unlimited $79,500/yr, retrieved 2026-07-07 | https://github.com/sidekiq/sidekiq/blob/main/COMM-LICENSE.txt — commercial EULA restrictions (§1, §3), retrieved 2026-07-07 | https://github.com/sidekiq/sidekiq/wiki/Build-vs-Buy — "Build vs Buy" framing, $10k/mo senior-dev comparison, retrieved 2026-07-07 | https://sidekiq.org/wiki/Commercial-FAQ — Appliance/redistribution license pricing, retrieved 2026-07-07

- **Metabase Enterprise Edition** — free OSS core; Pro is $575/mo (or $517.50/mo annual) +
  $12/user/month (first 10 users included); Enterprise is custom, explicitly stated to
  **"start at $20,000/year."** Source-available (self-hostable) but priced and delivered as a
  recurring per-seat SaaS subscription, not a one-time purchase — a structurally different model
  from Caisson's. No compliance-specific functionality (it's BI/analytics with row/column-level
  permissions, not audit/WORM/crypto tooling).
  EVIDENCE: https://www.metabase.com/pricing/ — Pro $575/mo+$12/user, Enterprise "starts at $20,000/year", retrieved 2026-07-07

- **PowerSync** (local-first sync engine) — Free tier ($0, capped: 2GB synced/mo, 500MB hosted,
  50 concurrent connections); Pro from $49/mo (30GB synced, usage-based beyond); Team from
  $599/mo (adds SOC 2 report & HIPAA-compliance availability, uptime SLA, custom alerting);
  Enterprise custom. Fully hosted, usage-metered SaaS — not source-you-own. Solves real-time sync,
  not compliance.
  EVIDENCE: https://powersync.com/pricing — Free/$49/$599/Enterprise tiers, retrieved 2026-07-07

- **ElectricSQL / Electric Cloud** — the core sync engine is Apache-2.0, fully open source,
  self-hostable, 9,500+ GitHub stars, still actively developed (last push 2026-07-04). The
  _hosted_ Electric Cloud is usage-metered: PAYG is $0 (bills under $5/mo waived — $1/1M writes +
  $0.10/GB-month retention), Pro is $249/mo (10% usage discount, prepaid-credit model), Scale is
  $1,999/mo (20% discount, 6-month commitment). Reads/egress/fan-out are always free — cost scales
  with writes, not users. Genuinely open-core (unlike Caisson's commercial-bundle model), but the
  managed-hosting business is classic metered SaaS, not a one-time purchase. Solves sync, not
  compliance.
  EVIDENCE: https://electric.ax/pricing — full tier table + worked examples, retrieved 2026-07-07 | https://github.com/electric-sql/electric — Apache-2.0, 10,254 stars, retrieved 2026-07-07

### 5. Platform-native paths (net-new research)

- **AWS Audit Manager is being sunset for new customers.** As of AWS's own documentation
  (undated but current as of this fetch): _"AWS Audit Manager will no longer be open to new
  customers starting on 4/30/2026."_ Existing customers keep access; the service is moving to
  maintenance mode (no new frameworks, no new region support). AWS's official migration guidance
  directs customers to AWS Config Conformance Packs instead — but explicitly flags that Config
  has **no conformance-pack equivalent for SOC 2 or GDPR**, and its own FAQ states plainly:
  _"Customers seeking a solution for monitoring the compliance of AWS resources... are encouraged
  instead to consider partner solutions, such as those from Vanta and Drata."_ Pricing while it
  still operates: pay-per-resource-assessment at $1.25 per 1,000 assessments; AWS's own worked
  examples run $586-$5,812/month depending on account/resource count.
  EVIDENCE: https://docs.aws.amazon.com/audit-manager/latest/userguide/audit-manager-availability-change.html — sunset date, Conformance Pack gap table (no SOC2/GDPR equivalent), "consider partner solutions, such as those from Vanta and Drata" quote, retrieved 2026-07-07 | https://aws.amazon.com/audit-manager/pricing/ — $1.25/1,000 resource assessments + worked cost examples, retrieved 2026-07-07

- **Both AWS Audit Manager and AWS Config audit YOUR OWN cloud resource configuration** (EC2
  settings, S3 encryption policies, IAM changes) — they are not toolkits for shipping compliance
  controls (audit logs, field encryption, tenant isolation) inside a product you build and sell to
  your own customers. That's a different job than Caisson's, not a worse version of the same job.

- **Microsoft Purview Compliance Manager** is bundled into Microsoft 365 E5 ($60/user/month,
  annual) or available as the standalone Purview Suite add-on on top of an existing E3 license
  ($12/user/month). It provides a "compliance score" and 320+ regulatory assessment templates
  covering an organization's Microsoft 365 / multicloud usage posture (DLP policies, conditional
  access, insider risk, eDiscovery) — licensed per employee seat, for an IT/security team auditing
  their own org's tooling, not for a developer embedding compliance controls into a product.
  Categorically the wrong buyer and the wrong job for a Caisson comparison.
  EVIDENCE: https://www.microsoft.com/en-us/security/business/risk-management/microsoft-purview-compliance-manager — $12/user/mo Purview Suite pricing, retrieved 2026-07-07 | https://www.microsoft.com/en-us/security/microsoft-purview-pricing — $60/user/mo M365 E5, retrieved 2026-07-07 | https://learn.microsoft.com/en-us/purview/compliance-manager — "compliance score" / 320+ templates / per-seat licensing description, retrieved 2026-07-07

- **Azure Policy** itself is free for native Azure resources; Azure Arc-connected (hybrid/
  on-prem) machine configuration audits cost $6/server/month. Same category-mismatch as above —
  governs your own cloud/hybrid resource configuration, not a product-embeddable compliance SDK.
  EVIDENCE: https://azure.microsoft.com/en-us/pricing/details/azure-policy — free native, $6/server/mo Arc, retrieved 2026-07-07

---

## Safe to claim vs. NOT safe to claim

### Safe to claim (verified, cite the source)

- A single-developer Postgres RLS multi-tenancy implementation alone costs roughly 40
  engineering hours before a single compliance feature is written (Appycodes 2026 study) — and
  that's the RLS slice only, not WORM/crypto/OSCAL.
- AWS Audit Manager is closing to new customers (4/30/2026) and AWS's own documentation
  concedes its native Config-based replacement has no SOC 2 or GDPR equivalent, pointing
  customers to Vanta/Drata instead — evidence that even AWS's ecosystem treats "audit your own
  cloud config" and "run a compliance program" as separate problems.
- Vanta/Drata/Secureframe cost $35,000-$80,000 in year one for a startup (subscription + audit +
  pentest) — two orders of magnitude above Caisson's Compliance bundle — but they solve a
  different problem (continuous monitoring + a human audit relationship, not source code you
  embed in your product). State the price gap AND the category difference together, never the
  price gap alone.
- create-t3-app is free (MIT) and, by the maintainers' own description, ships zero
  compliance/multi-tenancy/billing/admin features — "bring your own" for all of them.
- Tailwind Catalyst ($149 one-time) and Sidekiq Pro ($99/mo) are the closest commercial-source
  precedents to Caisson's model (buy-once-own-the-code, or pay-for-a-license-key-to-a-private-
  gem-server) — and Sidekiq runs its own public build-vs-buy argument comparing itself to a
  $10k/month senior developer. Neither ships compliance-specific functionality.
- Metabase's Enterprise tier ("starts at $20,000/year") is source-available but priced and
  delivered as a recurring per-seat SaaS subscription — a structurally different commercial model
  than Caisson's one-time purchase.
- **Scoped, not global:** "We haven't found another TypeScript/Next-oriented, source-delivered,
  one-time-purchase toolkit that bundles WORM-style immutability + field-level crypto + OSCAL
  mapping in one package" — this survived a PAL sanity check against the wider 5-category set and
  still holds, _scoped this way_. See the note below on why the unscoped version is not safe.

### NOT safe to claim

- **Any absolute, unscoped version of the uniqueness claim** ("no one ships WORM+crypto+OSCAL,
  period"). Storage-layer WORM (S3 Object Lock and equivalents), envelope-encryption/KMS client
  libraries, and open-source OSCAL tooling/consulting all exist outside the TS-boilerplate and
  source-available-library markets surveyed here — a critic citing any of those would be
  correct. Always scope the claim to "TS/Next-oriented, source-delivered, one-time bundle."
- **Any specific "$X saved by buying Caisson instead of building it" figure derived from the
  $15k / 3-6-month Cookiy numbers.** Those are synthetic-persona self-reports from an interview
  study where 0 of 5 real humans ever reached a build-vs-buy question — directional only, not
  verified market data. Don't multiply it out into marketing copy without the caveat attached.
- **"Caisson is cheaper than Vanta/Drata"** as a standalone claim. They are different product
  categories (a monitored SaaS platform + human audit relationship, vs. one-time dev tooling); a
  buyer conflating them is a positioning/support problem to solve with education, not a valid
  price comparison to lead with (this matches the existing SYNTHESIS.md finding on the
  category boundary).
- **Any "better than AWS Audit Manager / Azure Purview" framing.** They solve a different job
  (auditing your OWN cloud resource configuration or employee SaaS usage) than Caisson's job
  (shipping compliance controls inside a product you sell to your own customers). A head-to-head
  "better than AWS" claim is an apples-to-oranges comparison and would read as misleading. Use
  the AWS-sunset fact as supporting/contextual evidence, never as a lead claim (see Method note).
- **Any claim that PowerSync/ElectricSQL customers should switch to Caisson's Local-first
  bundle** without first verifying the actual feature overlap — this memo did not audit that
  bundle's contents against PowerSync/Electric's sync-engine scope, and the two likely solve
  different problems (real-time sync-as-a-service vs. embedded local-first primitives).

---

## Who wins where (honesty section)

Framed by job-to-be-done, not price alone — the PAL sanity-check's strongest note was that a
single-axis price comparison across these five categories misleads, because each solves a
different job:

- **Caisson:** a dev toolkit for embedding compliance controls into a product you sell.
- **Vanta/Drata/Secureframe:** a compliance program + evidence + monitoring for the company
  operating the product.
- **AWS/Azure posture tools:** audit/config posture of the cloud environment itself.
- **TS/Next boilerplates:** app scaffolding to ship faster, not a control framework.
- **Narrow source-available libs (Catalyst/Sidekiq/Metabase/PowerSync/Electric):**
  best-in-class components, not compliance systems.

Within that framing, here's where each genuinely wins:

1. **Build-it-yourself wins** for teams with real 3-6 month runway who want full architectural
   ownership and zero vendor dependency — a legitimate choice, not a strawman. The Appycodes
   40-hour RLS figure alone confirms this is real engineering time, not nothing; the fuller-stack
   time cost is plausible-but-unverified (Cookiy synthetic proxy).

2. **create-t3-app wins on price and on "zero extra surface area"** — the right call for a team
   that wants no opinions imposed and is comfortable assembling every control itself. It does not
   "win on flexibility" in the sense of being more capable than Caisson; it wins for teams that
   value assembling their own architecture over inheriting one.

3. **Compliance SaaS (Vanta/Drata/Secureframe) wins** for any team that needs an actual
   continuous-monitoring platform and a human audit relationship — a company pursuing a real
   SOC 2 Type II audit needs the evidence-collection and auditor-facing workflow Caisson doesn't
   provide and isn't trying to provide. This is the single clearest "wrong tool" risk for a
   confused buyer, and the existing SYNTHESIS.md D1 discovery-channel finding already flags it.

4. **TS/Next boilerplates win on ecosystem size and seat-based team licensing** — ShipFast
   (8,300+ customers), Supastarter (1,400+ developers), and comparable social proof Caisson
   doesn't have pre-launch; and Makerkit/Supastarter explicitly sell 5-10-developer seats at
   $599-$1,499 where Caisson's $629-$739 bundles are single-seat. This is a real structural
   tradeoff (Caisson is source-delivered and bundle-priced, deliberately avoiding a per-seat tax)
   rather than a simple gap — but it is a legitimate reason a team evaluating both would pick the
   boilerplate, and it's the same tension already flagged as D2 in SYNTHESIS.md.

5. **Source-available narrow libraries (Tailwind Catalyst, Sidekiq) win on field-proven
   depth in their scope** — Sidekiq has 13,500+ GitHub stars, "several thousand" paying
   customers, and years of production hardening at extreme scale (one customer cited at 250,000
   jobs/sec). Caisson's modules are newer and don't yet have that multi-year track record; the
   honest tradeoff is narrow-and-battle-tested vs. integrated-and-newer.

6. **Metabase EE / PowerSync / ElectricSQL aren't really a "who wins" comparison** — the job is
   different (BI/analytics, real-time sync) rather than a competing solution to the same problem.
   Drawing the comparison at all risks looking like padding a comparison page with unrelated
   products.

7. **AWS/Azure platform-native tools win only for teams that need to audit their OWN cloud
   configuration or employee SaaS usage** — genuinely useful for that narrower job, and Azure
   Policy/Config can supply low-level primitives (KMS, immutable storage, config baselines) that
   a team might build on. But neither gives a product-embedded control framework, which is
   Caisson's actual job — a distinction AWS's own documentation implicitly concedes by directing
   customers who need full SOC 2/GDPR coverage to Vanta/Drata rather than its own tooling.

### Method note (PAL sanity check)

This "who wins where" section was checked via `mcp__pal__chat` (gpt-5.2) before finalizing. Two
corrections came out of that pass and are already applied above: (1) the AWS-sunset finding was
originally drafted as a headline differentiator — the check flagged it as supporting/contextual
evidence only (it doesn't validate "buy Caisson," only "cloud-native ≠ compliance program"), so
it's now presented that way throughout this doc; (2) the uniqueness claim ("no competitor ships
WORM+field-crypto+OSCAL") was originally unscoped — the check flagged that storage-level WORM,
KMS/envelope-encryption libraries, and open-source OSCAL tooling exist outside the categories
surveyed, so every instance of the claim above is now explicitly scoped to "TS/Next-oriented,
source-delivered, one-time bundle."

---

## Gaps

- No verification was done on which specific Caisson modules ship in the Local-first bundle
  against PowerSync/ElectricSQL's actual feature set — flagged above as unsafe to claim
  substitution without that audit.
- The Cookiy build-cost proxies ($15k / 3-6 months) remain unverified against a single real
  buyer, per the existing companion doc's own finding — this memo did not attempt new primary
  research to close that gap (out of scope for a web-research sweep).
- Compliance-specific competitors in the "GRC-lite" boilerplate space (Clynova $999-1,999,
  compliance.tf, Delve) were already covered in wave1-research-legs.md's "positioning" leg and
  are not re-verified here — see that doc for citations.
- This memo did not probe Linear liveness or file draft tickets — the task scope was research
  memo only, per the dispatch instructions; no actionable threats/opportunities requiring a
  ticket were identified (this is foundational comparison research, not a competitor-movement
  watch cycle).
