# SEO Keyword + Content-Strategy Landscape — Caisson (design session)

**Surface:** SEO + Copy. **Date:** 2026-06-27. **Method:** exa web search (live SERP, competitor
teardown, CPC/KD data), grounded against the current `apps/site` surface. Every claim cites a URL or
`file:line`. **Mandate:** keyword clusters per persona/surface → SERP intent + difficulty/opportunity

- programmatic flag; recommend IA + internal-linking + content plan; surface SEO + COPY forks.

**Locked context honored:** ADR-0040 (compliance hero, generic base = footnote never a comparison
table, anti-ICP = price-shopping boilerplate buyer refused at paid tier, launch-sequenced); ADR-0041
(name Caisson); ADR-0048 (SKU structure, no hard prices → waitlist); ADR-0045 (static Next 16 export
on Cloudflare Pages, no server routes); ADR-0047 (Plausible, cookieless, CSP names only plausible.io).

---

## 0. Headline finding — ADR-0040's "compliance CPC 10–50× at low KD" is confirmed by live data

This is the single most load-bearing input to the whole keyword strategy, so it is validated first.

| Data point                                | Value                                                                              | Source                                                                                                                |
| ----------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Cybersecurity SaaS non-brand category CPC | **$16–$22**; spikes to **$80–$200+** on vendor-comparison/procurement              | GrowthSpree Q1-2026 benchmark — https://www.growthspreeofficial.com/blogs/google-ads-cybersecurity-saas-high-cpc-2026 |
| Compliance (SOC 2 / HIPAA / PCI) CPC      | **$15–$25** mid-market, **$25–$40** federal; cost-per-SQL **$700–$1,500**          | GrowthSpree (same)                                                                                                    |
| `data protection`                         | KD 69 · **CPC $59.69**                                                             | seojuice cybersecurity dataset — https://seojuice.com/keyword-research/technology/cybersecurity/US/                   |
| `vulnerability scanning tools`            | **KD 30 · CPC $49.52** (low-KD/high-CPC quadrant)                                  | seojuice (same)                                                                                                       |
| `cybersecurity audit`                     | **KD 20 · CPC ~$30**                                                               | seojuice (same)                                                                                                       |
| `cybersecurity risk assessment`           | **KD 20 · CPC $37.15**                                                             | seojuice (same)                                                                                                       |
| `managed cybersecurity services`          | **KD 12 · CPC $63.41**                                                             | seojuice (same)                                                                                                       |
| Broad `cybersecurity`                     | 165k vol but **KD 79** — attracts "students, journalists, researchers, not buyers" | hoponline — https://hoponline.ai/blog/cybersecurity-seo-strategy-high-intent-keywords-that-convert                    |
| `cybersecurity compliance services`       | ~200 vol but **KD ~20** — "low-hanging fruit, clear intent"                        | hoponline (same)                                                                                                      |

**Compare against the other three clusters** (developer-tool keywords, not security-budget keywords):
AI-gateway / eval-CI / sqlite-vec / agent-framework terms sit in the **$0–$5 informational-CPC band**
(developer tooling, OSS-saturated, low advertiser density). The 10–50× multiplier in ADR-0040 holds:
a low-KD compliance long-tail at $30–$60 CPC is literally 10–50× a `sqlite-vec` or `ai agent framework`
query. **Weighting conclusion: compliance is the SEO budget. The other three are top-of-funnel reach,
brand surface, and audience — not the conversion engine.** Exactly the ADR-0040 edition-role split.

