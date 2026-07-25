---
updated: 2026-07-22
status: live
grounds:
  - packages/
---

# Package catalog — license, sold-as, price

Dated **2026-07-06** (the ADR-0257/0258/0259/0260 catalog-rework: the four editions
**dissolved into six bundles** — Compliance · AI-Production · Local-first · Agentic-Dev ·
Provenance (net-new) · Everything; supersedes the 2026-07-05 rate-limit-row sweep). This
file OWNS the **public-vs-commercial + sold-as + price** view: for every
package/service/app/tooling workspace in the monorepo — is it Apache-2.0 or commercial, is it sold at
all, as what (bundle / à la carte module / bundle-only substrate / free tooling / app / service), and
for how much. `docs/build-state.md` OWNS the deep build-status view (LOC/test counts, seams, honest
gaps, phase status) — this file cites its verdicts, never restates the prose. On any conflict between
the two, `build-state.md` wins on **build status**; this file wins on **license/price/sold-as**.

## SOT hierarchy (this file's place in it)

Per root `CLAUDE.md`: **1)** `docs/state/decisions-and-forks.md` — the live open/locked fork board
(wins on any open decision) → **2)** `knowledge/decisions/` ADRs (append-only, the locked record) →
**3)** `specs/` (locked concept docs) → **4)** `docs/build-state.md` (the founding `plan.md`/`SUMMARY.md` → `docs/archive/`) → **5)** `outputs/` (session
artifacts). This file and `docs/build-state.md` are both **catalog views derived from that hierarchy**,
not primary sources — they sit alongside the archived plan/SUMMARY (`docs/archive/`) in the reading order, synthesizing #1/#2
into a table. Two older root-level docs, [`docs/packages.md`](../packages.md) and
[`docs/archive/editions.md`](../archive/editions.md), predate open-core (ADR-0094/0097), the P6 commerce build, and the
ADR-0129/0130 pricing round — they are **stale on license and price** (still show all-commercial + the
ADR-0082/ADR-0106 point-values, and the retired "edition" vocabulary) and are superseded by this file for
that view; they are not deleted or edited here (out of scope for this task).

**Method:** license + sold-as/price are derived from **disk truth** — every `packages/*/package.json`,
`services/*/package.json`, `registry/package.json`, and `services/support-bot/pyproject.toml` `license`
field, read directly (not an embedded list), cross-checked against the standards-gate's own enforced
allowlist (`tooling/standards-gate/src/checks.ts` `OPEN_BASE_NAMES` + `checkOpenCoreLicensing`/
`checkOpenCommercialBoundary`). Prices are locked in **ADR-0257** (catalog-rework SPEC, bundle schema,
and the alias map), **ADR-0258** (pricing consequences: Local-first 3-way carve, AI-Production
recompute, Everything full-catalog), **ADR-0259** (ui-pro SPEC), and **ADR-0260**
(pricing-revalidation + renewal cents), mirrored in `apps/site/lib/pricing.ts`
(`BUNDLE_PRICES`/`MODULE_PRICES`, the display SOT) and `packages/pricebook/src/upgrades.ts`
(`BUNDLE_RETAIL`/`SKU_RETAIL`, the price authority `pricing.test.ts` pins both against) — see the
pricing note under §2b.

---

## 1. Master catalog

