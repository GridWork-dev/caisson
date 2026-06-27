# Market Research — productized template/framework library (Phase 2)

**Date:** 2026-06-27 · **Method:** prospector-modeled multi-source assay — DataForSEO
revealed-demand (`demand-signals.md`), Exa market scan (6 angles, `market-findings.json`),
5 spine deep-dives (`deep-dives.json`), cross-referenced to the Phase-1 corpus, scored with
a **rubric-as-code** (code owns the arithmetic, `scores.json`) + an adversarial kill-gate.
Probe cost: $0.26 DataForSEO + ~1.3M agent tokens.

> Demand × competition × pricing × who-buys, ranked, then mapped back to which existing
> GridWork capabilities serve a real paying need. Broad scan — not narrowed to the portfolio.

---

## 1. Market structure — three findings that repeat across every angle

1. **Generic boilerplate is saturated and structurally weakening.** ShipFast/MakerKit/Supastarter/SaaS-Pegasus cluster at **$199–1,499 one-time, lifetime updates**; free OSS (T3 26K★, Open SaaS 14K★) eats the floor; **Tailwind Plus revenue fell ~80%** and AI codegen is collapsing the value of generic scaffolding. Entering here generically = competing on brand against Marc Lou. **Don't.**

2. **The white space is VERTICAL + compliance + AI-native-infrastructure** — named, unprompted, in three separate angles:
   - _"Full-stack compliance starter kit (Postgres RLS + append-only SHA-256 audit chain + S3 Object-Lock WORM) — no turnkey repo wires all three at the app tier."_ → **this is literally Wardfile.**
   - _"No 'ShipFast for local-first AI' — every AI boilerplate defaults to cloud APIs."_ → **this is literally tessera.**
   - _"AI-infra done right (token metering with PG atomics, per-tenant spend caps, circuit breakers, eval harness + CI gate, prompt registry, guardrails) is DIY in every boilerplate."_ → **this is gridwork's credit quad + prospector's cost-discipline + gridwork-core's eval/hooks.**