**The strategic SERP gap** (ADR-0040's "picks-and-shovels, not finished platforms"): every high-CPC
compliance SERP is owned by **audit-automation platforms** (Vanta/Drata/Secureframe at $500–$2k/mo —
StarterPick — https://starterpick.com/guides/how-to-add-soc2-compliance-boilerplate-2026) and
**consultancies**, _not_ by composable code you own. The dev-kit lane is genuinely under-occupied.

---

## 1. Competitor SEO teardown — who ranks, and _how_ they rank

The competitive set splits cleanly by **content model**. This determines our programmatic strategy.

### 1a. Programmatic framework/use-case page players (the model to study)

| Competitor        | URL                                                                                                                                      | Programmatic pattern                                                                                    | What we learn                                                                                                                                                                                                         |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Archiet**       | https://archiet.com/use-cases/soc2-saas-architecture · /soc2-flask-saas-architecture                                                     | `/use-cases/{framework}-{stack}-architecture` — one page per framework × stack, each maps controls→code | **The canonical play for our exact niche.** They generate "SOC2 + Flask", "SOC2 + Next.js" etc., each with TSC-mapped evidence. Directly programmatic.                                                                |
| **compliance.tf** | https://soc2.compliance.tf · github.com/compliancetf/starter-kit-saas-soc2 · /starter-kit-healthtech-hipaa · /starter-kit-fintech-pcidss | `starter-kit-{vertical}-{framework}` registry — one kit per vertical×framework                          | The infra-tier sibling. ADR-0040 already positions us as the **app-tier** answer ("fireproof construction" → "fail-closed by construction", `specs/04:68`). Per-framework + per-vertical pages are _their_ SEO spine. |
| **Boilerlykit**   | https://boilerlykit.com/saasforge-core                                                                                                   | `{pattern} for {stack}` deep-dives ("Postgres RLS multi-tenant boilerplate for Next.js + Supabase")     | Programmatic stack pages ranking for `postgres rls multi-tenant boilerplate`.                                                                                                                                         |
| **StarterPick**   | https://starterpick.com/guides/hipaa-compliant-saas-boilerplates-2026 · /how-to-add-soc2-compliance-boilerplate-2026                     | `/guides/{topic}-{year}` aggregator + how-to                                                            | Content-hub model: ranks for "HIPAA boilerplate 2026", "add SOC2 to boilerplate". Aggregator, so it ranks editorial roundups — a surface we can be _listed in_, and a model for our own guides.                       |

### 1b. Direct product competitors (audit-log + compliance kits)

| Competitor                         | URL                                                   | Positioning leads with                                                                                                                  | Note                                                                                                                                 |
| ---------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **AuditKit**                       | https://auditkit.dev · /guides/nodejs                 | "Drop-in audit logging + SOC 2 prep, open-source, not $40k/yr"; SHA-256 hash chains + Merkle proofs; 51-control catalog                 | Closest functional twin to our audit-chain guarantee. Publishes per-language guides (`/guides/nodejs`) — a programmatic SEO surface. |
| **Trailbase**                      | https://trailbase.frozo.ai                            | "Enterprise readiness kit — immutable audit logs, RBAC, compliance docs in one SDK"; "$200k deal + 40-page security questionnaire" hook | Same buyer story as our compliance hero; note the procurement-questionnaire framing.                                                 |
| **Clynova**                        | github.com/ByteWorthyLLC/clynova                      | "HIPAA-ready healthcare AI boilerplate; skip 4–6 months of compliance plumbing; own the source forever, no SaaS fee"                    | The ADR-0040 WTP proof point ($999–1,999 one-time). Confirms the "own the code, not a subscription" angle resonates.                 |
| **secure-nestjs-drizzle-template** | github.com/RamosJSouza/secure-nestjs-drizzle-template | "Production-grade NestJS for regulated industries; append-only audit logging; RLS belt-and-suspenders"                                  | GitHub-topic SEO: `soc2-compliance`, `audit-log`, `multi-tenancy` topic tags. The GitHub README _is_ the ranking page.               |

### 1c. AI-Product cluster — crowded, fragmented, OSS-saturated (low CPC, high volume of competitors)

- **Self-hosted AI gateways / spend caps:** LLM0 (github.com/llm0ai/llm0 — "self-hosted spend firewall, hard caps before the call"), Janus (github.com/Janus-admin/janus — Rust, BUSL-1.1), Routerly, mozilla-ai/gateway, llmkit, TokenLens, luner, LLM-Cost-Guardian. **Dozens of small projects** — SERP is fragmented, no dominant brand. KD is _effort-high_ (many competitors) but _authority-low_ (no Vanta-equivalent).
- **Eval-in-CI / LLM guardrails:** llmci.dev (clean positioning matrix — https://llmci.dev/), PromptCheck, promptproof, llm-evalgate, evalops, llm-quality-gate. Same fragmentation. llmci's "Need → Best fit" comparison table is a model worth copying for a comparison/glossary page.
- **Implication:** these keywords are _reach and credibility_ plays, not conversion. The AI-Kit page should target the **production-rigor angle** (eval-in-CI, spend caps, circuit breaker) that the home page already names (`apps/site/app/(marketing)/page.tsx:41`), not try to out-rank 30 OSS gateways on `ai gateway self-host`.

### 1d. Local-first cluster — content/comparison intent, sqlite-vec ecosystem

- **The keyword `sqlite-vec`** is owned by the canonical repo (github.com/asg017/sqlite-vec) + explainer pages (ai-tldr.dev/learn/.../sqlite-vec-explained, sitepoint, MVP Factory's on-device-RAG posts). Dominant _intent_ is **comparison** ("sqlite-vec vs Chroma/Pinecone") and **how-to** ("on-device RAG", "local-first RAG vector search").
- **likeone.ai/blog/local-first-ai-build-ai-systems-without-cloud-2026** and **mvpfactory.io** rank with _long-form editorial_ — the blog/guide model. This is the local-first cluster's natural surface, and it is **free-AGPL top-of-funnel** per ADR-0040 (Local-first = awareness flank, not revenue).

### 1e. Agentic-Dev cluster — "governance" angle is an emerging, less-crowded wedge

- `ai agent framework typescript` is owned by **Mastra** (mastra.ai/ai-agent-framework — "trusted by Replit, SoftBank, PayPal") and **VoltAgent** (github.com/VoltAgent/voltagent). Hard head term.
- **But the _governance_ sub-angle is fresh:** governance-sdk (github.com/lua-ai-global/governance — "none of them govern what agents actually _do_ at runtime"; maps EU AI Act / OWASP / NIST / ISO 42001), microsoft/agent-governance-toolkit, hummbl-agent ("policies decide, agents execute"), Reactive Agents, AgentBigBrain. **"Governed agents" / "agent governance typescript" is a winnable, on-brand long-tail** that also intersects the compliance umbrella (the lua SDK literally maps to EU AI Act). ADR-0040's "governed kernel, not autonomous magic" voice (`specs/04:104`) is exactly right for this SERP.

---

## 2. Keyword clusters — per persona, with SERP intent, difficulty/opportunity, programmatic flag

Legend: **Intent** = Info(rmational) / Comm(ercial) / Trans(actional). **Opp** = opportunity
(High/Med/Low) given our zero-DA new-domain start. **Prog** = programmatic-SEO candidate.

### Cluster 1 — Compliance Builder (ICP-1, the hero; this is where the CPC lives)

| Keyword                                                                    | Intent    | KD / CPC signal                                                                           | Opp                 | Prog        | Page target                            |
| -------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------- | ------------------- | ----------- | -------------------------------------- |
| `SOC 2 starter kit` / `SOC 2 compliance starter kit`                       | Comm      | low-DA-winnable long-tail; high WTP                                                       | **High**            | —           | /compliance (or /frameworks/soc2)      |
| `HIPAA SaaS boilerplate` / `HIPAA compliant boilerplate`                   | Comm      | competitive (Clynova/Supastarter/Makerkit rank)                                           | Med                 | ✔ vertical  | /frameworks/hipaa                      |
| `multi-tenant RLS` / `postgres RLS multi-tenant boilerplate`               | Info→Comm | Boilerlykit/secure-nestjs rank; dev-intent                                                | **High**            | ✔ stack     | /docs/base/tenancy-rls + /guides       |
| `fail-closed RLS`                                                          | Info      | near-zero competition (our coined frame)                                                  | **High** (own it)   | —           | /compliance + glossary                 |
| `WORM audit log` / `immutable audit log`                                   | Info→Comm | AuditKit/Trailbase rank; mod competition                                                  | Med                 | —           | /docs/compliance/audit-worm + glossary |
| `audit trail nodejs` / `audit logging node.js`                             | Info      | **content-saturated** (DEV.to, AuditKit/guides, sevensquare, trailkit, pametan/audit-log) | Med                 | ✔ language  | /guides/audit-log-nodejs               |
| `SOC 2 evidence automation` / `SOC 2 evidence pack`                        | Comm      | Archiet/Vanta-adjacent; high intent                                                       | Med                 | —           | /compliance (evidence-pack section)    |
| `SOC 2 type II controls in code` / `SOC 2 CC6.1`                           | Info      | low competition, technical                                                                | **High**            | ✔ control   | /frameworks/soc2/{control}             |
| `HIPAA §164.312 technical safeguards`                                      | Info      | low competition, technical                                                                | **High**            | ✔ control   | /frameworks/hipaa/{safeguard}          |
| `EU AI Act Annex IV` / `EU AI Act technical documentation`                 | Info      | rising (Aug-2026 enforcement); sota.io/Docker/Teleport rank                               | **High** (timing)   | ✔ framework | /frameworks/eu-ai-act                  |
| `DORA compliance` / `ICT risk register`                                    | Info      | rising, EU-fin; lowcloud ranks                                                            | Med                 | ✔ framework | /frameworks/dora                       |
| `ISO 27001` / `GDPR Article 30 record of processing`                       | Info      | huge-DA-owned head; long-tails winnable                                                   | Low(head)/Med(tail) | ✔ framework | /frameworks/{iso27001,gdpr}            |
| `SOC 2 for fintech` / `HIPAA for healthtech` / `compliance for legal SaaS` | Comm      | "3–4× better conversion than head" (Digital Aranya)                                       | **High**            | ✔ vertical  | /use-cases/{vertical}                  |
| `S3 Object Lock compliance mode`                                           | Info      | low competition, technical                                                                | **High**            | —           | /docs/compliance/audit-worm            |
| `per-tenant encryption` / `field-level encryption multi-tenant`            | Info      | low competition                                                                           | Med                 | —           | /docs/compliance/field-crypto          |

> **Long-tail doctrine (Digital Aranya — https://digitalaranya.com/seo-for-cybersecurity-compliance-topics-in-2026-soc-2-iso-27001-hipaa-pci-dss-and-more/):** ranking bare `SOC 2` is "almost impossible without huge domain authority," but `SOC 2 for fintech startups` is "quite straightforward — and converts 3–4× better." With a zero-DA new domain, **every compliance head term is off the table; the entire compliance play is long-tail framework × control × vertical.** This is what makes programmatic SEO not optional but the _core_ compliance engine.

### Cluster 2 — AI-Product Engineer (ICP-2; reach + rigor, low CPC)

| Keyword                                                 | Intent    | KD signal                                 | Opp          | Prog | Page target                    |
| ------------------------------------------------------- | --------- | ----------------------------------------- | ------------ | ---- | ------------------------------ |
| `LLM cost control` / `AI spend caps` / `token metering` | Info→Comm | crowded OSS (LLM0/llmkit/TokenLens)       | Med          | —    | /ai-kit                        |
| `AI gateway self-host` / `self-hosted LLM gateway`      | Comm      | crowded (Janus/Routerly/mozilla)          | Low          | ✔    | /ai-kit + /guides              |
| `LLM eval CI` / `eval in CI` / `block LLM regressions`  | Info      | fresh, less-crowded (llmci/promptproof)   | **Med-High** | —    | /ai-kit (eval-harness section) |
| `LLM guardrails` / `PII redaction LLM`                  | Info      | moderate                                  | Med          | —    | /ai-kit + /guides              |
| `LLM circuit breaker` / `provider failover`             | Info      | low competition, technical                | **High**     | —    | /ai-kit                        |
| `cost per customer LLM` / `per-tenant AI budget`        | Info      | low competition; intersects multi-tenancy | **High**     | —    | /ai-kit (intersect compliance) |

### Cluster 3 — Local-first (ICP-3; the free-AGPL awareness flank, info-CPC)

| Keyword                                                           | Intent | KD signal                                   | Opp | Prog         | Page target            |
| ----------------------------------------------------------------- | ------ | ------------------------------------------- | --- | ------------ | ---------------------- |
| `local-first AI`                                                  | Info   | editorial-owned (likeone/mvpfactory)        | Med | —            | /local-first + /guides |
| `on-device vector search` / `offline AI`                          | Info   | moderate                                    | Med | —            | /local-first           |
| `sqlite-vec` / `sqlite-vec vs chroma` / `vector search in sqlite` | Info   | repo + explainers own it; comparison intent | Med | ✔ comparison | /guides/sqlite-vec-*   |
| `on-device RAG` / `local RAG pipeline`                            | Info   | how-to saturated but evergreen              | Med | ✔ how-to     | /guides                |
| `privacy-first AI` / `keep AI data on device`                     | Info   | broad                                       | Low | —            | /local-first           |

### Cluster 4 — Agentic-Dev (narrowest, post-wedge; the "governance" wedge is the opening)

| Keyword                                                           | Intent    | KD signal                                  | Opp               | Prog | Page target                         |
| ----------------------------------------------------------------- | --------- | ------------------------------------------ | ----------------- | ---- | ----------------------------------- |
| `agent framework typescript`                                      | Comm      | Mastra/VoltAgent own head                  | Low               | —    | /agentic-dev                        |
| `governed agents` / `agent governance typescript`                 | Info→Comm | **fresh, on-brand, intersects compliance** | **High**          | —    | /agentic-dev                        |
| `agent policy engine` / `runtime agent guardrails`                | Info      | emerging (lua/microsoft/hummbl)            | Med               | —    | /agentic-dev                        |
| `typed agent skill rule schema` / `agent lifecycle state machine` | Info      | near-zero competition (our exact frame)    | **High** (own it) | —    | /agentic-dev + /docs/agentic-dev    |
| `audit agent actions` / `agent execution receipts`                | Info      | low competition; intersects audit-chain    | **High**          | —    | /agentic-dev (intersect compliance) |

---

## 3. Programmatic-SEO play — the central content-scale decision

Every programmatic-SEO guide converges on the same rules; the ones that bind us:

- **The four highest-value SaaS templates: comparison, integration, industry use-case, feature deep-dive** (Discovered Labs — https://discoveredlabs.com/blog/programmatic-seo-for-saas-template-strategies-for-b2b-growth; Momentum Nexus — https://www.momentumnexus.com/blog/seo-for-b2b-saas-programmatic-content-strategy).
- **Thin = penalized; ≥30–40% unique content per page is the floor** (Pristren — https://pristren.com/blog/programmatic-seo-guide-saas/; Okara — https://okara.ai/blog/programmatic-seo-for-saas). Vercel/Cloudflare/Tailwind do it right by shipping a _working artifact_ per page (a code template), not filler.
- **Orphan pages don't get indexed or cited — rule-based internal linking is mandatory** (Discovered Labs). Every programmatic page auto-links to its hub + 3 nearest siblings.
- **Ship 20–100 pilot pages, watch indexation 90 days, then scale** (GTMStack — https://gtmstack.app/blog/programmatic-seo-b2b-saas; Okara). "A bad template caught at 50 pages is a tweak; at 5,000 it's a cleanup project."

**Caisson's natural programmatic axes** (each page must carry a real artifact — a control→code map, a
policy snippet, a CI badge — which fits the "evidence over adjectives" voice exactly, `specs/04:30`):

1. **Framework pages** `/frameworks/{soc2,hipaa,pci-dss,iso27001,gdpr,eu-ai-act,dora}` — the spine. Each maps the framework's controls to the shipped guarantees (RLS/WORM/audit-chain/field-crypto), with the live evidence artifacts the `/compliance` page already renders. **Highest-value, on-brand, lowest thin-content risk** because the artifacts are real. EU AI Act + DORA ride the Aug-2026 enforcement timing wave.
2. **Control/clause sub-pages** `/frameworks/soc2/cc6-1`, `/frameworks/hipaa/164-312` — answer-first "how Caisson satisfies {control}" pages. Near-zero competition, pure technical long-tail.
3. **Vertical use-case pages** `/use-cases/{fintech,healthtech,legal,hr-tech}` — "compliance infrastructure for {vertical}." The "3–4× conversion" long-tail (Digital Aranya).
4. **Stack/integration guides** `/guides/{multi-tenant-rls-nextjs-supabase, audit-log-nodejs, on-device-rag-sqlite-vec}` — dev how-tos that rank for the cross-cluster informational terms (`audit trail nodejs`, `sqlite-vec`).

**What programmatic SEO must NOT do here (ADR-0040 firewall):** the obvious SaaS-template
`/{competitor}-alternative` and `/caisson-vs-{X}` comparison pages are the most proven pSEO pattern
(Momentum Nexus lists them first) — **but ADR-0040 bans the generic-base comparison table and the
price-shopping buyer.** This is a real, hero-adjacent fork (see Fork S-04). Recommendation leans
_against_ head-on comparison pages and _toward_ control/framework pages that win the same buyer
without the discounting race.

---

## 4. Recommended IA + internal-linking model

**Current IA** (`apps/site/app/sitemap.ts:8`): flat — `/`, `/compliance`, `/ai-kit`, `/local-first`,
`/agentic-dev`, `/pricing`, plus Fumadocs `/docs/*`. No hub layer, no framework pages, no guides.

**Recommended IA (pillar → cluster → spoke), additive, no rename of existing routes:**

```
/                              (home — umbrella, links down to all hubs)
/compliance                    PILLAR (hero edition page — exists)
  /frameworks                  HUB (new: "compliance frameworks" index)
    /frameworks/soc2           framework pillar  → control spokes /cc6-1, /cc7-2 …
    /frameworks/hipaa          framework pillar  → safeguard spokes /164-312 …
    /frameworks/pci-dss        framework pillar
    /frameworks/eu-ai-act      framework pillar  (Annex IV; gated-module tie-in)
    /frameworks/dora           framework pillar
    /frameworks/{iso27001,gdpr}
  /use-cases                   HUB (new)
    /use-cases/{fintech,healthtech,legal,hr-tech}
/ai-kit · /local-first · /agentic-dev   PILLARs (edition pages — exist)
/guides                        HUB (new: dev how-tos / the blog surface)
  /guides/audit-log-nodejs · /multi-tenant-rls-nextjs-supabase · /sqlite-vec-vs-chroma · …
/glossary                      HUB (new: "what is" / GEO-citation pages)
  /glossary/{fail-closed-rls, worm-storage, audit-chain, per-tenant-encryption, governed-agents}
/docs/*                        Fumadocs (exists — already an SEO surface for `tenancy-rls`, `audit-worm`)
/pricing                       (SKU structure, no prices — ADR-0048)
```

**Internal-linking model (hub-and-spoke + rule-based, mandatory for indexation):**

- Every **framework page** links up to `/frameworks` + `/compliance`, sideways to 3 nearest frameworks, down to its control spokes, and across to the matching `/docs/compliance/*` deep-dive and the relevant `/glossary/*` term.
- Every **control/clause spoke** links up to its framework + the specific guarantee it maps to on `/compliance`.
- Every **guide** links to its glossary terms + the edition page it supports + 3 sibling guides.
- **Breadcrumb JSON-LD** on every nested page (currently absent).
- **Home and `/compliance` must not cannibalize** — see Fork S-13 (both currently target
  "compliance-grade infrastructure for regulated SaaS"; `page.tsx:8` vs `compliance/page.tsx:8`).

---

## 5. Content plan (pillar pages · framework pages · guides/blog)

| Tier                         | Pages                                                                                             | Cadence                                    | Voice owner                                                                | Priority |
| ---------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------- | -------- |
| **Pillar**                   | The 4 edition pages (exist) + the `/frameworks`, `/use-cases`, `/guides`, `/glossary` hub indexes | Once, then maintained                      | `specs/04` voice                                                           | P0       |
| **Framework (programmatic)** | 7 framework pages → ~30–50 control spokes                                                         | Pilot 2 (SOC2+HIPAA) → measure 90d → scale | evidence-forward, control+clause cited, "flag never guess" (`specs/04:39`) | P0       |
| **Use-case (programmatic)**  | 4–6 vertical pages                                                                                | After framework pilot validates            | persona-targeted under umbrella                                            | P1       |
| **Guides/blog**              | 8–12 dev how-tos (audit-log-nodejs, RLS, sqlite-vec, eval-CI, governed-agents)                    | 1–2/wk steady; cross-cluster reach         | named senior-engineer byline (GEO + `specs/04:60`)                         | P1       |
| **Glossary (GEO)**           | 6–10 "what is" answer-first pages                                                                 | Once, then maintained                      | answer-first, ≤60-word definitions                                         | P1       |

**Why guides matter beyond traffic — GEO/AI-citation:** the strongest predictor of AI citation is
**off-site brand mentions (0.664 correlation), stronger than any on-page factor** (AgentPatterns citing
Princeton/ACM-KDD — https://agentpatterns.ai/geo/). On-page lifts that _do_ work: **2–3 attributed
expert quotes (+41%), specific statistics over qualitative claims (+40%), semantic chunking (2.3×
citations)** — and these map 1:1 onto the `specs/04` voice (named engineers, artifacts-as-evidence,
terse chunked sections). The retrofit-cost figures ("SOC 2 from scratch: $80k, 6–9 months", `specs/04:91`)
are exactly the kind of stat AI engines cite. The voice contract and GEO point the same direction.

---

## 6. Technical-SEO / GEO state vs. recommended (light — the kickoff scopes technical SEO separately)

| Surface                      | Current                                                              | Gap / recommendation                                                                                                                                                                                                |
| ---------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `robots.ts`                  | `userAgent: "*", allow: "/"` (`robots.ts:7`)                         | Allows all (incl. GPTBot/ClaudeBot/PerplexityBot) — _good for GEO_. Decision: keep blanket-allow vs add explicit per-agent rules (Fork S-11). Cloudflare WAF must not block AI crawlers (ADR-0045 host).            |
| `sitemap.ts`                 | marketing + docs, static (`sitemap.ts`)                              | Add `/frameworks/*`, `/use-cases/*`, `/guides/*`, `/glossary/*` as they ship.                                                                                                                                       |
| JSON-LD                      | one `SoftwareApplication` on marketing layout (`layout.tsx:7`)       | Add **FAQPage** (most powerful for AI citation — bavaria-ai), **TechArticle/HowTo** on guides, **DefinedTerm** on glossary, **BreadcrumbList** on nested pages (Fork S-10).                                         |
| `llms.txt` / `llms-full.txt` | docs-only via Fumadocs (`llms.txt/route.ts`)                         | Decision: extend to marketing + framework pages (Fork S-12). Note: llms.txt has "no proven citation lift" alone (agentpatterns; dev.to/mbdev) — value is agent comprehension, not ranking. Keep, don't over-invest. |
| OG image                     | single static, "Fail-closed by construction" (`opengraph-image.tsx`) | Decision: per-edition / per-framework OG vs single (Fork S-19).                                                                                                                                                     |
| SSR                          | static export, Next 16 (ADR-0045)                                    | **Good** — server-rendered HTML is "the single most common reason content shows up in AI answers" (dev.to/mbdev). The static-export choice is a GEO asset.                                                          |

---

## 7. FORK BOARD — SEO + COPY

A fork = an open design decision with 2–4 concrete options + recommendation + confidence + evidence.
`surface ∈ {seo, copy}`. **individual** = present alone (hero/positioning-adjacent), not batched.

### SEO forks

**S-01 · Programmatic framework-page strategy — ship or not, and at what scope.**
Options: (a) **No programmatic** — hand-write only the 4 edition pages + a few guides; (b) **Framework pages only** — `/frameworks/{7}` mapping controls→shipped guarantees; (c) **Framework + control spokes** — add `/frameworks/soc2/{cc6-1…}` (~30–50 pages); (d) **Full pSEO** — framework + control + vertical use-case + stack guides (100+ pages).
Tradeoffs: (a) safe, leaves the entire low-KD/high-CPC long-tail on the table; (b) on-brand, ~7 pages, low thin-content risk; (c) captures `SOC 2 CC6.1`-class near-zero-competition terms; (d) maximal reach, real thin-content/maintenance risk at a solo-operator scale.
**Recommendation: (c)** — framework pages + control spokes, piloted 2 frameworks (SOC2+HIPAA) → measure indexation 90d → scale. Each page carries a _real_ evidence artifact (the `/compliance` page already renders them, `compliance/page.tsx:20-62`), so the ≥30–40%-unique-content floor is met by construction. **Confidence: high.** Evidence: Archiet's `/use-cases/{framework}-{stack}` model (archiet.com); Digital Aranya long-tail 3–4× conversion; Okara/GTMStack "pilot 50–100 then scale."

**S-02 · Vertical use-case pages — ship `/use-cases/{vertical}`?**
Options: (a) skip; (b) 4 verticals (fintech, healthtech, legal, hr-tech); (c) 8+ verticals.
**Recommendation: (b), after S-01 pilot validates.** Confidence: medium. Evidence: "compliance for fintech startups converts 3–4×" (Digital Aranya); use-case pages are a top-4 SaaS pSEO template (Discovered Labs).

**S-03 · Stack/integration guide pages — ship `/guides/{stack-pattern}`?**
Options: (a) none; (b) a curated 8–12 (audit-log-nodejs, multi-tenant-rls-nextjs-supabase, sqlite-vec-vs-chroma, eval-in-ci, governed-agents-typescript); (c) full integration matrix (Zapier-style).
**Recommendation: (b).** These capture the cross-cluster _informational_ terms (`audit trail nodejs`, `sqlite-vec`) that feed the free-AGPL/AI-Kit awareness flanks and double as GEO-citation surfaces. Full matrix (c) doesn't fit — we have no integration directory. Confidence: high. Evidence: `audit trail nodejs` SERP saturation (DEV.to, AuditKit/guides/nodejs, trailkit, pametan/audit-log); sqlite-vec comparison-intent (ai-tldr, sitepoint).

**S-04 · Comparison / "alternative" pages — the firewall tension.** _(individual — ADR-0040-adjacent)_
Options: (a) **none** — no `/caisson-vs-X`, no `/{competitor}-alternative`; (b) **category comparisons only** — "compliance dev-kit vs audit-automation platform (Vanta/Drata)" framed as picks-vs-platform, never product-vs-product; (c) **full competitor comparison pages** (the standard pSEO pattern).
Tradeoffs: (c) is the single most-proven pSEO pattern and captures the highest-CPC "[competitor] alternative" queries — **but directly violates ADR-0040's "generic base = footnote, never a comparison table" and re-opens the anti-ICP price-shopping buyer.** (a) forfeits that traffic but stays pure. (b) threads the needle: ADR-0040 _already_ frames Caisson against Vanta/Drata as "picks-and-shovels vs finished platforms" — a _category_ comparison, not a kit-vs-kit table.
**Recommendation: (b).** One category page ("Why a compliance dev-kit, not a $2k/mo audit platform") is on-brand and on-message; reject product-vs-product comparison pages. **Confidence: medium** (needs operator ruling — it touches the locked firewall). Evidence: ADR-0040 ("SERP owned by finished platforms… picks-and-shovels gap"); `specs/04:88` ("A scanner is a smoke detector. Caisson is the fail-closed construction"); Momentum Nexus (comparison pages = #1 pSEO pattern) — the _temptation_ is precisely what the firewall guards against.

**S-05 · Glossary / "what is" pages — ship `/glossary/{term}`?**
Options: (a) skip; (b) 6–10 coined-term pages (fail-closed RLS, WORM storage, audit chain, per-tenant encryption, governed agents).
**Recommendation: (b).** We _coined_ "fail-closed by construction" (`specs/04:68`) — near-zero competition, and answer-first definitional pages are the top GEO-citation format (FAQPage/DefinedTerm). Confidence: high. Evidence: bavaria-ai (FAQPage = most powerful for AI citation, 40–60-word answers); agentpatterns (semantic chunking 2.3×).

**S-06 · Per-page primary-keyword assignment.**
Options: (a) leave pages keyword-agnostic (voice-pure); (b) assign one head term per page and align title/H1/meta/first-paragraph.
**Recommendation: (b)** with the mapping in §2 (home=umbrella brand; /compliance="compliance infrastructure regulated SaaS"; framework pages=`SOC 2 starter kit`/`HIPAA boilerplate`; /ai-kit=`LLM cost control`+`eval CI`; /local-first=`local-first AI`+`on-device vector search`; /agentic-dev=`governed agents`). Confidence: high. Evidence: hoponline ("keyword in title, H1, URL, meta, first paragraph").

**S-07 · Free-AGPL / local-first as the top-of-funnel SEO engine — how much content weight?**
Options: (a) minimal (one /local-first page); (b) a sustained sqlite-vec / on-device-RAG guide stream as the awareness flank.
**Recommendation: (b), lightweight.** ADR-0040 makes local-first the _awareness_ flank (not revenue), and the sqlite-vec SERP is editorial/how-to — a natural, cheap reach surface that doesn't compete for the compliance budget. Confidence: medium. Evidence: ADR-0040 edition roles; likeone.ai / mvpfactory editorial dominance of `local-first AI`.

**S-08 · Docs as a deliberate SEO surface.**
Options: (a) docs are reference-only, noindex-ish; (b) optimize `/docs/base/tenancy-rls`, `/docs/compliance/audit-worm`, `/docs/compliance/field-crypto` for their head terms (`multi-tenant RLS`, `WORM audit log`, `field-level encryption`).
**Recommendation: (b).** These docs pages already exist (`apps/site/content/docs/…`) and target real dev keywords; a title/intro pass is near-zero-cost ranking. Confidence: high. Evidence: secure-nestjs-drizzle-template ranks purely on README/topic SEO for the same terms.

**S-09 · URL taxonomy for programmatic pages.**
Options: (a) `/compliance/frameworks/soc2` (nested under edition); (b) **top-level `/frameworks/soc2`** + `/use-cases/*` + `/guides/*`; (c) `/soc2-starter-kit` flat slugs.
**Recommendation: (b).** Clean hub/spoke crawl paths, breadcrumb-friendly, doesn't bloat the edition URL. Confidence: high. Evidence: GrowthHackerDev (`/integrations/{vendor}`, `/use-cases/{problem}` canonical pSEO URL shapes); Okara (hub-and-spoke crawlability).

**S-10 · JSON-LD / structured-data scope.**
Options: (a) keep only `SoftwareApplication` (`layout.tsx:7`); (b) add FAQPage (edition + glossary), TechArticle/HowTo (guides), DefinedTerm (glossary), BreadcrumbList (nested).
**Recommendation: (b).** Confidence: high. Evidence: bavaria-ai (attribute-rich schema = 61.7% citation rate vs 41.6% generic vs 59.8% none); GTMStack (Product/FAQPage/SoftwareApplication schema per page type).

**S-11 · AI-crawler / robots policy.**
Options: (a) keep blanket `allow: "/"` (`robots.ts:7`); (b) explicit allow-list naming GPTBot, OAI-SearchBot, ClaudeBot, anthropic-ai, Claude-User, PerplexityBot, Google-Extended, CCBot.
**Recommendation: (a) is already correct for GEO; optionally (b) for explicitness/auditability.** The real risk is the Cloudflare WAF silently blocking AI bots (ADR-0045) — verify at deploy. Confidence: high. Evidence: dev.to/mbdev + bavaria-ai (separate GPTBot vs OAI-SearchBot; Anthropic's three agents; CDN allowlist as layer 7).

**S-12 · llms.txt scope.**
Options: (a) keep docs-only (`llms.txt/route.ts`); (b) extend to marketing + framework + glossary pages; (c) add `llms-full.txt` concatenation.
**Recommendation: (b), modestly.** Extend coverage but don't over-invest — llms.txt has "no proven citation lift" alone; value is agent comprehension. We already emit `llms-full.txt` for docs. Confidence: medium. Evidence: agentpatterns ("llms.txt alone — no statistical citation correlation in 300k-domain study"); smartmoneymedia (llms-full.txt benefits "documentation-heavy products answering how-do-I-X").

**S-13 · Home vs /compliance cannibalization.**
Options: (a) leave both targeting "compliance-grade infrastructure for regulated SaaS" (`page.tsx:8` = `compliance/page.tsx:8`, near-identical); (b) **differentiate** — home owns the _umbrella/brand_ head ("production-grade codebase library / load-bearing infrastructure"), /compliance owns the _transactional_ compliance head ("SOC 2 / HIPAA starter kit, evidence-pack").
**Recommendation: (b).** Two pages competing for one query split authority and cannibalize. Confidence: high. Evidence: Okara ("each page must own a distinct query intent… overlapping keywords cannibalize"); current duplicate metadata at `page.tsx:7-10` and `compliance/page.tsx:7-10`.

**S-14 · Sitemap priority/changeFreq tuning.**
Options: (a) keep (home 1.0, marketing 0.8, docs 0.6, weekly — `sitemap.ts:21-26`); (b) raise /compliance + framework pages, lower thin spokes, set realistic changeFreq.
**Recommendation: (b), minor.** Low-impact but free; sitemap priority is a weak signal. Confidence: low. Evidence: GrowthHackerDev (canonical + noindex thin variants; sitemap hygiene).

**S-15 · Pillar-page architecture — one mega-pillar vs distributed.**
Options: (a) one "SOC 2 for developers" mega-guide as the authority hub; (b) distributed framework pillars each acting as its own hub.
**Recommendation: (b).** Distributed framework pillars match the programmatic spine and spread authority across 7 frameworks rather than betting on one head. Confidence: medium. Evidence: omnius/Discovered Labs (hub introduces category, spokes link back — topical clusters).

**S-16 · "boilerplate / starter kit" keyword targeting despite anti-ICP.** _(individual — ADR-0040-adjacent)_
Options: (a) avoid "boilerplate/starter-kit" terms entirely (purity, cedes the searches); (b) **target them on framework/free pages only**, never the paid compliance hero, and qualify ("not a $199 kit — the load-bearing layer kits skip").
**Recommendation: (b).** `SOC 2 starter kit` / `HIPAA boilerplate` *are* the highest-WTP compliance long-tails (Clynova/Archiet rank on them), and ADR-0040's firewall is about *not discounting the hero to win price-shoppers* — not about refusing the search term. Target the term, qualify the copy. Confidence: medium (touches the firewall). Evidence: ADR-0040 (anti-ICP enters "only through the free AGPL flank"); `specs/04:80` (the "$199 kits" footnote, once, never a table).

**S-17 · EU AI Act / DORA framework pages — ship now on the enforcement-timing wave?**
Options: (a) defer (content is a gated paid module per ADR-0040); (b) ship a _marketing/SEO_ framework page now (the empty-slot "EU AI Act-ready" claim ADR-0040 already authorizes), gate the actual evidence-pack behind the registry.
**Recommendation: (b).** Aug-2026 enforcement = rising search with low competition; ADR-0040 explicitly scaffolds the named slot so v1 can say "EU AI Act-ready." A framework _page_ (not the module) captures the demand wave. Confidence: high. Evidence: ADR-0040 (Annex IV empty-slot, "sell worldwide"); Teleport/Docker/sota.io ranking the Aug-2026 timeline; current `/compliance` page already names the EU AI Act-ready add-on (`compliance/page.tsx:76`).

**S-18 · GitHub-topic / repo-README SEO (off-site surface).**
Options: (a) ignore; (b) optimize the public repo topics (`soc2-compliance`, `audit-log`, `multi-tenancy`, `rls`, `worm`) and README as a ranking + AI-citation surface.
**Recommendation: (b).** Off-site brand mentions are the #1 GEO citation predictor, and GitHub READMEs rank directly (secure-nestjs-drizzle-template, the audit-log repos). Confidence: medium. Evidence: agentpatterns (off-site mentions 0.664); github.com/RamosJSouza topic tags ranking in our cluster.

**S-19 · OG/social image strategy.**
Options: (a) single static OG (`opengraph-image.tsx`); (b) per-edition + per-framework dynamic OG (satori build-time).
**Recommendation: (b) for editions + frameworks, deferred to build session.** Branded OG cards are a named GEO layer; per-framework cards lift CTR on shared compliance links. Confidence: low (polish, not core). Evidence: smartmoneymedia (branded OG cards = AEO/GEO layer); current single-image limitation (`opengraph-image.tsx:54`).

### COPY forks

**C-01 · Edition H1 keyword-alignment vs voice-purity.** _(individual — hero-copy-adjacent)_
Options: (a) keep voice-pure H1s with zero keywords ("Fail-closed by construction." `page.tsx:76`; "Audit-ready from the first commit." `compliance/page.tsx:101`); (b) keep the H1 pure but **guarantee the keyword lands in the eyebrow + first lede sentence + meta** (it largely does — eyebrow "Compliance-grade infrastructure for regulated SaaS" `compliance/page.tsx:88`); (c) rewrite H1s to carry the head term.
**Recommendation: (b).** The `specs/04` voice (≤7-word category H1, zero hype) is _locked and good_; SEO doesn't need the keyword in the H1 if the eyebrow/lede/title/JSON-LD carry it — which they already do. Do **not** sacrifice "Fail-closed by construction" for keyword density. Confidence: high. Evidence: `specs/04:53-60` (cadence: headline = category claim ≤7 words); hoponline (keyword in title/H1/_meta/first paragraph_ — first-paragraph suffices, H1 optional); current eyebrow already carries the term.

**C-02 · Meta-description templates per page type.**
Options: (a) hand-write each (current: home `page.tsx:8`, compliance `compliance/page.tsx:8`); (b) a per-type template (framework: "{Framework} controls, mapped to running code — {guarantee list}, with the evidence pack auditors accept."; guide: "How to {task} in {stack} — {artifact}, append-only and tested.").
**Recommendation: (b)** for programmatic pages; keep hand-written for the 4 editions. Confidence: high. Evidence: GrowthHackerDev (head partial: title/meta/canonical per template); compliance buyers "reject thin marketing copy" (GrowthSpree).

**C-03 · Framework-page copy voice — over-claim guardrail.** _(individual — trust/claims-adjacent)_
Options: (a) confident "Caisson makes you SOC 2 compliant"; (b) **precise-scope** "Caisson ships the _technical controls_ SOC 2 CC6.x/CC7.2 require; the org controls (HR, vendor risk, IR) remain yours" (the compliance.tf disclaimer model).
**Recommendation: (b), binding.** `specs/04:42` ("flag, never guess — never market a framework Caisson only scaffolds as one it fully covers") makes this non-negotiable; every competitor that survives an audit says this (compliance.tf "does not replace your auditor"; StarterPick "no boilerplate is HIPAA-certified"). Over-claiming is both a trust _and_ legal risk in a YMYL SERP (Digital Aranya: Google treats compliance as Your-Money-Your-Life). Confidence: high. Evidence: `specs/04:39-42`; github.com/compliancetf disclaimer; starterpick HIPAA guide.

**C-04 · FAQ blocks on edition + framework pages (copy for FAQPage schema + GEO).**
Options: (a) no FAQ; (b) 3–5 answer-first Q&A per edition/framework page ("Does Caisson make me SOC 2 compliant?" "Is the audit log tamper-proof?"), 40–60-word self-contained answers.
**Recommendation: (b).** Doubles as the highest-value AI-citation format _and_ pre-empts the procurement-questionnaire questions (Trailbase's "40-page security questionnaire" hook). Confidence: high. Evidence: bavaria-ai (FAQPage most powerful, 40–60 words, no pronouns to prior paragraphs); stackmatix self-contained-answer rule.

**C-05 · Answer-first / "KEY TAKEAWAY" blocks in docs + guides for GEO.**
Options: (a) prose-first docs; (b) lead each docs/guide section with the answer, then elaborate (RAG retrieves section openings).
**Recommendation: (b).** Cheap rewrite, large citation lift, and consonant with the terse `specs/04` register. Confidence: high. Evidence: Mintlify GEO guide ("directness — buries answer after 3 paragraphs = less cited"); agentpatterns (answer-first; RAG retrieves openings).

**C-06 · Named-author bylines on guides (GEO citation + voice).**
Options: (a) unbylined / brand-voice guides; (b) named senior-engineer bylines with 2–3 attributed quotes per piece.
**Recommendation: (b).** GEO citation lift +41% from attributed expert quotes, and `specs/04:60` already prescribes "named senior engineers… not star ratings" for social proof. Confidence: medium. Evidence: agentpatterns (quotation addition +41%); `specs/04:60`.

**C-07 · CTA copy on programmatic pages (waitlist, ADR-0048).**
Options: (a) reuse "Request early access" everywhere (`page.tsx:92`); (b) intent-matched CTA per page type — framework pages: "See how Caisson maps to {framework}"; guides: "Read the docs" → waitlist; keep "Request early access" on edition heroes.
**Recommendation: (b).** Informational framework/guide visitors aren't ready for "early access"; match CTA to funnel stage, all still routing to the waitlist (no checkout, ADR-0048). Confidence: medium. Evidence: Digital Aranya (informational pages → "free readiness assessment" CTA, not buy-now); hoponline (CTA relevant to keyword intent).

**C-08 · Generic-base footnote placement across the expanded surface.** _(individual — ADR-0040 firewall)_
Options: (a) the "better than a $199 kit" line appears once on home only (current intent, `specs/04:80`); (b) repeat the qualified footnote on each framework page; (c) drop it entirely on programmatic pages.
**Recommendation: (a)/(c) — keep it to the home footnote, omit from framework pages.** Repeating it (b) drifts toward the banned comparison-table energy. Confidence: high. Evidence: `specs/04:80` ("once, as a footnote, never a comparison table"); ADR-0040 buyer firewall.

**C-09 · Persona-targeted messaging depth per cluster page.**
Options: (a) uniform umbrella voice on all 4 editions; (b) per-edition register from `specs/04:99-104` (compliance=trust+evidence; AI-Kit=rigor+control lead-with-the-spike; local-first=sovereignty; agentic=governance) — each still "the same rigor, applied to {their problem}."
**Recommendation: (b).** Already specced; just enforce it as pages expand. Confidence: high. Evidence: `specs/04:99-104`; ADR-0040 (non-compliance editions read as "same rigor applied to X," never co-hero).

**C-10 · "audit trail nodejs" guide copy — compete in a saturated SERP.**
Options: (a) skip (too saturated); (b) write the _definitive_ version — append-only + hash-chain + the end-truncation/anchoring nuance most posts miss (pametan/audit-log and forge-hashchain flag it; most DEV.to posts don't).
**Recommendation: (b).** The saturation is _shallow_ — most posts stop at "append-only table"; our field-crypto/audit-chain depth (anchoring against end-truncation, Merkle roots) is a genuine differentiator that earns the citation. Confidence: medium. Evidence: github.com/pametan/audit-log (hash chain "does NOT detect end-truncation — anchor the head externally"); forge-hashchain-audit (Merkle anchoring); the shallow DEV.to/sevensquare posts.

**C-11 · Eyebrow / category-line keyword consistency.**
Options: (a) varied eyebrows; (b) the eyebrow carries the page's head term verbatim (compliance eyebrow already = "Compliance-grade infrastructure for regulated SaaS" `compliance/page.tsx:88`).
**Recommendation: (b).** The eyebrow is the SEO-safe home for the keyword when the H1 stays voice-pure (resolves the C-01 tension). Confidence: high. Evidence: current compliance eyebrow pattern; hoponline (semantic keyword placement).

**C-12 · Title-tag templates.**
Options: (a) per-page hand-written (current: `"Compliance — fail-closed infrastructure for regulated SaaS"` `compliance/page.tsx:7`); (b) a template per type: framework=`"{Framework} compliance in code — Caisson"`; control=`"{Control}: how Caisson satisfies it"`; guide=`"{Task} in {stack} — Caisson guides"`; glossary=`"What is {term}? — Caisson"`.
**Recommendation: (b)** for programmatic types; keep hand-written editions. Confidence: high. Evidence: GrowthHackerDev (title in head partial per template); Okara (title uniqueness ≥90% across pSEO pages).

---

## 8. Gaps / what could not be answered from the SERP

- **Exact MSV (monthly search volume) per keyword** — exa surfaces SERP intent + competitor ranking + CPC/KD where third parties publish it (seojuice, GrowthSpree), but not per-term volume for our specific long-tails. A one-pass through Ahrefs/Semrush at execution time would harden the §2 tables; the _intent and difficulty class_ are well-grounded.
- **Caisson's actual domain authority / current indexation** — caisson.sh is a fresh domain (waitlist stage). All "Opp" ratings assume zero DA; they improve as the framework/guide cluster builds authority.
- **Whether Cloudflare's WAF (ADR-0045) currently blocks AI crawlers** — must be verified at deploy (Fork S-11); not determinable from search.