**Legend (build status, from `docs/build-state.md`):** **shipped** = real impl + green tests, wired
into a consumer, no known un-built seam · **substantial**/**built** = real impl + tests, some
un-exercised live transports or thin coverage (see build-state for the seam) · **partial** = merged,
real code + tests, un-exercised live transports or no recorded VERIFY/SWEEP · **pending** = scaffold
only or, for a not-yet-built module, **zero code, document-only lock**.

**`kind` note (registry manifests, ADR-0257 §1):** the four persona bundles that got a **new** id
(`ai-production`, `local-first`, `agentic-dev`, plus net-new `provenance` and whole-catalog
`everything`) each carry a fresh `kind:"bundle"` meta-package. **Compliance kept its existing id**, so
there is no sibling package — `@caisson/compliance`'s own manifest still declares `kind:"edition"`
(ADR-0257 §1 locks "no historical ledger rewrite" for this reason: the 20 pre-rework `kind:"edition"`
entries stay valid forever, never migrated). The three edition packages a new bundle id fully
supersedes (`ai-kit`, `agent-dev`, `local-ai`) also keep their `kind:"edition"` manifests, now retired
from sale — see the dedicated section below.

**† = one of the 8 pre-rework commercial modules that the registry Worker previously over-served FREE.**
License-keyed gating (ADR-0136) shipped to production and was independently **VERIFIED live 2026-07-05**
(`docs/archive/public-surface-minimization.md`) — an anonymous fetch of `GET /index.json` and
`GET /modules/:id` for all 8 now 404s fail-closed; see §3 note. The marker is historical
(pre-catalog-rework) and is not extended to the new carve/platform SKUs below — their Worker-gating
status is untracked by this note (out of scope for this pass). Full build-status prose for any row:
`docs/build-state.md` (search the package name).

### Open Base substrate (Apache-2.0) — 16 packages

| Package           | License    | Sold as                                                       | Edition     | Build status          | Owns                                                                                                                                                                                         |
| ----------------- | ---------- | ------------------------------------------------------------- | ----------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kernel`          | Apache-2.0 | bundle-only substrate — free, ships with every install        | Base (open) | built                 | config/schema/error model, SHA-256 chain, credit denomination (ADR-0098)                                                                                                                     |
| `auth`            | Apache-2.0 | free                                                          | Base (open) | built                 | session/RLS seam                                                                                                                                                                             |
| `tenancy-rls`     | Apache-2.0 | free                                                          | Base (open) | built (thin)          | fail-closed RLS guard                                                                                                                                                                        |
| `billing`         | Apache-2.0 | free                                                          | Base (open) | built                 | Stripe MoR + webhook events (buyer-side driver; platform billing is Paddle, ADR-0116); the multi-provider orchestration layer carved out commercial as `billing-orchestration` (ADR-0249 G3) |
| `jobs`            | Apache-2.0 | free                                                          | Base (open) | built (thin)          | job seam                                                                                                                                                                                     |
| `email`           | Apache-2.0 | free                                                          | Base (open) | built (thin)          | email seam                                                                                                                                                                                   |
| `ai-config`       | Apache-2.0 | free                                                          | Base (open) | built (thin)          | provider-agnostic AI config                                                                                                                                                                  |
| `mcp-server`      | Apache-2.0 | free (open transport; the commercial value it gates is not)   | Base (open) | built                 | auth-gated buyer MCP transport + rate-limit hook (ADR-0112)                                                                                                                                  |
| `ui`              | Apache-2.0 | free                                                          | Base (open) | built                 | token floor (ADR-0042/0078); the premium `ui-pro` component layer sits above it (§ below)                                                                                                    |
| `registry-schema` | Apache-2.0 | free                                                          | Base (open) | built                 | open registry contract split from `@caisson/registry` (ADR-0097); the bundle vocabulary + alias map (ADR-0257)                                                                               |
| `observability`   | Apache-2.0 | free                                                          | Base (open) | built                 | vendor-neutral OTel bootstrap (ADR-0117; see note below)                                                                                                                                     |
| `cli`             | Apache-2.0 | bundle-only substrate — free, ships with every generated repo | Base (open) | built (full P5 drive) | `create-caisson` index gate, templated engine, `runGeneration`, migration bundler (Apache-2.0 per ADR-0136)                                                                                  |
| `migrate`         | Apache-2.0 | bundle-only substrate — free, ships with every generated repo | Base (open) | built                 | the one migration assembler + runner + file-emit (ADR-0090/0091; Apache-2.0 per ADR-0136)                                                                                                    |
| `license-verify`  | Apache-2.0 | bundle-only substrate — free, ships with every generated repo | Base (open) | substantial           | offline Ed25519 license verification (Apache-2.0 per ADR-0136)                                                                                                                               |
| `rate-limit`      | Apache-2.0 | free                                                          | Base (open) | built                 | per-IP token-bucket limiter + per-account store, extracted from services/docs + services/license (R1+R2, PR #119)                                                                            |
| `analytics`       | Apache-2.0 | free/open, never individually sold                            | Base (open) | built                 | vendor-neutral `AnalyticsProvider` port + capture/Plausible/PostHog/GA4 drivers, fail-open by design (ADR-0287)                                                                              |

**Note:** `observability`, `cli`, `migrate`, `license-verify`, `rate-limit`, and `analytics` join the
ADR-0094/0097 base-11 to bring the enforced-open total to **16** (`tooling/standards-gate/src/checks.ts`
`OPEN_BASE_NAMES`). **`credits` is NOT in this set** — flipped open→commercial by operator override
(ADR-0249 G5) and priced under AI-Production below.

### Commercial — Compliance bundle ($1,449) + members

| Package             | License    | Sold as                                                                                                       | Bundle(s)                                          | Build status                          | Owns                                                                                                                                    |
| ------------------- | ---------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `compliance`        | Commercial | bundle hero package — **$1,449** (ADR-0373, the compliance-gap join reprice; supersedes ADR-0258 §3's $1,049) | Compliance (self)                                  | substantial                           | evidence collectors, SOC2/HIPAA/EU-AI-Act frameworks, pack-format + Ed25519/RFC-3161 signing — now composes the three carved SKUs below |
| `compliance-core`   | Commercial | à la carte $299 (ADR-0257 §3 carve)                                                                           | Compliance                                         | built (commercial carve, ADR-0257 §1) | RLS-force evidence collector + isolation tests + SOC2/HIPAA evidence-pack generator                                                     |
| `frameworks-pack`   | Commercial | à la carte $249 (ADR-0257 §3 carve)                                                                           | Compliance                                         | built (commercial carve, ADR-0257 §1) | SOC2/HIPAA/EU-AI-Act control mappings + OSCAL v1.2.2 export                                                                             |
| `signing-primitive` | Commercial | à la carte $199 (ADR-0257 §3 carve)                                                                           | Compliance, Provenance                             | built (commercial carve, ADR-0257 §1) | detached Ed25519 + RFC-3161 evidence signing                                                                                            |
| `field-crypto` †    | Commercial | à la carte $199                                                                                               | Compliance, AI-Production, Local-first, Provenance | built                                 | per-tenant HKDF + AES-256-GCM envelope + crypto-shred                                                                                   |
| `audit-worm` †      | Commercial | à la carte $149                                                                                               | Compliance, Provenance                             | substantial                           | SHA-256 hash-chain WORM store + S3 ObjectLock adapter                                                                                   |
| `alerting`          | Commercial | à la carte $149                                                                                               | Compliance                                         | built (Stage-2, ADR-0150)             | SOC2 CC7.2 alert pipeline (dedup → rate-cap → quiet-hours → deliver → audit)                                                            |
| `retention-runner`  | Commercial | à la carte $199                                                                                               | Compliance                                         | built (Stage-2, ADR-0151)             | CCPA/GDPR erasure runner (purge → cascade-delete → orphan-sweep → audit)                                                                |
| `access-review`     | Commercial | à la carte $199 (ADR-0373 first price)                                                                        | Compliance                                         | built (ADR-0371)                      | per-user access-review campaigns: reviewer attestation + WORM-logged approve/revoke decisions                                           |
| `risk-register`     | Commercial | à la carte $279 (ADR-0373 first price)                                                                        | Compliance                                         | built (ADR-0371)                      | EU-AI-Act-aligned AI risk register: computed residual risk + byte-stable treatment-plan artifact                                        |
| `trust-page`        | Commercial | à la carte $149 (ADR-0373 first price)                                                                        | Compliance                                         | built (ADR-0371)                      | customer-facing trust/compliance status page, pure-rendered from evidence-pack posture (allowlist redaction)                            |

`@caisson/compliance`'s manifest republished `kind:"bundle"` at $1,049 (CAISSON-24, 2026-07-06) —
historical `kind:"edition"` ledger entries stay valid forever per ADR-0257 §1 (no ledger rewrite).

### Commercial — AI-Production bundle ($739) + members

| Package             | License    | Sold as                                                                            | Bundle(s)            | Build status             | Owns                                                                                                                                                                                                                                                           |
| ------------------- | ---------- | ---------------------------------------------------------------------------------- | -------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ai-production`     | Commercial | bundle hero package — **$739** (ADR-0258 §2; recomputed after the credits fold-in) | AI-Production (self) | partial                  | metered `infer()` gateway composing the 4 members below + credits                                                                                                                                                                                              |
| `ai-meter` †        | Commercial | à la carte $199                                                                    | AI-Production        | substantial              | PG-atomic token metering + per-tenant spend caps + circuit breaker                                                                                                                                                                                             |
| `ai-evals` †        | Commercial | à la carte $199                                                                    | AI-Production        | substantial (thin tests) | eval harness + CI gate — folded into the bundle proper by ADR-0258 §2 (`standaloneOnly` dropped; it was never a legacy `ai-kit` member)                                                                                                                        |
| `guardrails` †      | Commercial | à la carte $149                                                                    | AI-Production        | substantial              | input/output moderation + PII redaction                                                                                                                                                                                                                        |
| `prompt-registry` † | Commercial | à la carte $99                                                                     | AI-Production        | substantial              | versioned prompt registry + golden-pinned render                                                                                                                                                                                                               |
| `credits`           | Commercial | à la carte $149                                                                    | AI-Production        | built                    | integer wallet + append-only ledger + 402 + grant-level expiry with FIFO burn (ADR-0252) — **flipped open→commercial by operator override (ADR-0249 G5)**, decoupled from the `cli` codegen-debit gate first, then joined AI-Production at price (ADR-0258 §2) |

### Commercial — Local-first bundle ($629) + members

| Package           | License    | Sold as                                                        | Bundle(s)                | Build status                          | Owns                                                                                                                 |
| ----------------- | ---------- | -------------------------------------------------------------- | ------------------------ | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `local-first`     | Commercial | bundle hero package — **$629** (ADR-0258 §1, full 3-way carve) | Local-first (self)       | substantial                           | compute seam, privacy gate, sqlite-vec ANN, offline license, two-way sync — now composes the three carved SKUs below |
| `local-store` †   | Commercial | à la carte $99                                                 | Local-first, Agentic-Dev | substantial                           | local canonical store, file-per-tenant hybrid FTS5+vec                                                               |
| `local-sync`      | Commercial | à la carte $199 (ADR-0258 §1 carve)                            | Local-first              | built (commercial carve, ADR-0258 §1) | two-way offline sync: changesets/tombstones/logical clock/reconcile + convergence test                               |
| `local-inference` | Commercial | à la carte $249 (ADR-0258 §1 carve)                            | Local-first              | built (commercial carve, ADR-0258 §1) | InferenceBackend seam over hash-verified ONNX via transformers.js                                                    |
| `local-privacy`   | Commercial | à la carte $99 (ADR-0258 §1 carve)                             | Local-first              | built (commercial carve, ADR-0258 §1) | default-deny egress gate, typed allowlist                                                                            |

Engineering order was locked binding (ADR-0258 §1): privacy extracted first (down-only), inference's 5
import sites repointed, sync last.

### Commercial — Agentic-Dev bundle ($329) + members

| Package            | License    | Sold as                                                           | Bundle(s)          | Build status                   | Owns                                                                                                                                        |
| ------------------ | ---------- | ----------------------------------------------------------------- | ------------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `agentic-dev`      | Commercial | bundle hero package — **$329** (ADR-0258; ADR-0257 §1 vocabulary) | Agentic-Dev (self) | substantial                    | typed agent/skill/rule schema + lifecycle + multi-harness emitter — now composes `tool-exec`                                                |
| `agent-kernel` †   | Commercial | à la carte $199                                                   | Agentic-Dev        | substantial                    | governed engine-neutral agent kernel                                                                                                        |
| `agent-runner`     | Commercial | à la carte $49                                                    | Agentic-Dev        | built (ADR-0186)               | sandboxed, governed agent execution (worktree isolation, auditable transcript)                                                              |
| `agent-trajectory` | Commercial | à la carte $49 (2026-07-18 catalog debut)                         | Agentic-Dev        | built (ADR-0349/0351, slice 1) | engine-neutral trajectory contract: append-only `.strict()` event schema, digest-ref payloads, replay projection, claude-transcript adapter |
| `tool-exec`        | Commercial | à la carte $99 (ADR-0260 first price)                             | Agentic-Dev        | built (Stage-2, ADR-0153)      | governed tool-execution gate: default-deny allowlist over Zod-strict argv schemas + execFile arg-arrays                                     |

`local-store` (member of both Local-first and Agentic-Dev) is listed once, under Local-first above.

### Commercial — Provenance bundle ($399) + members (net-new, ADR-0257 §1)

| Package      | License    | Sold as                                                                         | Bundle(s)         | Build status    | Owns                                                                                                    |
| ------------ | ---------- | ------------------------------------------------------------------------------- | ----------------- | --------------- | ------------------------------------------------------------------------------------------------------- |
| `provenance` | Commercial | bundle hero package — **$399** (ADR-0260 §3; revalidated unchanged by ADR-0258) | Provenance (self) | n/a — composite | cryptographic provenance: detached signing + append-only WORM audit chain + per-tenant field encryption |

Provenance's three creditable members — `signing-primitive` ($199), `audit-worm` ($149), and
`field-crypto` ($199) — are strict subsets of the Compliance carve and are listed once each, under
Compliance above (ADR-0258 §3: Provenance is "$0-incremental" against Compliance's member sum).

### Commercial — Everything bundle ($2,059) — the full catalog

| Package      | License    | Sold as                                                                           | Bundle(s)         | Build status    | Owns                                                                                                             |
| ------------ | ---------- | --------------------------------------------------------------------------------- | ----------------- | --------------- | ---------------------------------------------------------------------------------------------------------------- |
| `everything` | Commercial | bundle hero package — **$2,059** (ADR-0258 §3, 0.75 × Σ the four persona bundles) | Everything (self) | n/a — composite | every sellable SKU, one purchase (ADR-0258 §3 — the **only** exclusion is `@caisson/brand`, private, never sold) |

Everything's 22 member modules are every row in §2b's à-la-carte table below — not repeated here.

### Commercial — platform / standalone modules (à la carte; Everything-only, no persona bundle)

| Package                 | License    | Sold as                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Bundle(s)       | Build status                                                                                                                        | Owns                                                                                                                                                                                                                                  |
| ----------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `org-controls`          | Commercial | à la carte $249 (ADR-0257 §3 merged org module; ADR-0260 price)                                                                                                                                                                                                                                                                                                                                                                                            | Everything only | built (commercial carve, ADR-0257 §1)                                                                                               | WorkOS SSO + the owner-gated multi-user membership surface + the full 6-export tenancy-rls admin-write layer, entitlement-gated onto `/dashboard/members`                                                                             |
| `billing-orchestration` | Commercial | à la carte $99 (ADR-0249 G3 carve; ADR-0260 price)                                                                                                                                                                                                                                                                                                                                                                                                         | Everything only | built (commercial carve, ADR-0257 §1)                                                                                               | multi-provider `BillingProvider` port (Paddle/Stripe/LemonSqueezy/Polar) + idempotent webhook fulfillment                                                                                                                             |
| `ui-pro`                | Commercial | à la carte $129 — **SOLD live** (a real `PURCHASE_BOOK` row + Paddle price id in `apps/site/lib/catalog.ts`) and **PUBLISHED** (PR #142, 2026-07-07): `@caisson/ui-pro@0.1.0` in the registry index, `RESERVED_MODULE_ENTITLEMENT_IDS` emptied at graduation, everything@0.2.2 pins `ui-pro: 0.1.0`. A purchase resolves through the ordinary indexed-module branch of `expandEntitlements`; an unindexed ui-pro would now fail closed like any unknown id | Everything only | published @0.1.0 (PR #142; Worker republish at the 45-entry index EXECUTED 2026-07-07, version `51be4302` — `docs/deploy/STATE.md`) | premium `@caisson/ui` component layer (11 components): DataTable-Pro · Tree-Pro · Ops Matrix · Audit Timeline · Payload Viewer · Type-to-Confirm · Adv Date-Range Picker · Charts Pack · Command Palette · Diff Viewer · Kanban Board |

### Commercial — retired legacy edition packages (no longer sold; registry ledger kept forever)

The Paddle big-bang (ADR-0258 §5) retired all four edition products in one sweep; the edition-trace
purge (**ADR-0270**, 2026-07-07) then removed the legacy purchase ids entirely —
`LEGACY_ENTITLEMENT_ALIASES` (`packages/registry-schema/src/bundle-vocabulary.ts`) is now EMPTY
(kept as the mechanism for a future module rename), gated on zero real buyers with live rows
drained at deploy (proven empty 2026-07-07). The bundle-only index republish (**ADR-0271**,
2026-07-07) then DELISTED the three edition meta-packages from the served index: their publish
history and tarball provenance stay in the append-only ledger (ADR-0006), but they contribute no
index entry, no bundle-expansion member, and no resolvable purchase id — a bare edition id now
fail-closes to the free base floor at every consumer. `compliance` kept its id (never a purge
target — see the Compliance section above).

| Package     | License    | Sold as                                                                                                                                                             | Superseded by        | Build status | Note                                                                                                                                                                                           |
| ----------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ai-kit`    | Commercial | **retired** — no Paddle product; purchase id `ai-kit` purged (ADR-0270, unresolvable); index entry DELISTED (ADR-0271) — ledger history retained, nothing served    | AI-Production bundle | partial      | `priceCents: 73900` ($739) trued to the alias-target bundle price (2026-07-06, the `local-ai` convention; PRICE_AUTHORITY row added) — the ADR-0249 G7 placeholder exception no longer applies |
| `agent-dev` | Commercial | **retired** — no Paddle product; purchase id `agent-dev` purged (ADR-0270, unresolvable); index entry DELISTED (ADR-0271) — ledger history retained, nothing served | Agentic-Dev bundle   | substantial  | `priceCents: 32900` ($329) trued to the alias-target bundle price (2026-07-06, the `local-ai` convention; PRICE_AUTHORITY row added) — the ADR-0249 G7 placeholder exception no longer applies |
| `local-ai`  | Commercial | **retired** — no Paddle product; purchase id `local-ai` purged (ADR-0270, unresolvable); index entry DELISTED (ADR-0271) — ledger history retained, nothing served  | Local-first bundle   | substantial  | `priceCents: 62900` ($629) IS trued to the new bundle number — the ADR-0249 G7 "stays unpriced" exception no longer covers `local-ai` after its 3-way carve (ADR-0258 §1)                      |

### Commercial — bundle-only substrate (never a standalone SKU)

`license-verify`, `cli`, and `migrate` moved out of this table — ADR-0136 flipped them to Apache-2.0
open Base substrate (§1's first table). Remaining bundle-only commercial rows:

| Package          | License                                   | Sold as                                                                                  | Edition | Build status              | Owns                                                                                                                                                                                                      |
| ---------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------- | ------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `license-issue`  | Commercial, **private** (never published) | not sold — operator-only issuer service code                                             | n/a     | built                     | Ed25519 issuer, holds the signing key (ADR-0110)                                                                                                                                                          |
| `pricebook`      | Commercial                                | bundle-only substrate (backs every purchase's price resolution)                          | n/a     | built                     | plan/action price books + credit-conversion + the F7/F8 bundle-membership timeline and upgrade-credit map (ADR-0089/0098/0247/0257/0258)                                                                  |
| `platform-reads` | Commercial                                | bundle-only substrate (dashboard-internal)                                               | n/a     | built                     | typed read-only queries over `services/license` tables for the buyer dashboard                                                                                                                            |
| `audit-harness`  | Commercial, **private** (never published) | not sold — internal engineering tooling, NON-BLOCKING (ADR-0134)                         | n/a     | built (Stage-2, ADR-0152) | cross-domain audit/validate harness: audit surface manifest + append-only reconciling ledger + workflow-scope guard + the high-risk /validate spine (Challenger port, majority-kills, default-to-refuted) |
| `brand`          | Commercial, **private** (never published) | never sold — the private brand layer (the ONLY id excluded from Everything, ADR-0258 §3) | n/a     | built                     | wordmark + glyph lockup and the 22 bespoke domain glyphs, kept out of the Apache-2.0 `@caisson/ui` floor; apps register them via `registerIcons(brandGlyphs)`                                             |

### Commercial — services (infra, not packages; never individually sold)

| Path                   | License                                                 | Sold as                                                                                                                     | Build status        | Owns                                                                                                                                                                                                                                      |
| ---------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `registry/`            | Commercial (`private`)                                  | service — the registry SERVICE (CI index build + gated publish + Cloudflare Worker read-path); re-exports `registry-schema` | built (Worker LIVE) | offline-license entitlement-filtered index serving (ADR-0047/0071)                                                                                                                                                                        |
| `services/license`     | Commercial (`private`)                                  | service — billing + entitlement engine behind every purchase                                                                | built               | invoice→credit-grant mapper, entitlement store/resolver, Ed25519 issuer HTTP surface, revoke/one-time/clawback, Paddle buyer-webhook mount (sole rail, ADR-0200) + post-grant Discord role push (ADR-0203) (ADR-0089/0110–0113/0200/0201) |
| `services/docs`        | Commercial (`private`)                                  | service — AI-native docs corpus + retrieval, powers support-bot RAG                                                         | built · DEPLOYED    | chunked corpus + `llms.txt` + `POST /query` over `@caisson/local-store`                                                                                                                                                                   |
| `services/support-bot` | Commercial (`LicenseRef-Caisson-Commercial`, pyproject) | service — Discord support automation                                                                                        | built · DEPLOYED    | RAG-grounded `/ask` + AI-brief escalation + member management + authed `/billing-grant` entitlement→role push (ADR-0009/0105/0109/0203)                                                                                                   |

### Apps (not sold — storefront/reference/internal)

| Path              | License            | Sold as                                                             | Build status                                                                                                                                                                              | Owns                                              |
| ----------------- | ------------------ | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `apps/site`       | (unset, `private`) | app — the marketing site + docs + buyer dashboard/storefront itself | shipped · **DEPLOYED** — unified Railway app (Node `standalone`), marketing + docs + buyer dashboard; Cloudflare Pages torn down (`docs/build-state.md` "apps/site … shipped · DEPLOYED") | the delivery vehicle, not a product SKU           |
| `apps/admin`      | (unset, `private`) | app — operator control-plane (absorbed `apps/studio`, ADR-0140)     | shipped (live at admin.caisson.sh)                                                                                                                                                        | not distributed to buyers                         |
| `apps/base`       | (unset, `private`) | app — P1 reference wiring                                           | shipped                                                                                                                                                                                   | reference/demo, not part of the buyer deliverable |
| `apps/compliance` | (unset, `private`) | app — P2 reference app                                              | partial                                                                                                                                                                                   | reference/demo                                    |
| `apps/ai-kit`     | (unset, `private`) | app — P3 reference app                                              | partial                                                                                                                                                                                   | reference/demo                                    |
| `apps/local-ai`   | (unset, `private`) | app — P4a reference app                                             | partial                                                                                                                                                                                   | reference/demo                                    |
| `apps/agent-dev`  | (unset, `private`) | app — P4b reference app                                             | partial                                                                                                                                                                                   | reference/demo                                    |

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

**Pricing note:** the numbers below are the operator's **2026-07-06 catalog-rework** lock —
`apps/site/lib/pricing.ts` (`BUNDLE_PRICES`/`MODULE_PRICES`) is the display SOT; `packages/pricebook/src/upgrades.ts`
(`BUNDLE_RETAIL`/`SKU_RETAIL`) is the price authority both `pricing.test.ts` and the checkout/upgrade-credit
math pin against. They supersede every earlier edition-era figure: **ADR-0227**'s Compliance $799 →
**ADR-0258**'s $1,049 → **ADR-0373**'s $1,449 (the compliance-gap join reprice, 2026-07-20); **ADR-0137**'s AI Production Kit $599 / Agentic-Dev $249 / Local-first AI $349 /
Everything Bundle $1,499 → **ADR-0258/0260**'s $739 / $329 / $629 / $2,059. **Editions are RETIRED**
(dissolved into bundles, ADR-0257) and their purchase ids **purged** (ADR-0270, 2026-07-07) after
proving zero real buyers held them — the alias map (`bundle-vocabulary.ts`) is empty, sandbox/test
grants drain to canonical ids at deploy, and no real buyer's access changed.

### Bundles

| SKU                      | Price                    | What it is                                                                                                                                        | Build status                                  |
| ------------------------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| **Compliance** (hero)    | **$1,449** (ADR-0373)    | SOC2/HIPAA/EU-AI-Act evidence + WORM audit + field crypto + the framework/signing carves + the access-review/risk-register/trust-page gap-closers | substantial (P2, partial per build-state)     |
| **AI-Production**        | **$739** (ADR-0258 §2)   | metering + evals + guardrails + prompt registry + credits behind a gateway                                                                        | partial (P3)                                  |
| **Local-first**          | **$629** (ADR-0258 §1)   | on-device inference + hybrid local store + the sync/inference/privacy 3-way carve                                                                 | substantial (P4a, partial per build-state)    |
| **Agentic-Dev**          | **$329** (ADR-0258)      | governed agent kernel + sandboxed runner + tool-exec gate + multi-harness emitter                                                                 | substantial (P4b, partial per build-state)    |
| **Provenance** (net-new) | **$399** (ADR-0260 §3)   | detached signing + append-only WORM audit chain + per-tenant field encryption                                                                     | n/a — composite of 3 Compliance-carve members |
| **Everything**           | **$2,059** (ADR-0258 §3) | every bundle and every à-la-carte module — the whole catalog, one purchase                                                                        | n/a — composite of every row below            |

**Renewals (flat 40% of list, X9-rounded — ADR-0260 §5 ladder, three numbers superseded by ADR-0258
§4; Compliance moved $419 → $579 with the ADR-0373 reprice):** Compliance **$579** · AI-Production
**$289** · Local-first **$249** · Agentic-Dev **$129** · Provenance **$159** · Everything **$819**.

**Resolved (was: the $749 launch-sum wrinkle):** superseded first by ADR-0227/ADR-0238, then fully
retired by the ADR-0257/0258/0259/0260 catalog rework — the edition-era historical wrinkle text (and
the four edition SKUs it described) live in git history only.

### 26 à la carte modules (ADR-0257/0258/0259/0260, 2026-07-06; +agent-trajectory 2026-07-18; +the ADR-0373 compliance-gap trio 2026-07-20)

Every sellable commercial SKU, individually priced. **Bundle(s)** is the registry-index-pinned
membership (`pricing.ts`'s `bundles[]`, cross-checked by `pricing.test.ts`); an empty cell = a
standalone SKU no persona bundle grants (Everything-only). Grouped below by catalog area, matching
`pricing.ts`'s own section comments.

| Module                  | Price | Bundle(s)                                          | Build status                                                                                                                                |
| ----------------------- | ----- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `compliance-core`       | $299  | Compliance                                         | built (commercial carve, ADR-0257 §1)                                                                                                       |
| `frameworks-pack`       | $249  | Compliance                                         | built (commercial carve, ADR-0257 §1)                                                                                                       |
| `signing-primitive`     | $199  | Compliance, Provenance                             | built (commercial carve, ADR-0257 §1)                                                                                                       |
| `field-crypto` †        | $199  | Compliance, AI-Production, Local-first, Provenance | built                                                                                                                                       |
| `audit-worm` †          | $149  | Compliance, Provenance                             | substantial                                                                                                                                 |
| `alerting`              | $149  | Compliance                                         | built (Stage-2, ADR-0150)                                                                                                                   |
| `retention-runner`      | $199  | Compliance                                         | built (Stage-2, ADR-0151)                                                                                                                   |
| `access-review`         | $199  | Compliance                                         | built (ADR-0371) — catalog debut 2026-07-20 (ADR-0373)                                                                                      |
| `risk-register`         | $279  | Compliance                                         | built (ADR-0371) — catalog debut 2026-07-20 (ADR-0373)                                                                                      |
| `trust-page`            | $149  | Compliance                                         | built (ADR-0371) — catalog debut 2026-07-20 (ADR-0373)                                                                                      |
| `ai-meter` †            | $199  | AI-Production                                      | substantial                                                                                                                                 |
| `ai-evals` †            | $199  | AI-Production                                      | substantial                                                                                                                                 |
| `guardrails` †          | $149  | AI-Production                                      | substantial                                                                                                                                 |
| `prompt-registry` †     | $99   | AI-Production                                      | substantial                                                                                                                                 |
| `credits`               | $149  | AI-Production                                      | built                                                                                                                                       |
| `local-store` †         | $99   | Local-first, Agentic-Dev                           | substantial                                                                                                                                 |
| `local-sync`            | $199  | Local-first                                        | built (commercial carve, ADR-0258 §1)                                                                                                       |
| `local-inference`       | $249  | Local-first                                        | built (commercial carve, ADR-0258 §1)                                                                                                       |
| `local-privacy`         | $99   | Local-first                                        | built (commercial carve, ADR-0258 §1)                                                                                                       |
| `agent-kernel` †        | $199  | Agentic-Dev                                        | substantial                                                                                                                                 |
| `agent-runner`          | $49   | Agentic-Dev                                        | built (ADR-0186)                                                                                                                            |
| `agent-trajectory`      | $49   | Agentic-Dev                                        | built (ADR-0349/0351 slice 1) — catalog debut 2026-07-18                                                                                    |
| `tool-exec`             | $99   | Agentic-Dev                                        | built (Stage-2, ADR-0153)                                                                                                                   |
| `org-controls`          | $249  | — (Everything only)                                | built (commercial carve, ADR-0257 §1)                                                                                                       |
| `billing-orchestration` | $99   | — (Everything only)                                | built (commercial carve, ADR-0257 §1)                                                                                                       |
| `ui-pro`                | $129  | — (Everything only)                                | published @0.1.0 (PR #142, 2026-07-07 — index entry + RESERVED graduation landed together per ADR-0259; see the platform-modules row above) |

Thin base seams (`ai-config`, `tenancy-rls`, `jobs`, `email`) are **never** individually sold — bundle-
only by (the retired) ADR-0129 §3, and now also **free/open** anyway (ADR-0094).

---

## 3. Open-core split (the license invariant)

**Open (Apache-2.0, 16 packages):** the full list in §1's first table — the free discovery/trust
substrate every buyer (and every non-buyer) can use unrestricted. Includes `cli`, `migrate`,
`license-verify` (flipped commercial→Apache-2.0 by ADR-0136) and `rate-limit` (PR #119). **`credits` is
commercial**, not open — flipped by operator override (ADR-0249 G5) after decoupling the `cli`
codegen-debit gate; it is now a priced AI-Production member (ADR-0258 §2).

**Commercial (`LicenseRef-Caisson-Commercial`, everything else under `packages/`, `services/`,
`registry/`):** the 6 bundles (5 persona bundles + Everything) and their sellable member modules — the
2026-07-06 catalog-rework carves (`compliance-core`/`frameworks-pack`/`signing-primitive`/`local-sync`/
`local-inference`/`local-privacy`/`org-controls`/`billing-orchestration`), `credits`, the 3 retired
legacy edition packages (`ai-kit`/`agent-dev`/`local-ai`, kept for existing-buyer resolution only), the
compliance primitives, the registry service, every commercial base-kind package
(`pricebook`/`license-issue`/`platform-reads`), and all four services.

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
branch), closing that leak; the live deployed Worker shipped the re-keyed floor and was independently
**VERIFIED against production 2026-07-05** (`docs/archive/public-surface-minimization.md`) — all 8 now
404 fail-closed for anonymous callers. ADR-0136 also flips `cli`,
`migrate`, and `license-verify` to Apache-2.0, so they are now legitimately open — leaving `pricebook`
as the only commercial base-kind package intentionally served free (never had a standalone price to
protect). The 2026-07-06 catalog-rework carves and `ui-pro` are not yet audited against this note (out
of scope for this pass — flagged, not resolved).

---

## 4. Not sold / why

- **The 16-package open Base** — never sold. Per ADR-0094 (extended by ADR-0136), it is the **trust +
  acquisition layer**: table-stakes substrate (auth/RLS/billing/jobs/email/config/MCP-transport/
  UI/registry-contract/observability/rate-limit) plus the installer/migrator/verifier tooling
  (`cli`/`migrate`/`license-verify`) with **no compliance, AI, or evidence value on its own**. Giving it
  away removes the friction of a free-boilerplate undercut (ShipFast/t3-class competitors) while the
  actual moat — the bundles, the compliance primitives, the registry service, and update subscriptions —
  stays commercial.
- **`tooling/*`** — never sold, never even licensed for external use (all 5 are `private` with no
  `license` field). Build-time/dev-time infra only (eslint config, tsconfig, test harness, the
  standards-gate itself, the design-quality critic); none of it ships into a buyer's generated repo.
- **`apps/*`** — never sold. `apps/site` is the storefront/delivery vehicle, not a product; `apps/admin`
  is the internal operator control-plane (absorbed the `apps/studio` design tool, ADR-0140); the 5
  edition-named reference apps (`apps/{base,compliance,ai-kit,local-ai,agent-dev}`) demonstrate wiring
  for VERIFY/SWEEP evidence, not buyer deliverables (their names predate the bundle rename and were not
  renamed with it).
- **`registry/`, `services/*`** — infrastructure the operator runs to fulfill every sale (the Worker
  serves the index, `services/license` processes payment/entitlement, `services/docs` +
  `services/support-bot` run buyer support) — never themselves an installable/purchasable SKU.

## 5. Cross-links

- **Build-status depth** (LOC, test counts, seams, honest gaps, phase P0–P7 status): `docs/build-state.md`
- **Live decision board**: `docs/state/decisions-and-forks.md`
- **Catalog-rework locks (the six-bundle rework this file reflects):**
  `knowledge/decisions/ADR-0257-catalog-rework-spec-locks.md` (bundle schema + alias map),
  `knowledge/decisions/ADR-0258-catalog-pricing-consequence-locks.md` (Local-first carve, AI-Production
  recompute, Everything full-catalog), `knowledge/decisions/ADR-0259-ui-pro-spec-locks.md` (ui-pro),
  `knowledge/decisions/ADR-0260-pricing-revalidation-locks.md` (formula + renewal cents),
  `knowledge/decisions/ADR-0249-catalog-followup-g-locks.md` (the G-series carves: billing, auth-sso,
  credits decouple-then-flip, org admin-write, the ai-kit/agent-dev unpriced-glue exception)
- **Pricing methodology + full competitive comparables (historical, edition-era)**: `knowledge/decisions/ADR-0129-pricing-packaging-value-based-modules.md`
- **As-if-built storefront availability** (why every SKU shows regardless of code-completeness): `knowledge/decisions/ADR-0130-storefront-as-if-built-availability.md`
- **Open-core license split**: `knowledge/decisions/ADR-0094-open-core-base-apache2.md`, `knowledge/decisions/ADR-0097-registry-schema-service-split.md`
- **Registry Worker entitlement filtering**: `knowledge/decisions/ADR-0047-registry-readpath-worker-seam.md`
- **Sibling docs from this session**: `docs/archive/refactor-split-opportunities.md` (package-split candidates), `docs/archive/public-surface-minimization.md` (public-surface reduction)