3. **Recurring revenue has exactly two market-proven shapes — and the operator's instinct hit both:**
   - **Compliance-framework-update subscriptions** ($1–6K/yr: compliance.tf $1K/yr, Archiet $1.2–16.8K/yr, SchemaPilot $588–5,988/yr). Frameworks churn constantly (NIS2, **EU AI Act Annex IV — deadline passed Aug 2 2026**, DORA, new US state privacy laws) → auto-updating control mappings + evidence-pack generation is _the #1 retention lever in the entire market_.
   - **AI-usage credits** (StackAlchemist $299–999/generation, v0/Copilot/Lovable credit economies; Copilot's June-2026 25× billing shock → demand for usage-capped predictable billing). Plus the credit economy the buyer _ships to their own customers_ (token metering).

**Demand hard-data (DataForSEO CPC = willingness-to-pay proxy):** compliance keywords carry **10–50× the CPC** of every other cluster at **low keyword-difficulty** (compliance-automation $212/KD10, legal-billing $261, soc2 $171, legal-doc-automation $152, hipaa $70/KD16) — high-budget B2B buyers, underserved SEO, and the SERP is owned by _finished platforms (Vanta, Drata, Sprinto)_, **not developer starter-kits**. Picks-and-shovels gap.

---

## 2. Ranked opportunities (rubric-as-code)

Weights: market_demand .20 · baseline_strength .18 · defensibility .18 · willingness_to_pay .16 · recurring_revenue_fit .12 · build_effort_inverse .10 · distribution .06.

| #   | Opportunity                                  |    Score | Tier      | Seeds (harvestable)                   |
| --- | -------------------------------------------- | -------: | --------- | ------------------------------------- |
| 1   | **Compliance-grade regulated-app framework** | **8.28** | BUILD     | Wardfile (+il-dbui)                   |
| 2   | **AI-feature-add production-infra layer**    | **7.06** | BUILD     | gridwork + prospector + gridwork-core |
| 3   | **Local-first / on-device AI app kit**       | **6.70** | REVIEW+   | tessera (+ health-service)            |
| 4   | **Claude-Code-native agentic dev framework** | **6.68** | REVIEW+   | gridwork-core                         |
| 5   | **Multi-tenant SaaS base substrate**         | **5.76** | SUBSTRATE | gridwork + gridworkdigital            |
| 6   | Generic SaaS boilerplate (reference)         |     4.60 | KILL      | —                                     |

### ① Compliance-grade regulated-app framework — 8.28 (hero)

- **Demand:** highest-WTP cluster by 10–50×; EU AI Act / DORA / state-privacy urgency; _"no turnkey full-stack compliance starter exists."_
- **Baseline:** Wardfile is **launched** (RLS + S3 WORM + append-only versioning + per-tenant KMS field-enc + config-as-code multi-jurisdiction module registry + golden-file determinism harness) and **already meters revenue** (per-locked-report billing, Live Sync add-on $69/mo). Wardfile-il-dbui converges (140+ ADRs).
- **Competitors / price anchors:** platforms Vanta/Drata/Secureframe $7.5–100K/yr (not dev-kits); **Clynova HIPAA boilerplate $999–1,999 one-time** (proof a compliance dev-kit sells at 5–10× generic); compliance.tf $1K/yr (infra only). **Nobody ships the app-tier RLS+audit-chain+WORM turnkey.**
- **Who buys:** devs/agencies building compliance SaaS, regulated-industry product teams (legal-doc, fin-ops/billing, payroll, healthcare, policy-mgmt), post-prototype/pre-Series-A startups needing SOC2/HIPAA patterns under $1K.
- **Recurring fit (9):** framework-update subscription + evidence-pack generation = the market's strongest retention lever, and Wardfile's per-locked-report meter already works.
- **🗡 Strongest objection:** "compliance is a sales-heavy B2B grind, not a self-serve template sale." **Survives** — sell the _picks-and-shovels framework_ (self-serve, dev buyer) under the platforms, not a competing platform; the $299–1,999 dev-kit tier is exactly the unserved gap (Bedrock ~$1,500 is the lonely closest).

### ② AI-feature-add production-infra layer — 7.06 (BUILD)

- **Demand:** the single most-complained gap in every 2026 AI-SaaS guide — eval harness/CI gate, cost guardrails/circuit breakers, token metering with PG atomics, prompt registry, model routing, guardrails. High-volume keywords (vector search, rag pipeline, ai agent framework).
- **Baseline:** gridwork's metering spine (graph-complexity pricing + **credit-gate-before-spend** + per-tenant USD circuit breaker + reconnect-safe SSE registry) + prospector's rubric-as-code/cost-discipline + gridwork-core's fresh-context eval + hooks.
- **Competitors:** AgentBoiler $199, ChatRAG $99, VibeReady $149–399, SaaSForge AI $59–259 — cheap, feature-shallow, **none ship the production-rigor layer.**
- **Recurring fit (8):** native credit economy (codegen credits + the token-metering the buyer ships).
- **🗡 Objection:** "crowded AI-boilerplate race to the bottom." **Survives on rigor** — this isn't another wrapper; it's the eval/guardrails/cost-discipline layer the cheap kits skip. Best sold as an _edition/add-on on the base_, not standalone bargain-bin.

### ③ Local-first / on-device AI app kit — 6.70 (open-core growth flank)

- **Demand:** _"no ShipFast for local-first AI"_ = clearest white space; edge-ai 5,400 vol, growing; regulated on-prem push (HIPAA/DORA forcing local).
- **Baseline:** tessera (AGPL, launched) — compute seam + privacy gate + sqlite-vec ANN + **offline Ed25519 license kit** + design-token floor; health-service adds the local canonical-store + zero-egress engine.
- **Competitors:** mostly free OSS (Ollama, Jan.ai, Foundry Local, RunAnywhere) → monetize via Pro/license/commercial-threshold, not the runtime.
- **Recurring fit (6):** license kit + hosted-VLM/GPU credits (tessera already meters per-caption / per-GPU-min) + model-catalog updates.
- **🗡 Objection:** "local-first buyers are cheap, OSS frameworks crowd the infra." **Partly true** → lower direct WTP; play it as the **open-core community/distribution flank** (tessera is already public AGPL) that feeds the paid base, not the revenue hero.

### ④ Claude-Code-native agentic dev framework — 6.68 (wildcard)

- gridwork-core's _"AI agent governance kernel"_ (typed config + hooks dispatcher + local memory + lifecycle state machine + self-improvement loop). Most novel asset; "claude code" 450K vol; the _"self-updating boilerplate that opens PRs on CVE/EOL"_ gap is a defensible subscription trigger.
- **🗡 Objection:** narrow buyer, Anthropic could absorb, hardest to decouple from the operator's box (build-effort 4). **Defer to a later edition** — it's the _governance kernel under the base framework_, more than a standalone SKU.

### ⑤ Multi-tenant SaaS base substrate — 5.76 (the shared base, not a hero)

- gridwork's org/RLS/credit-wallet/Stripe quad + gridworkdigital's fail-closed 16-FORCE-policy RLS. Commodity as a standalone, **essential as the substrate every edition ships on** + answers the _"per-module commerce"_ gap (buy auth/billing/multi-tenancy separately).

### ⑥ Generic SaaS boilerplate — 4.60 → **KILL.** Saturated, branded, collapsing pricing. Confirmed do-not-build.

---

## 3. The unifying thesis — one composable base, many vertical editions

The deep-dives prove the operator's "one base + broad variations" vision is **already latent**:
every spine repo names a reusable _base_ and a swappable _vertical skin_. The library is a
**composable base framework with pluggable spines that verticalize into premium editions.**

```
              ┌──────────────── BASE FRAMEWORK ────────────────┐
              │  Governance kernel  (gridwork-core)             │  typed config + lint-gate,
              │  Metered multi-tenant spine (gridwork)          │  RLS + credit wallet + Stripe
              │  Local hybrid memory + hooks + telemetry        │  + circuit-breaker metering
              │  Design-token floor (tessera)                   │  + AI-native config (AGENTS.md/MCP)
              └───────────────────────┬────────────────────────┘
            ┌──────────────┬──────────┼───────────────┬──────────────────┐
   ① Compliance edition  ② AI-infra edition  ③ Local-first-AI edition  (④ agentic dev kernel)
   (Wardfile: RLS+WORM+   (gridwork credits+  (tessera: compute seam+   (gridwork-core: the
    audit-chain+module     prospector rigor+   privacy gate+sqlite-vec+   governance kernel as
    registry+evidence pk)  eval/guardrails)    offline license)          its own dev edition)
```

- **Base** = metered-multi-tenant + governance kernel + AI-native config + design floor. Sold as the foundation / bundle anchor / "buy-a-module" substrate.
- **Editions** = the verticals, each a clean rebuild of the proven spine. Compliance leads (highest score + WTP), AI-infra second, local-first as open-core flank.
- **Rebuild-clean, not port** (operator directive): re-implement each spine's _strategy_ — Wardfile's fail-closed-RLS + append-only-versioning + config-as-code-modules, gridwork's credit-gate-before-spend metering, tessera's privacy-gated compute seam — from scratch in one clean codebase, harvesting principles not files. (Pro-private `media-pipeline` contributes **zero code** — patterns only.)

---

## 4. Business-model synthesis — the operator's instinct, market-validated

| Lever                                    | What                                                                                                                                                                            | Evidence                                                                                                   | Verdict                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Individual editions (one-time)**       | compliance $799–1,499 · AI-infra/local-first $349–699                                                                                                                           | dominant model; buyer wants to own code; Clynova $999–1,999 compliance anchor                              | ✅ ship                                                                     |
| **Bundle**                               | base + all editions at a discount (~$1,999–2,499)                                                                                                                               | bundles standard (ShipFast+course); agencies pay up                                                        | ✅ ship                                                                     |
| **Per-module / individual**              | buy auth/billing/RLS/audit module à la carte                                                                                                                                    | explicit market gap ("per-module commerce unserved")                                                       | ✅ ship — matches "sell in bundles or individual"                           |
| **Subscription (monthly/annual)**        | **compliance-control + framework updates**, new-edition access, private component registry, MCP server, priority support                                                        | the #1 retention lever; the answer to "one-time has no MRR" (Tailwind Plus −80%)                           | ✅ ship — anchor MRR on compliance updates                                  |
| **Credits (monthly allotment + top-up)** | (a) **codegen/scaffold credits** — generate a new vertical/module via the agent, pay per generation; (b) **the metering the buyer ships** — token/usage credits with PG atomics | StackAlchemist/v0/Copilot credit economies; gridwork+Wardfile+tessera already meter per-run/report/caption | ✅ ship — exactly the "monthly credits for a certain amount of things" idea |

**Proven credit units already in the portfolio** (no invention needed): Wardfile _per-locked-report_ / _per-eCPR_ / _per-state-module_; gridwork _per-pipeline by complexity class (1/3/8/15)_ / _per-seat_ / _credit top-up packs_; tessera _per-caption_ / _per-GPU-minute_ / _per-training-run_; gridwork-core _per-audit-scan_ / _per-verification_ / _per-research-report_. → the subscription's monthly credits debit against these.

**Recommended packaging:** one-time editions + discounted bundle (own-the-code psychology) **layered with** an optional subscription that bundles a monthly credit allotment + framework/compliance updates + private registry pulls + new editions. One-time gets you in; the compliance-update + credit subscription is the durable MRR the template market hasn't cracked.

---

## 5. Capability → paying-need cross-reference

| GridWork capability (proven)                        | Maps to paying need                   | Demand evidence                                      |
| --------------------------------------------------- | ------------------------------------- | ---------------------------------------------------- |
| Wardfile RLS+WORM+audit-chain+module-registry       | compliance dev-kit gap                | CPC 10–50×, "no turnkey starter", Clynova $999–1,999 |
| gridwork credit-wallet + circuit-breaker metering   | "AI billing/guardrails is DIY"        | every AI guide names it; Copilot billing shock       |
| prospector rubric-as-code + cost-discipline         | eval harness + cost caps gap          | "no boilerplate ships an eval CI gate"               |
| gridwork-core hooks + fresh-context eval + memory   | AI-native infra + agentic self-update | AGENTS.md/MCP trend; "self-updating boilerplate" gap |
| tessera compute-seam + sqlite-vec + offline license | "no ShipFast for local-first AI"      | edge-ai growth; on-prem regulatory push              |
| health-service zero-egress engine + canonical store | local-first regulated data platform   | HIPAA on-prem demand                                 |
| gridworkdigital fail-closed 16-FORCE-policy RLS     | the security floor boilerplates skip  | "zero boilerplates publish test/OWASP results"       |

---

## 6. Recommendation → Gate 2

- **Build the composable base framework + lead with the Compliance edition (8.28)**, AI-infra edition second (7.06), local-first as the open-core flank (6.70). Generic boilerplate killed.
- **Rebuild clean** from proven strategies (Wardfile/gridwork/tessera/gridwork-core/health-service), pro-private firewall held.
- **Monetize** = one-time editions + bundle + per-module **plus** a compliance-update + credit subscription for durable MRR.

**Open scoping questions for Phase 3 (picker):**

1. Lead edition = **Compliance** confirmed, or weight differently?
2. **Which compliance vertical first** — generic compliance-framework (broad) vs a named high-CPC niche (legal-doc-automation $152 / fin-ops-billing / SOC2-evidence / HIPAA)? Wardfile's engine is jurisdiction-agnostic; pick the wedge.
3. **Monorepo (one base + editions as packages) vs separate repos per edition?**
4. **Depth of v1:** how many editions ship in v1 (recommend: base + 1 compliance edition, scaffolded for 2 more)?
5. **Subscription/credits in v1 or v2?**
6. Naming.
