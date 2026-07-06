---
updated: 2026-07-06
status: live
grounds:
  - packages/
---

# Package catalog — license, sold-as, price

Dated **2026-07-05** (rate-limit row added; otherwise the 2026-06-30 sweep). This file OWNS the **public-vs-commercial + sold-as + price** view: for every
package/service/app/tooling workspace in the monorepo — is it Apache-2.0 or commercial, is it sold at
all, as what (edition / à la carte module / bundle-only substrate / free tooling / app / service), and
for how much. `docs/build-state.md` OWNS the deep build-status view (LOC/test counts, seams, honest
gaps, phase status) — this file cites its verdicts, never restates the prose. On any conflict between
the two, `build-state.md` wins on **build status**; this file wins on **license/price/sold-as**.

## SOT hierarchy (this file's place in it)

Per root `CLAUDE.md`: **1)** `docs/state/decisions-and-forks.md` — the live open/locked fork board
(wins on any open decision) → **2)** `knowledge/decisions/` ADRs (append-only, the locked record) →
**3)** `specs/` (locked concept docs) → **4)** `plan.md`/`SUMMARY.md` → **5)** `outputs/` (session
artifacts). This file and `docs/build-state.md` are both **catalog views derived from that hierarchy**,
not primary sources — they sit alongside `plan.md`/`SUMMARY.md` in the reading order, synthesizing #1/#2
into a table. Two older root-level docs, [`docs/packages.md`](../packages.md) and
[`docs/editions.md`](../editions.md), predate open-core (ADR-0094/0097), the P6 commerce build, and the
ADR-0129/0130 pricing round — they are **stale on license and price** (still show all-commercial + the
ADR-0082/ADR-0106 point-values) and are superseded by this file for that view; they are not deleted or
edited here (out of scope for this task).

**Method:** license + sold-as/price are derived from **disk truth** — every `packages/*/package.json`,
`services/*/package.json`, `registry/package.json`, and `services/support-bot/pyproject.toml` `license`
field, read directly (not an embedded list), cross-checked against the standards-gate's own enforced
allowlist (`tooling/standards-gate/src/checks.ts` `OPEN_BASE_NAMES` + `checkOpenCoreLicensing`/
`checkOpenCommercialBoundary`). Prices are the operator-locked **PRICE_SOT** below (2026-06-30, this
session — not yet in an ADR; see the pricing note under §2b).

---

## 1. Master catalog

