# Caisson Market Intelligence — 2026-07-09

> **Cadence.** Monthly competitive/category watch (`gw-market-intel`). Window: roughly the
> last 60-90 days (first-ever run — no prior monthly briefing exists in `outputs/research/`,
> so this establishes baseline pricing/positioning for every named watch-item, not just
> "what moved"). Sources: `mcp__exa__web_search_advanced_exa` (date-filtered) + `mcp__crawl4ai__md`
> (live vendor pages) + one `mcp__web_fetch_exa` fallback (crawl4ai 500'd on supastarter.dev).
> Sanity-checked against `mcp__pal__thinkdeep` (openai/gpt-5.2 via OpenRouter) before ranking —
> the model's re-ordering is adopted below (see Rule-4 note in Ranked findings).
>
> **Linear liveness:** checked proactively before fan-out (`mcp__linear__list_teams` → team
> `Caisson` / `CAISSON` live). All draft tickets below were filed, not held.

## Watch-list status (every named item, incl. "no movement")

| Item                                                                                 | Status                                                                                                                                                                                                                                                                                                                                                                                                                                 | Evidence                                                                                          |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| ShipFast                                                                             | **No material movement.** Pricing unchanged in structure: Starter $199 (list $299), All-in $249 (list $349), +CodeFast bundle $299 (list $648) — same three-tier promo-discount pattern as prior baseline. Still one-time only, no AI/compliance feature added.                                                                                                                                                                        | shipfa.st, crawled 2026-07-09                                                                     |
| MakerKit                                                                             | **Movement — messaging, not price.** Price stable ($349/$649 lifetime across Supabase/Drizzle/Prisma stacks). New headline banner: "Built for Claude Code, Cursor, Codex & Gemini — MCP server included" — MCP server + agent rules promoted to the #1 marketing hook.                                                                                                                                                                 | makerkit.dev/pricing, crawled 2026-07-09                                                          |
| Supastarter                                                                          | **Could not verify directly.** `crawl4ai` 500'd on supastarter.dev/pricing; `web_fetch_exa` fallback returned `CRAWL_NOT_FOUND`. No dated third-party source found in-window either. Flagged as a Gap below, not a "no movement" — re-check next cycle.                                                                                                                                                                                | crawl4ai error 500 (correlation `4315b68d94b1`); web_fetch_exa `CRAWL_NOT_FOUND`, both 2026-07-09 |
| SaaS Pegasus                                                                         | **Movement — price + scope.** Unlimited tier on sale $999→$499 (site banner: "50% off — a $500 savings"); Professional $449. New "Built for the AI Era" section: pre-built AI chat/agent examples for any LLM provider, MCP servers + skill files for Claude/Cursor. Encroaches on AI-Production-Kit territory (Django stack, not TS).                                                                                                 | saaspegasus.com/pricing, crawled 2026-07-09                                                       |
| create-t3 ecosystem                                                                  | **No material movement.** create-t3-app remains the free/OSS baseline reference (T3 stack articles through June 2026 confirm it's "no longer the default" but still the trust anchor); create-t3-turbo extends it into a Turborepo monorepo — no new commercial fork found.                                                                                                                                                            | starterpick.com T3-stack guides (Apr-Jun 2026); deepwiki.com/t3-oss/create-t3-app                 |
| Nextless.js                                                                          | **No material movement vs its own history**, but confirmed at $699 (single project) — materially above the sub-$350 ShipFast/MakerKit tier; positions as a premium AWS-serverless niche play.                                                                                                                                                                                                                                          | nextlessjs.com, boilerplatevault.com, crawled/indexed 2026-06-16                                  |
| "BoilerplateHub" entrants                                                            | **Exists as an aggregator, not a competitor.** boilerplatehub.com catalogs 43 boilerplates (supastarter listed first) — useful as a standing scan surface for future cycles, not itself a threat.                                                                                                                                                                                                                                      | boilerplatehub.com, indexed 2026-07                                                               |
| Vanta / Drata / Secureframe down-market moves                                        | **Directional signal, no self-serve dev tier shipped yet.** Vanta published a "First 90 days leading Developer Experience" post (self-service infra, CI/CD framing) and was named a Forrester GRC Leader Q2 2026 — investment in DX is real, but list pricing across all three stayed enterprise-quote-only ($7.5K-$100K+/yr per 6 independent comparison sites, Apr-Jul 2026). No cheap/self-serve API-first tier found.              | vanta.com blog 2026-03-02; 6 pricing-comparison sites Apr-Jul 2026                                |
| OSCAL tooling                                                                        | **Movement — validates the wedge.** RegScale's OSCAL Hub (free, OSS, donated toward the OSCAL Foundation) got a 2026 Gartner Market Guide mention; separately, Evidentia (new, see Ranked #4) is a from-scratch OSCAL-native library. OSCAL is visibly going mainstream in dev-facing compliance tooling — consistent with Caisson's own `oscal-conformance` CI gate already existing.                                                 | regscale.com/blog 2026-06-05; github.com/Polycentric-Labs/evidentia                               |
| "Compliance-ready starter" positioning appearing elsewhere                           | **Movement — direct hit.** AuditKit.dev (see Ranked #2) is explicitly a drop-in "SOC 2 prep" + audit-log SDK marketed against Vanta/Drata pricing. This is the closest thing found to a name-a-competitor-shaped threat on the compliance wedge.                                                                                                                                                                                       | auditkit.dev, crawled 2026-07-09                                                                  |
| LangChain / LlamaIndex commercial moves                                              | **Movement — normal maturation, low direct relevance.** LlamaIndex shipped an "Enterprise" tier (dedicated support/SLAs) 2026-04-27; LangChain itself stayed $0 OSS + LangSmith Enterprise, no structural change. Different buyer (RAG-framework users, not owned-codebase buyers) — confirms Caisson's "integrate, don't rebuild" stance for `ai-kit` remains correct.                                                                | ailog.fr 2026-04-27; techjacksolutions.com 2026-05-28                                             |
| Eval/guardrails vendors (Braintrust, Langfuse, Humanloop)                            | **Movement — feature expansion, no pricing-model shift.** Braintrust shipped "Topics" (auto pattern-clustering of production traces) GA 2026-06-01; Langfuse/Arize/Phoenix all still active in the same comparison roundups. Category is maturing around observability, not compliance — no threat to Caisson's narrower eval-harness/CI-gate scope.                                                                                   | braintrust.dev/blog 2026-06-01; web3aiblog.com 2026-06-04                                         |
| Agent-framework commercialization (agent-kernel/runner primitives)                   | **Movement — forming, not won.** Microsoft shipped an open-source "Agent Governance Toolkit" (see Ranked #5); several sub-10-star TypeScript/Python "governed agent runtime" repos surfaced (runxhq/runx, vilano-ai/runtime, StacyOS/stacyvm) — real activity, zero market leader yet.                                                                                                                                                 | opensource.microsoft.com/blog 2026-04-02; GitHub repos, indexed Mar-May 2026                      |
| HN/PH launches: "production-ready starter" / "compliance starter" / "AI starter kit" | **No compliance-starter launch found.** Two small "AI-native boilerplate" entrants surfaced (VibeReady $149, launched ~2026-07-05; Vibestrap, PeerPush 2026-06-03, 3 upvotes) — low-traction, confirms "AI-native" framing is now bottom-of-market/commoditized. One adjacent HN launch: Manufact (YC S25) "MCP Cloud", 2026-07-02 — MCP-hosting infra, not a starter kit.                                                             | vibeready.sh; peerpush.com/p/vibestrap; news.ycombinator.com/item?id=48762862                     |
| Pricing-model shifts (one-time vs subscription) in dev tooling                       | **Movement — high volatility, confirms nothing structural.** SaaS Price Pulse: "80% of 271 tracked SaaS tools changed pricing in Q1 2026, 298 plans quietly killed." Boilerplate-specific commentary (dodopayments.com, StarterPick) still frames one-time-fee as the norm with the known "revenue dry spell" tradeoff — no vendor in-window flipped a boilerplate from one-time to subscription or vice versa.                        | saaspricepulse.com/reports/saas-pricing-q1-2026, 2026-04-06; dodopayments.com 2026-03-26          |
| Six-bundle one-time model — threatened or validated?                                 | **Both — see Ranked #1 and #2.** The Delve scandal validates "buyer owns verifiable code" over "trust our automation"; AuditKit's $99-999/mo SDK is a live subscription alternative to owning the compliance package outright. Net read: the one-time-ownership frame is _more_ defensible after Delve, but AuditKit proves a cheaper subscription wedge can still take price-sensitive buyers who don't need the full owned codebase. | synthesis of the two findings below                                                               |

## Ranked findings

Ranked by threat/opportunity weight (proximity to the wedge × recency × source credibility),
for a solo pre-launch founder's actionability. **PAL sanity check (rule 4):** my draft order
(AuditKit > Delve > Evidentia > MCP-parity > Microsoft) was re-ordered by `pal thinkdeep`
(openai/gpt-5.2) to **Delve > AuditKit > MCP-parity > Evidentia > Microsoft** — the model's
reasoning: the Delve scandal is a zero-cost, immediately operationalizable GTM multiplier
that reshapes buyer evaluation criteria this quarter, while Evidentia (5 GitHub stars, zero
commercial motion) is a watch item, not a top-3 driver, once weighed against a category-wide
messaging erosion (MCP parity). Adopted below.

### 1. The Delve scandal — opportunity, high confidence

YC-backed compliance-automation startup **Delve** ($32M raised) was accused (anonymous
Substack, corroborated) of AI-fabricating **494 SOC2 reports** for 400+ customers; at least
one named customer (Lovable) publicly confirmed exposure. Still cited as the industry's
cautionary tale in a June 28 vendor-comparison roundup — this is not a one-week news cycle,
it's became the reference point for "can you trust AI-generated compliance evidence."

**Why it matters:** this is the single cleanest piece of external validation for Caisson's
exact positioning contrast — a buyer-owned, cryptographically hash-chained, independently
verifiable audit trail vs. "trust our AI." Directly usable in comparison-page and landing
copy without any product work.

**Evidence:** TechCrunch 2026-03-22 ("Delve accused of misleading customers with 'fake
compliance'") · Economic Times (same week) · licens.io 2026-04-03 ("Delve and the 494 Fake
SOC 2 Reports") · compliancehub.wiki 2026-03-20/21 (Delve's own response + Lovable
confirmation) · still referenced futurepicker.com 2026-06-28.

### 2. AuditKit.dev — threat, high confidence

Live, primary-sourced (crawled 2026-07-09). Open-source (AGPLv3) + managed-cloud SDK shipping
almost the same technical primitives as `@caisson/audit-worm`: SHA-256 hash-chained,
Merkle-tree-proof tamper-evident audit logs, tenant-scoped embeddable viewer, SOC2 evidence
packs (51 controls, 15 policy templates, evidence vault, access-review campaigns, vendor
tracking, risk register). Tagline: **"80% Cheaper vs Vanta/Drata."** Pricing: $99/mo Starter
→ $999/mo top tier — pure subscription, no codebase ownership. A "**NEW**: SOC 2 Audit Prep"
banner suggests this scope (access reviews, vendor tracking, auditor-collaboration portal)
was added recently, on top of an already-shipped audit-log SDK.

**Why it matters:** this is the closest thing to a named, live, paying competitor on
Caisson's hero wedge found this cycle. It doesn't compete on code ownership, but it competes
hard on "get 80% of the compliance-evidence value for $99-499/mo, no 3-6 month integration."

**Evidence:** auditkit.dev (pricing + feature pages), crawled 2026-07-09; github.com/AuditKitDev/auditkit.

### 3. MCP-server parity across the paid-boilerplate category — threat, high confidence

Both **MakerKit** (makerkit.dev/pricing) and **SaaS Pegasus** (saaspegasus.com/pricing) now
ship an MCP server + AI-agent rule files as a **headline** feature for Claude Code / Cursor /
Codex / Gemini — not a footnote. This is the same "agent-native delivery: a shipped
buyer-facing MCP server with auth" language Caisson's own locked spec
(`specs/00-product-spec.md` differentiator #3) uses to describe itself.

**Why it matters:** differentiator #3 is now **category table stakes**, not a Caisson-only
edge. PAL's recommended reframe: stop selling "we have an MCP server" and start selling what
sits _behind_ it — a compliance-grade, auth'd, least-privilege MCP surface wired into a
fail-closed RLS + audit-chain base, which a generic boilerplate's MCP server doesn't carry.

**Evidence:** makerkit.dev/pricing + saaspegasus.com/pricing, both crawled 2026-07-09.

### 4. Evidentia (Polycentric-Labs) — watch item, medium confidence

Apache-2.0 Python "compliance-as-code" library: OSCAL-native, 95 bundled framework catalogs
(NIST 800-53, FedRAMP, CMMC, ISO 27001, EU AI Act, DORA, GDPR, 15 US state privacy laws), 13
MCP tools that drive Claude/Cursor/Copilot through compliance workflows deterministically with
signed output envelopes, cryptographic evidence chain (Sigstore + SLSA Provenance v1). Rhetoric
is a near-mirror of Caisson's own pitch: _"GRC tooling has been waiting for its Terraform
moment... Vanta and Drata are the AWS Consoles of compliance."_ Extremely active engineering
(v0.10.17 shipped the day of this briefing; 813 commits; 4,000+ tests) but **5 GitHub stars, 1
fork** — no evident commercial motion yet.

**Why it matters (but not more than that):** a positioning mirror is worth watching because it
could contaminate messaging uniqueness if it gains distribution, and its MCP-native compliance
tooling is a leading indicator for where the category goes next. It is Python-stack (doesn't
compete for Caisson's TypeScript buyer directly) and has no market traction today — hence
ranked below the MCP-parity trend per the PAL check, not above it.

**Evidence:** github.com/Polycentric-Labs/evidentia, crawled 2026-07-09 (releases through
v0.10.17, dated same day).

### 5. Microsoft Agent Governance Toolkit — longer-horizon threat, medium confidence

Microsoft shipped a free, open-source "Agent Governance Toolkit" (runtime security for AI
agents), 2026-04-02. Several other very-early (2-3 GitHub stars) TypeScript/Rust "governed
agent runtime" repos surfaced in the same search (runxhq/runx, vilano-ai/runtime,
StacyOS/stacyvm) plus a funded agent-security entrant (Ona's "Veto", 2026-03-03) — the
governed-agent-kernel space is visibly forming, contested by several small players and now
one very well-resourced one.

**Why it matters:** Caisson's own Agentic-Dev bundle ($329, the narrowest/least-differentiated
of the six) targets this exact space. Not urgent — nobody has won it yet — but worth a
differentiation check before Agentic-Dev gets marketing investment, since "free from
Microsoft" is a hard floor to price against.

**Evidence:** opensource.microsoft.com/blog 2026-04-02; ona.com/stories (Veto) 2026-03-03;
GitHub repos indexed Mar-May 2026.

### 6. SaaS Pegasus's 50%-off sale + "Built for the AI Era" section — minor threat, high confidence

Covered in the watch-list table above; ranked below the top 5 because it's a Django-stack
competitor (different buyer pool) and the AI-era section, while real, offers only example
patterns (chat UI, streaming, agentic workflows for any LLM provider) rather than the
production-rigor primitives (spend-cap circuit breakers, PG-atomic metering, prompt registry)
Caisson's `ai-kit` ships. Worth noting because "AI Production Kit"-shaped positioning is
spreading into adjacent stacks, which is early evidence the wedge is real demand, not just a
Caisson thesis.

### 7. EU AI Act Article 50 enforcement — Aug 2, 2026 (24 days from this briefing) — opportunity, high confidence

Confirmed **not extended** by the Digital Omnibus amendment (multiple independent sources,
including a 2026-07-07 "Conformity Engineering Playbook" and a 2026-06-24 compliance-checklist
site, both citing the same date). At least one narrow point-solution
(europeancompliancesuite.com "AI Chatbot and Agent Disclosure Compliance Suite," Article
50(1)-specific) has already launched to serve exactly this deadline.

**Why it matters:** a hard, external, unmoved legal deadline 24 days out is a concrete
launch-timing hook for Caisson's EU AI Act gated add-on module — and evidence that
narrow point-solutions are already racing to serve the same deadline, so the window to use it
as a marketing hook is closing, not opening.

**Evidence:** conformityengineering.com/playbook 2026-07-07; launchreadycode.com 2026-06-24;
europeancompliancesuite.com, indexed 2026-07-03.

### 8. General SaaS pricing volatility — background, high confidence, no direct action

SaaS Price Pulse: 80% of 271 tracked SaaS tools changed pricing in Q1 2026 alone, 298 plans
quietly killed. Context only — no boilerplate/compliance-adjacent vendor in-window flipped
commerce model (one-time ↔ subscription); the market-wide volatility doesn't touch Caisson's
six-bundle structure directly. (saaspricepulse.com/reports/saas-pricing-q1-2026, 2026-04-06.)

## Gaps

- **Supastarter pricing could not be verified this cycle** — `crawl4ai` 500'd
  (correlation `4315b68d94b1`) and the `web_fetch_exa` fallback returned `CRAWL_NOT_FOUND`.
  Per the doctrine fallback chain (crawl4ai → web_fetch_exa) both legs were attempted and both
  failed; no third-party dated source filled the gap in-window. Re-check next cycle,
  first action.
- **No investor-grade keyword-volume data** was pulled this cycle (out of scope for a market
  watch — that's the prior `market-competitive-analysis.md`'s own flagged gap, still open).
- **Linear was live** at the proactive check (rule 7) — no "Pending Linear" fallback needed;
  all 5 draft tickets below were filed directly.
- This is the **first** monthly market-intel briefing for Caisson — several "no movement"
  rows above are really "first baseline reading," not confirmed stability across time. Next
  month's run should diff against this file's watch-list table directly.

## Operator decides

Every finding above is a ranked observation, not a decision. Two items carry real near-term
leverage the operator may want to act on personally before the next cycle: (1) the Delve
scandal is ready to use in copy today — no research gap blocks it; (2) the EU AI Act Aug 2
deadline is a closing, not opening, timing window. Everything else (AuditKit competitive
response, MCP-parity messaging reframe, Agentic-Dev differentiation, Evidentia watch) is
queued below as draft tickets — pricing responses route to `gw-pricing-analyst`, citation/SEO
fixes to `gw-aeo-strategist`, and any positioning lock still goes through
`docs/state/decisions-and-forks.md`, never this briefing.

## Draft Linear tickets (filed — Linear was live)

All five filed to team **Caisson** (`CAISSON`) 2026-07-09, each linking this briefing's sources.

1. **[CAISSON-75](https://linear.app/gridworkdev/issue/CAISSON-75) — GTM: use the Delve SOC2-fabrication scandal in comparison/landing copy**
   (project: Site & Buyer Dashboard, priority Medium)
   Delve (YC-backed, $32M raised) was caught AI-fabricating 494 SOC2 reports (TechCrunch
   2026-03-22, still cited 2026-06-28). Draft copy contrasting Caisson's owned,
   cryptographically hash-chained/verifiable audit trail against "trust our AI" compliance
   automation — for a comparison page or the Compliance bundle's landing section. Not a
   pricing or positioning lock — copy only, routes through the normal GTM copy review.

2. **[CAISSON-76](https://linear.app/gridworkdev/issue/CAISSON-76) — Competitive check: AuditKit.dev vs `@caisson/audit-worm` + Compliance bundle**
   (project: Editions & Registry, priority High)
   auditkit.dev (crawled 2026-07-09) ships SHA-256 hash-chained + Merkle-proof audit logs +
   SOC2 evidence packs (51 controls, evidence vault, access-review campaigns, vendor tracking)
   at $99-999/mo, explicitly priced against Vanta/Drata. Compare feature-for-feature against
   `@caisson/audit-worm` + the Compliance bundle's evidence-pack generator; flag any gap
   (access-review campaigns, vendor tracking, auditor-collaboration portal) as a candidate for
   the module backlog. No pricing call — that's `gw-pricing-analyst`'s lane.

3. **[CAISSON-77](https://linear.app/gridworkdev/issue/CAISSON-77) — Reframe differentiator #3 copy: MCP server is now category table stakes**
   (project: Site & Buyer Dashboard, priority Medium)
   MakerKit and SaaS Pegasus (both crawled 2026-07-09) now headline an MCP server + AI-agent
   rules as their #1 marketing hook — the same claim `specs/00-product-spec.md` differentiator
   #3 uses. Draft a copy pass that reframes from "we have an MCP server" to what's behind it
   (compliance-grade, auth'd, least-privilege MCP wired into fail-closed RLS + the audit
   chain) — a positioning correction, not a new decision.

4. **[CAISSON-78](https://linear.app/gridworkdev/issue/CAISSON-78) — Watch: Microsoft Agent Governance Toolkit + emerging OSS agent-runtime repos**
   (project: Editions & Registry, priority Low)
   Microsoft shipped a free open-source "Agent Governance Toolkit" (2026-04-02); several
   sub-10-star governed-agent-runtime repos (runxhq/runx, vilano-ai/runtime, StacyOS/stacyvm)
   plus a funded entrant (Ona's Veto, 2026-03-03) are forming the same space Caisson's
   Agentic-Dev bundle ($329) targets. No leader yet — low urgency — but flag for a
   differentiation pass before Agentic-Dev gets marketing spend, since "free from Microsoft"
   is a hard price floor.

5. **[CAISSON-79](https://linear.app/gridworkdev/issue/CAISSON-79) — EU AI Act Art. 50 enforcement (Aug 2, 2026) — launch-timing hook, closing window**
   (project: Site & Buyer Dashboard, priority High, due 2026-08-02)
   Confirmed unmoved by the Digital Omnibus amendment (multiple sources through 2026-07-07).
   A narrow point-solution (europeancompliancesuite.com) already launched serving this exact
   deadline. Evaluate using the 24-days-out date as a marketing/launch-timing hook for the EU
   AI Act gated add-on module before the window closes — time-boxed, review before Aug 2.
