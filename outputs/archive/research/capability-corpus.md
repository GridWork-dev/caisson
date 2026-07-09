# Capability Corpus — GridWork portfolio (Phase 1 converge)

**Date:** 2026-06-27 · **Sources:** 15 (14 harvestable + 1 pro-private) · **Method:** one
schema-locked Sonnet extraction agent per repo (parallel), converged on the Opus main
thread, maturity cross-checked against objective `metrics.tsv` (LOC/tests/commits).
Raw per-repo data: `raw-extractions.json`.

> **Purpose of this doc:** answer _"which of my proven capabilities map to a sellable
> template/framework, and how strong is each baseline?"_ — the input to Phase 2 market
> research. Demand/competition is NOT scored here (that's Exa, Phase 2); this ranks
> **baseline strength × defensibility × inverse build-effort** only.

---

## 1. Headline findings

1. **Two genuinely-defensible moats have real launched code behind them, not just specs:**
   - **(A) Compliance-grade regulated-document data layer** — `Wardfile` + `Wardfile-il-dbui`. RLS + S3 WORM Object-Lock + append-only versioning + per-tenant KMS field encryption + multi-jurisdiction flag engine. **Two repos converge on the same moat** = strongest signal in the portfolio. Rare in the template market (most boilerplates skip RLS/WORM entirely).
   - **(B) Local-first / on-device AI app stack** — `tessera` (public AGPL). Compute dispatcher + privacy gate + sqlite-vec ANN + multi-backend (MPS/CUDA/ONNX/rented) + offline Ed25519 license. Launched, tested, **legally clean to harvest** (you own it, AGPL public).

2. **A third moat (AI-feature-add) is strong at the _pattern_ level but more commoditized** — `prospector`'s rubric-as-code (LLM proposes, schema validates, **code owns the arithmetic**), `throughframe`'s cost-budgeted salience gate (drop 60–70% of records _before_ any LLM spend; every call injected → tests run at $0), `telesis`'s LangGraph multi-source enrichment. The _rigor_ (cost discipline + adversarial kill-gate) is the differentiator, not the wrapper.

3. **A cross-cutting monetization asset sits in two repos** — the **offline Ed25519 license + Polar→Cloudflare-Worker→Resend delivery stack**. It exists in `media-pipeline` (**pro-private**) AND `tessera` (**public**). ⚠️ **Harvest from `tessera` only.** Sellable on its own as a "ship perpetual offline licenses without phone-home" kit.

4. **`gridwork-core` is a unique-but-hard-to-sell asset** — a production AI-agent OS (agent/skill/doctrine schema + local sqlite-vec memory stack + Python lifecycle hooks + `gw` CLI, 88K LOC / 256 test files / 946 commits). Genuinely novel, but narrow buyer pool (Claude Code ecosystem) and deeply coupled to the operator's box → high productization effort.

5. **Multi-tenant SaaS boilerplate is solved twice over** — `gridwork`'s auth/tenant/tier/credits quad + `gridworkdigital`'s fail-closed RLS (16 FORCE policies, 3-role `withTenant()`). Low effort to template, but the crowded market caps defensibility. Best used as the **shared substrate** under the moat-A/B templates, not a headline product.

6. **Two repos are effectively dead-for-baseline:** `tm-watch` (specs-only, documented **NO-GO** after finding ≥6 incumbents — keep only the go/no-go memo + UPL-boundary ADR as reusable _artifacts_) and `glossread` (not launched, ~2.5K LOC — but its build-enforced compliance boundary "The Wall" is a harvestable _idea_).

---

## 2. Portfolio cluster map

The 15 sources collapse into **5 capability clusters**. Sellable templates map to clusters, not single repos.

| Cluster                                  | Repos                                                                                       | Strongest convergent asset                                                                      | Moat                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------ |
| **A. Compliance / regulated data layer** | Wardfile, Wardfile-il-dbui, telesis (field-enc), glossread ("The Wall"), tm-watch (UPL ADR) | RLS + WORM + append-only versioning + per-tenant KMS field-enc + multi-jurisdiction flag engine | **(a) compliance-grade** |
| **B. Local-first / on-device AI**        | tessera (public), media-pipeline (pro-private), health-service (zero-egress engine)         | compute dispatcher + privacy gate + sqlite-vec ANN + offline license                            | **(b) local-first AI**   |
| **C. AI-feature-add pipelines**          | prospector, throughframe, telesis, gridwork (LangGraph), glossread (eval)                   | rubric-as-code + adversarial kill-gate + cost-budgeted salience gate ($0 tests via DI)          | **(c) AI-feature-add**   |
| **D. AI-agent OS / dev-tooling**         | gridwork-core, dev-profile, FOUNDER-OS                                                      | agent/skill/doctrine schema + local memory stack + lifecycle hooks + gw CLI                     | dev-tooling              |
| **E. Multi-tenant SaaS substrate**       | gridwork, gridworkdigital                                                                   | fail-closed RLS + Better-Auth + Stripe credits/entitlement quad                                 | (cross-cutting)          |

**Family overlaps to know:** `media-pipeline` = the **private parent** of public `tessera`
(B). `Wardfile` + `Wardfile-il-dbui` = the **same compliance product family** (A) — il-dbui
is a working snapshot (no git history) of the deployed variant with 140+ ADRs.

---

## 3. Capability matrix (metrics-grounded)

LOC / tests / commits from `metrics.tsv` (objective). "Launched" from agent assessment.

| Repo                         | Domain               | Stack (core)                                  |   LOC | Tests | Commits | Launched | Strongest harvestable asset                                                         | Class           |
| ---------------------------- | -------------------- | --------------------------------------------- | ----: | ----: | ------: | -------- | ----------------------------------------------------------------------------------- | --------------- |
| **Wardfile**                 | compliance           | TS, Next, Postgres+RLS, S3 WORM, Drizzle      | 793K* |  1151 |     839 | yes      | Regulated-doc data layer (RLS+WORM+versioning+KMS) + multi-jurisdiction flag engine | harvest         |
| **Wardfile-il-dbui**         | compliance           | TS, better-auth, oRPC, RLS, S3 WORM, KMS      |  110K |   155 |      0† | partial  | Compliance SaaS starter (RLS+WORM+KMS+oRPC) + flag-never-guess doc assembly         | harvest         |
| **tessera**                  | local-first AI       | Python, TS/React, sqlite-vec, vanilla-extract |   53K |    78 |      2† | yes      | On-device AI stack (compute dispatcher + privacy gate + ANN) + offline license      | harvest         |
| **media-pipeline**           | local-first AI       | Python, TS, HCL/Terraform, CF Workers         |   20K |     1 |     231 | partial  | License-delivery stack (Ed25519+Polar+Worker+Resend) — _pattern only_               | **pro-private** |
| **health-service**           | compliance/health    | Python, MCP, SQLite (32 migr), numpy/scipy    |   43K |   133 |     416 | yes      | Zero-egress deterministic analysis engine + MCP-in-daemon                           | harvest         |
| **gridwork-core**            | AI-agent OS          | TS/Bun, Python hooks, sqlite-vec+FTS5         |   89K |   256 |     946 | yes      | Agent/skill/doctrine schema + local memory stack + gw CLI + hooks                   | harvest         |
| **prospector**               | AI-feature-add       | TS/Bun, multi-adapter, rubric-as-code         |   79K |    25 |     197 | partial  | Full opportunity-discovery pipeline (kill-gate + rubric scoring)                    | harvest         |
| **gridwork** (paused)        | AI-feature-add SaaS  | TS, Better-Auth, Stripe, RLS, LangGraph       |  113K |   216 |     316 | yes      | auth/tenant/tier/credits quad + LangGraph pipeline engine                           | harvest         |
| **gridworkdigital** (paused) | agency/SaaS          | TS, Drizzle, Neon, RLS, Stripe                |   94K |   125 |     446 | partial  | Fail-closed 3-role RLS (`withTenant`, 16 FORCE policies) + Stripe entitlement gate  | harvest         |
| **telesis** (paused)         | health/wellness AI   | TS+Python, AES-256-GCM, LangGraph             |   67K |   368 |     492 | partial  | Field-level encryption (TS↔Python interop) + enrichment pipeline                    | harvest         |
| **throughframe** (paused)    | AI-feature-add media | Python, DI LLM pipeline                       |   15K |    41 |     189 | no       | Cost-budgeted LLM salience gate (DI, $0 tests)                                      | harvest         |
| **dev-profile**              | dev-tooling          | TS/Bun, @resvg                                |    8K |     0 |      15 | yes      | Pure-SVG server charts + ETag GitHub client + stack detector                        | harvest         |
| **glossread** (paused)       | AI-feature-add       | TS, monorepo, eval engine                     |    3K |     3 |      24 | no       | Build-enforced compliance boundary ("The Wall") + calibrated eval spec              | harvest         |
| **FOUNDER-OS**               | dev-tooling          | TS/Bun, TOML signals                          |    2K |     4 |      10 | yes      | Governor engine (pure-fn portfolio governance + psychology-signal layer)            | harvest         |
| **tm-watch** (paused)        | compliance           | specs only                                    |     0 |     0 |       3 | no       | Go/No-Go memo + UPL-boundary ADR + multi-signal engine **spec** (NO-GO documented)  | harvest         |

\* Wardfile 793K LOC metric is inflated by generated migrations / seed data — hand-written
source is far smaller; treat as "very large, mature," not literal. † `tessera` 2 commits =
squashed public release; `Wardfile-il-dbui` 0 commits = working snapshot, no `.git`.

---

## 4. Productized-building inventory — strongest reusable assets, ranked

Ranked by **baseline strength × defensibility × inverse build-effort** (demand added in Phase 2).
"Seed repos" = `harvestable` sources only. Port-effort = work to genericize into a template.

### Tier S — defensible, real launched code, harvest-ready

**S1 · Compliance-grade regulated-document data layer** — moat (a)

- **Seeds:** Wardfile + Wardfile-il-dbui (RLS schema, `core/artifact/` WORM store, append-only versioning, per-tenant KMS KEK field-enc, `states/` multi-jurisdiction flag engine, flag-never-guess doc assembly + golden regression).
- **Defensibility:** HIGH — RLS+WORM+audit is rare in starters; deep regulatory domain knowledge; **two repos converge**.
- **Port effort:** MED — de-tenant from Wardfile specifics; strip jurisdiction data; keep the engine.

**S2 · Local-first on-device AI app kit** — moat (b)

- **Seeds:** tessera (compute dispatcher + privacy gate + sqlite-vec ANN + exact-rescore + multi-backend MPS/CUDA/ONNX/rented). Supporting: health-service zero-egress analysis engine; gridwork-core sqlite-vec+FTS5 memory stack.
- **Defensibility:** HIGH — local-first is a real anti-cloud differentiator; tessera is launched + tested + cleanly AGPL-owned.
- **Port effort:** LOW–MED — tessera already structured open-core.

**S3 · Offline license / open-core monetization kit** — cross-cutting

- **Seeds:** ⚠️ **tessera ONLY** (Ed25519 offline tokens + ProFeature enum + community fallback + Polar webhook). The identical stack in media-pipeline is **pro-private — do not use**.
- **Defensibility:** MED — narrow but high-value; few good offline-license templates exist.
- **Port effort:** LOW.

### Tier A — strong patterns, more commoditized

**A1 · AI-feature-add pipeline kit** — moat (c)

- **Seeds:** prospector (rubric-as-code + adversarial kill-gate), throughframe (cost-budgeted salience gate, DI/$0 tests), telesis (LangGraph multi-source enrichment + evidence tiers), gridwork (LangGraph engine + SSE + cost tracking).
- **Defensibility:** MED — "AI wrapper" market is crowded; the **cost-discipline + rubric-as-code rigor** is the edge.
- **Port effort:** MED — patterns spread across 4 repos; needs consolidation.

**A2 · Multi-tenant SaaS security floor** — substrate

- **Seeds:** gridworkdigital (fail-closed 3-role RLS, 16 FORCE policies, `withTenant`), gridwork (Better-Auth + Stripe credits/entitlement quad).
- **Defensibility:** LOW–MED — crowded market; fail-closed RLS floor beats most starters.
- **Port effort:** LOW. **Best role: shared substrate under S1/S2, not a standalone headline.**

### Tier B — niche / dev-tooling

**B1 · Claude Code agent-OS starter** — gridwork-core (agent/skill/doctrine schema + memory stack + hooks + gw CLI). Unique; narrow buyer; **port effort HIGH** (operator-coupled).
**B2 · Local-first AI memory library** — gridwork-core memory stack standalone (sqlite-vec+FTS5+embeddings+egress-guard+dedup/GC). Overlaps S2; LOW effort.
**B3 · Server-side reporting / GitHub-analytics kit** — dev-profile (pure-SVG charts, ETag GitHub client, multi-lang stack detector). Commodity; LOW effort.
**B4 · Founder-OS governance CLI** — FOUNDER-OS governor engine. Personal/niche.

---

## 5. Pro/private firewall ledger (media-pipeline)

`media-pipeline` is tagged **`pro-private` wholesale.** Nothing below may seed a sellable or
public template — **patterns/ideas only**, never the implementation. Its `tessera-public/`
submodule is the open-core boundary (the standalone `tessera` repo is the harvestable copy).

| Path             | Why locked                                                                                                |
| ---------------- | --------------------------------------------------------------------------------------------------------- |
| `workers/`       | Pro license-minting infra, Polar webhook, CF KV store, **Ed25519 private-key mgmt** — the commercial moat |
| `terraform/`     | Live DNS for gettessera.xyz (real product domain, ProtonMail/Resend)                                      |
| `skills/`        | Private Pi agent skills tuned to the pipeline                                                             |
| `emails/`        | Tessera-branded transactional templates (Pigment palette)                                                 |
| `marketing/`     | Remotion brand animations + assets                                                                        |
| `docs/research/` | Internal monetization strategy + Pro-feature scoping briefs                                               |
| `docs/runbooks/` | GPU/H100/staging/signing operational runbooks                                                             |
| `LAUNCH.md`      | Private pricing + Pro/Free matrix + repo-split plan (marked do-not-publish)                               |
| `config.yaml`    | VLM adult-content taxonomy (operational, not a template)                                                  |
| `models/`        | JoyTag / WD-EVA02 tag configs                                                                             |

**Decision rule applied:** the license-kit and email-template patterns also exist in
public `tessera` → those are harvested from `tessera`, and media-pipeline contributes
_zero_ code to any deliverable.

---

## 6. Open questions teed up for Gate 1 → Phase 2/3

1. **Direction count.** The corpus supports 2 strong, defensible directions (S1 compliance, S2 local-first AI) + 1 cross-cutting product (S3 license kit) + 1 commoditized-but-broad (A1 AI-feature-add). Phase 2 will market-rank these.
2. **Compliance vertical is generic in the code but needs a _named niche_ to sell** (legal filings? insurance forms? payroll/tax? healthcare records?). Wardfile's jurisdiction engine is domain-agnostic — Phase 2 should find the highest-demand regulated niche.
3. **Substrate vs product.** A2 (SaaS security floor) is likely the _shared foundation_ every template ships on, not its own SKU — confirm at scoping.
4. **gridwork-core (B1)** is the wildcard: highest novelty, hardest to monetize. Flag for explicit operator call at Phase 3.