**Legend (build status, from `docs/build-state.md`):** **shipped** = real impl + green tests, wired
into a consumer, no known un-built seam · **substantial**/**built** = real impl + tests, some
un-exercised live transports or thin coverage (see build-state for the seam) · **partial** = merged,
real code + tests, un-exercised live transports or no recorded VERIFY/SWEEP · **pending** = scaffold
only or, for the 2 new ADR-0135 modules, **zero code, document-only lock**.

**† = one of the 8 commercial modules the registry Worker still serves FREE on the un-deployed live
path** (license-keyed gating CLOSED by ADR-0136 on this branch; un-gating takes effect at deploy — see
§3 note). Full build-status prose for any row: `docs/build-state.md` (search the package name).

### Open Base substrate (Apache-2.0) — 16 packages

| Package           | License    | Sold as                                                       | Edition     | Build status          | Owns                                                                                                              |
| ----------------- | ---------- | ------------------------------------------------------------- | ----------- | --------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `kernel`          | Apache-2.0 | bundle-only substrate — free, ships with every install        | Base (open) | built                 | config/schema/error model, SHA-256 chain, credit denomination (ADR-0098)                                          |
| `auth`            | Apache-2.0 | free                                                          | Base (open) | built                 | session/RLS seam                                                                                                  |
| `tenancy-rls`     | Apache-2.0 | free                                                          | Base (open) | built (thin)          | fail-closed RLS guard                                                                                             |
| `billing`         | Apache-2.0 | free                                                          | Base (open) | built                 | Stripe MoR + webhook events (buyer-side driver; platform billing is Paddle, ADR-0116)                             |
| `credits`         | Apache-2.0 | free                                                          | Base (open) | built                 | integer wallet + append-only ledger + 402                                                                         |
| `jobs`            | Apache-2.0 | free                                                          | Base (open) | built (thin)          | job seam                                                                                                          |
| `email`           | Apache-2.0 | free                                                          | Base (open) | built (thin)          | email seam                                                                                                        |
| `ai-config`       | Apache-2.0 | free                                                          | Base (open) | built (thin)          | provider-agnostic AI config                                                                                       |
| `mcp-server`      | Apache-2.0 | free (open transport; the commercial value it gates is not)   | Base (open) | built                 | auth-gated buyer MCP transport + rate-limit hook (ADR-0112)                                                       |
| `ui`              | Apache-2.0 | free                                                          | Base (open) | built                 | token floor (ADR-0042/0078)                                                                                       |
| `registry-schema` | Apache-2.0 | free                                                          | Base (open) | built                 | open registry contract split from `@caisson/registry` (ADR-0097)                                                  |
| `observability`   | Apache-2.0 | free                                                          | Base (open) | built                 | vendor-neutral OTel bootstrap (ADR-0117; see note below)                                                          |
| `cli`             | Apache-2.0 | bundle-only substrate — free, ships with every generated repo | Base (open) | built (full P5 drive) | `create-caisson` index gate, templated engine, `runGeneration`, migration bundler (Apache-2.0 per ADR-0136)       |
| `migrate`         | Apache-2.0 | bundle-only substrate — free, ships with every generated repo | Base (open) | built                 | the one migration assembler + runner + file-emit (ADR-0090/0091; Apache-2.0 per ADR-0136)                         |
| `license-verify`  | Apache-2.0 | bundle-only substrate — free, ships with every generated repo | Base (open) | substantial           | offline Ed25519 license verification (Apache-2.0 per ADR-0136)                                                    |
| `rate-limit`      | Apache-2.0 | free                                                          | Base (open) | built                 | per-IP token-bucket limiter + per-account store, extracted from services/docs + services/license (R1+R2, PR #119) |

**Note on `observability`:** enforced open by the standards-gate's `OPEN_BASE_NAMES` allowlist, citing
ADR-0117 inline ("base substrate every buyer gets, never edition-gated") — this makes it a **12th**
enforced open package, one more than the 11 named explicitly in ADR-0094 (10) + ADR-0097 (+1
`registry-schema`). ADR-0117's own text never states the license binding; the gate comment is the actual
source of record. Not a defect — the gate is correctly enforcing it and its only workspace dep
(`@caisson/kernel`) is itself open — but a future ADR should fold this into ADR-0094/0097's binding list
for literal accuracy. `cli`, `migrate`, and `license-verify` join the open set on top of that (ADR-0136,
commercial→Apache-2.0), bringing the enforced-open total to **15**.

### Commercial — Compliance edition ($799) + members

| Package            | License    | Sold as                                         | Edition    | Build status              | Owns                                                                                         |
| ------------------ | ---------- | ----------------------------------------------- | ---------- | ------------------------- | -------------------------------------------------------------------------------------------- |
| `compliance`       | Commercial | edition $799 (ADR-0227); edition-only, ADR-0238 | Compliance | substantial               | evidence collectors, SOC2/HIPAA/EU-AI-Act frameworks, pack-format + Ed25519/RFC-3161 signing |
| `field-crypto` †   | Commercial | à la carte $199                                 | Compliance | built                     | per-tenant HKDF + AES-256-GCM envelope + crypto-shred                                        |
| `audit-worm` †     | Commercial | à la carte $149                                 | Compliance | substantial               | SHA-256 hash-chain WORM store + S3 ObjectLock adapter                                        |
| `alerting`         | Commercial | à la carte $149                                 | Compliance | built (Stage-2, ADR-0150) | SOC2 CC7.2 alert pipeline (dedup → rate-cap → quiet-hours → deliver → audit)                 |
| `retention-runner` | Commercial | à la carte $199                                 | Compliance | built (Stage-2, ADR-0151) | CCPA/GDPR erasure runner (purge → cascade-delete → orphan-sweep → audit)                     |

### Commercial — AI Production Kit edition ($599) + members

| Package             | License    | Sold as                               | Edition           | Build status             | Owns                                                               |
| ------------------- | ---------- | ------------------------------------- | ----------------- | ------------------------ | ------------------------------------------------------------------ |
| `ai-kit`            | Commercial | edition $599 (edition-only, ADR-0238) | AI Production Kit | partial                  | inference gateway composing the 4 members below                    |
| `ai-meter` †        | Commercial | à la carte $199                       | AI Production Kit | substantial              | PG-atomic token metering + per-tenant spend caps + circuit breaker |
| `ai-evals` †        | Commercial | à la carte $199                       | AI Production Kit | substantial (thin tests) | eval harness + CI gate                                             |
| `guardrails` †      | Commercial | à la carte $149                       | AI Production Kit | substantial              | input/output moderation + PII redaction                            |
| `prompt-registry` † | Commercial | à la carte $99                        | AI Production Kit | substantial              | versioned prompt registry + golden-pinned render                   |

### Commercial — Agentic-Dev edition ($249) + members

| Package          | License    | Sold as                               | Edition     | Build status     | Owns                                                                           |
| ---------------- | ---------- | ------------------------------------- | ----------- | ---------------- | ------------------------------------------------------------------------------ |
| `agent-dev`      | Commercial | edition $249 (edition-only, ADR-0238) | Agentic-Dev | substantial      | typed agent/skill/rule schema + lifecycle + multi-harness emitter              |
| `agent-kernel` † | Commercial | à la carte $199                       | Agentic-Dev | substantial      | governed engine-neutral agent kernel                                           |
| `agent-runner` † | Commercial | à la carte $49                        | Agentic-Dev | built (ADR-0186) | sandboxed, governed agent execution (worktree isolation, auditable transcript) |

### Commercial — Local-first AI edition ($349) + members

| Package         | License    | Sold as                               | Edition        | Build status | Owns                                                                      |
| --------------- | ---------- | ------------------------------------- | -------------- | ------------ | ------------------------------------------------------------------------- |
| `local-ai`      | Commercial | edition $349 (edition-only, ADR-0238) | Local-first AI | substantial  | compute seam, privacy gate, sqlite-vec ANN, offline license, two-way sync |
| `local-store` † | Commercial | à la carte $99                        | Local-first AI | substantial  | local canonical store, file-per-tenant hybrid FTS5+vec                    |

### Commercial — bundle-only substrate (never a standalone SKU)

`license-verify`, `cli`, and `migrate` moved out of this table — ADR-0136 flipped them to Apache-2.0
open Base substrate (§1's first table). Remaining bundle-only commercial rows:

| Package          | License                                   | Sold as                                                         | Edition | Build status | Owns                                                                           |
| ---------------- | ----------------------------------------- | --------------------------------------------------------------- | ------- | ------------ | ------------------------------------------------------------------------------ |
| `license-issue`  | Commercial, **private** (never published) | not sold — operator-only issuer service code                    | n/a     | built        | Ed25519 issuer, holds the signing key (ADR-0110)                               |
| `pricebook`      | Commercial                                | bundle-only substrate (backs every purchase's price resolution) | n/a     | built        | plan/action price books + credit-conversion (ADR-0089/0098)                    |
| `platform-reads` | Commercial                                | bundle-only substrate (dashboard-internal)                      | n/a     | built        | typed read-only queries over `services/license` tables for the buyer dashboard |

### Commercial — services (infra, not packages; never individually sold)

| Path                   | License                                                 | Sold as                                                                                                                     | Build status        | Owns                                                                                                                                                                                                                                      |
| ---------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `registry/`            | Commercial (`private`)                                  | service — the registry SERVICE (CI index build + gated publish + Cloudflare Worker read-path); re-exports `registry-schema` | built (Worker LIVE) | offline-license entitlement-filtered index serving (ADR-0047/0071)                                                                                                                                                                        |
| `services/license`     | Commercial (`private`)                                  | service — billing + entitlement engine behind every purchase                                                                | built               | invoice→credit-grant mapper, entitlement store/resolver, Ed25519 issuer HTTP surface, revoke/one-time/clawback, Paddle buyer-webhook mount (sole rail, ADR-0200) + post-grant Discord role push (ADR-0203) (ADR-0089/0110–0113/0200/0201) |
| `services/docs`        | Commercial (`private`)                                  | service — AI-native docs corpus + retrieval, powers support-bot RAG                                                         | built · DEPLOYED    | chunked corpus + `llms.txt` + `POST /query` over `@caisson/local-store`                                                                                                                                                                   |
| `services/support-bot` | Commercial (`LicenseRef-Caisson-Commercial`, pyproject) | service — Discord support automation                                                                                        | built · DEPLOYED    | RAG-grounded `/ask` + AI-brief escalation + member management + authed `/billing-grant` entitlement→role push (ADR-0009/0105/0109/0203)                                                                                                   |

### Apps (not sold — storefront/reference/internal)

| Path              | License            | Sold as                                                             | Build status                                                                       | Owns                                              |
| ----------------- | ------------------ | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------- |
| `apps/site`       | (unset, `private`) | app — the marketing site + docs + buyer dashboard/storefront itself | shipped (static, CF Pages) · unified Railway dashboard app **built, not deployed** | the delivery vehicle, not a product SKU           |
| `apps/admin`      | (unset, `private`) | app — operator control-plane (absorbed `apps/studio`, ADR-0140)     | shipped (live at admin.caisson.sh)                                                 | not distributed to buyers                         |
| `apps/base`       | (unset, `private`) | app — P1 reference wiring                                           | shipped                                                                            | reference/demo, not part of the buyer deliverable |
| `apps/compliance` | (unset, `private`) | app — P2 reference app                                              | partial                                                                            | reference/demo                                    |
| `apps/ai-kit`     | (unset, `private`) | app — P3 reference app                                              | partial                                                                            | reference/demo                                    |
| `apps/local-ai`   | (unset, `private`) | app — P4a reference app                                             | partial                                                                            | reference/demo                                    |
| `apps/agent-dev`  | (unset, `private`) | app — P4b reference app                                             | partial                                                                            | reference/demo                                    |

### Tooling (never sold — internal dev-time infra)

| Path                     | License            | Sold as      | Owns                                                                                        |
| ------------------------ | ------------------ | ------------ | ------------------------------------------------------------------------------------------- |
| `tooling/eslint-config`  | (unset, `private`) | free tooling | shared eslint config                                                                        |
| `tooling/tsconfig`       | (unset, `private`) | free tooling | shared tsconfig                                                                             |
| `tooling/testing`        | (unset, `private`) | free tooling | shared test harness (PGlite etc.)                                                           |
| `tooling/standards-gate` | (unset, `private`) | free tooling | the ONE license/manifest/boundary/AGPL gate (ADR-0022; enforces this doc's open-core split) |
| `tooling/design-critic`  | (unset, `private`) | free tooling | design-quality gate CLI (ADR-0101)                                                          |

---

## 2b. Sellable catalog (matches the PRICE_SOT exactly)

**Pricing note:** the numbers below are the operator's **2026-06-30 (this session)** lock — the current
pricing SOT — and **supersede** `ADR-0129`'s edition-level figures (Compliance $2,499→$749, Agentic-Dev
$499→$249, Local-first $399→$349, Everything Bundle $2,999→$1,499). **All 12 module-level prices are
unchanged from ADR-0129** (`ai-kit` $149 through `agent-dev` $99 below), and the 2 new ADR-0135 modules
(`alerting`, `retention-runner`) get their first price here. **Not yet captured in an ADR** — this table
is the record until one lands; log the fork on `docs/state/decisions-and-forks.md` if it needs to reopen.

### Editions + bundle

| SKU                   | Price                                   | What it is                                                       | Build status                               |
| --------------------- | --------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------ |
| **Compliance** (hero) | **$799** (ADR-0227)                     | SOC2/HIPAA/EU-AI-Act evidence + WORM audit + field crypto        | substantial (P2, partial per build-state)  |
| **AI Production Kit** | **$599**                                | metering + evals + guardrails + prompt registry behind a gateway | partial (P3)                               |
| **Local-first AI**    | **$349**                                | on-device inference + hybrid local store                         | substantial (P4a, partial per build-state) |
| **Agentic-Dev**       | **$249**                                | governed agent kernel + multi-harness emitter                    | substantial (P4b, partial per build-state) |
| **All-Access Bundle** | **$1,499** (25% off edition-sum $1,996) | all four editions                                                | n/a — composite of the four rows above     |

**Resolved (was: the $749 launch-sum wrinkle):** superseded by **ADR-0227** (Compliance edition
repriced **$799**, below-sum invariant kept) and **ADR-0238** (the `compliance` core row no longer
sells à la carte); `alerting`/`retention-runner` shipped in Stage-2 (ADR-0150/0151), so the
zero-code-harvest caveat is dead. The historical wrinkle text lives in git history.

### 11 à la carte modules (ADR-0238, 2026-07-03)

**The four edition-core rows (`compliance` $299 · `ai-kit` $149 · `local-ai` $299 · `agent-dev` $99)
were DROPPED from the à-la-carte catalog (ADR-0238):** their bare ids named their own edition's
entitlement id, so a module purchase silently expanded to the whole parent edition — and no separable
core artifact exists to grant instead (each edition meta-package hard-depends on its commercial
members). Editions are how composition is bought; à la carte sells only the standalone modules below.
Their four Paddle SANDBOX products sit orphaned (sandbox never ports to production, ADR-0227). The
per-row price NUMBERS below are unchanged.

| Module              | Price | Edition           | Build status              |
| ------------------- | ----- | ----------------- | ------------------------- |
| `field-crypto` †    | $199  | Compliance        | built                     |
| `audit-worm` †      | $149  | Compliance        | substantial               |
| `alerting`          | $149  | Compliance        | built (Stage-2, ADR-0150) |
| `retention-runner`  | $199  | Compliance        | built (Stage-2, ADR-0151) |
| `ai-meter` †        | $199  | AI Production Kit | substantial               |
| `ai-evals` †        | $199  | AI Production Kit | substantial               |
| `guardrails` †      | $149  | AI Production Kit | substantial               |
| `prompt-registry` † | $99   | AI Production Kit | substantial               |
| `agent-kernel` †    | $199  | Agentic-Dev       | substantial               |
| `agent-runner`      | $49   | Agentic-Dev       | built (ADR-0186)          |
| `local-store` †     | $99   | Local-first AI    | substantial               |

Thin base seams (`ai-config`, `tenancy-rls`, `jobs`, `email`) are **never** individually sold — bundle-
only by ADR-0129 §3, and now also **free/open** anyway (ADR-0094).

---

## 3. Open-core split (the license invariant)

**Open (Apache-2.0, 15 packages):** the full list in §1's first table — the free discovery/trust
substrate every buyer (and every non-buyer) can use unrestricted. Includes `cli`, `migrate`, and
`license-verify`, flipped commercial→Apache-2.0 by ADR-0136.

**Commercial (`LicenseRef-Caisson-Commercial`, everything else under `packages/`, `services/`,
`registry/`):** the 4 editions + their 12 built member modules, the 2 pending ADR-0135 modules, the
compliance primitives, the registry service, every commercial base-kind package
(`pricebook`/`license-issue`/`platform-reads`), and all three services.

**The invariant (ADR-0094/0097):** an open package may depend only on other open packages — the open
Base must resolve against open deps alone. Enforced in code by two standards-gate checks
(`tooling/standards-gate/src/checks.ts`): `checkOpenCoreLicensing` (every module ships the license its
tier mandates) and `checkOpenCommercialBoundary` (an Apache-2.0 package's workspace deps must all
themselves be Apache-2.0, checked by actual SPDX `license` field, not a name allowlist — self-correcting
if the open set changes). Commercial → open is always allowed; open → commercial is a CI-blocking error.

**Code-truth addendum — the registry free-base floor (ADR-0136).** The Worker's `baseModuleIds`
(`packages/registry-schema/src/entitlements.ts`) was previously keyed on `editions: []` rather than
`license === "Apache-2.0"`, which over-served the **† 8 sellable modules** flagged throughout this doc
(`field-crypto`, `ai-meter`, `audit-worm`, `ai-evals`, `guardrails`, `prompt-registry`, `local-store`,
`agent-kernel`) for free. ADR-0136 re-keys the floor on `license === "Apache-2.0"` (built on this
branch), closing that leak; the live deployed Worker un-gates at deploy. ADR-0136 also flips `cli`,
`migrate`, and `license-verify` to Apache-2.0, so they are now legitimately open — leaving `pricebook`
as the only commercial base-kind package intentionally served free (never had a standalone price to
protect).

---

## 4. Not sold / why

- **The 15-package open Base** — never sold. Per ADR-0094 (extended by ADR-0136), it is the **trust +
  acquisition layer**: table-stakes substrate (auth/RLS/billing/credits/jobs/email/config/MCP-transport/
  UI/registry-contract/observability) plus the installer/migrator/verifier tooling
  (`cli`/`migrate`/`license-verify`) with **no compliance, AI, or evidence value on its own**. Giving it
  away removes the friction of a free-boilerplate undercut (ShipFast/t3-class competitors) while the
  actual moat — the editions, the compliance primitives, the registry service, and update subscriptions —
  stays commercial.
- **`tooling/*`** — never sold, never even licensed for external use (all 5 are `private` with no
  `license` field). Build-time/dev-time infra only (eslint config, tsconfig, test harness, the
  standards-gate itself, the design-quality critic); none of it ships into a buyer's generated repo.
- **`apps/*`** — never sold. `apps/site` is the storefront/delivery vehicle, not a product; `apps/admin`
  is the internal operator control-plane (absorbed the `apps/studio` design tool, ADR-0140); the 5
  edition reference apps (`apps/{base,compliance,ai-kit,local-ai,
agent-dev}`) demonstrate wiring for VERIFY/SWEEP evidence, not buyer deliverables.
- **`registry/`, `services/*`** — infrastructure the operator runs to fulfill every sale (the Worker
  serves the index, `services/license` processes payment/entitlement, `services/docs` +
  `services/support-bot` run buyer support) — never themselves an installable/purchasable SKU.

## 5. Cross-links

- **Build-status depth** (LOC, test counts, seams, honest gaps, phase P0–P7 status): `docs/build-state.md`
- **Live decision board** (open forks, incl. the $749 launch-sum sub-flag above): `docs/state/decisions-and-forks.md`
- **Pricing methodology + full competitive comparables**: `knowledge/decisions/ADR-0129-pricing-packaging-value-based-modules.md`
- **As-if-built storefront availability** (why all 19 SKUs show regardless of code-completeness): `knowledge/decisions/ADR-0130-storefront-as-if-built-availability.md`
- **Open-core license split**: `knowledge/decisions/ADR-0094-open-core-base-apache2.md`, `knowledge/decisions/ADR-0097-registry-schema-service-split.md`
- **Registry Worker entitlement filtering**: `knowledge/decisions/ADR-0047-registry-readpath-worker-seam.md`
- **New Compliance modules (pending)**: `knowledge/decisions/ADR-0135-new-compliance-modules-alerting-retention.md`, sequencing in `docs/state/harvest-program.md`
- **Sibling docs from this session**: `docs/state/refactor-split-opportunities.md` (package-split candidates), `docs/state/public-surface-minimization.md` (public-surface reduction)
