# Edition catalog

Internal source-of-truth **index** of the 5 offerings: what each is, its package
composition, licensing, committed price anchor, and **filesystem-verified build status**.
This file owns the synthesized cross-edition map; it does **not** restate canonical prose.

**Routing (canonical sources win on conflict):**

- Product definition + persona + roadmap: [`specs/00-product-spec.md`](../specs/00-product-spec.md) sec. 4
- Architecture / composition law: [`specs/01-architecture.md`](../specs/01-architecture.md)
- Live decision board: [`docs/state/decisions-and-forks.md`](state/decisions-and-forks.md)
- Per-edition architecture ADRs: `knowledge/decisions/ADR-005x..007x` (cited inline below)
- Licensing: [`ADR-0023`](../knowledge/decisions/ADR-0023-fully-commercial-licensing-model.md) · [`ADR-0050`](../knowledge/decisions/ADR-0050-local-ai-fully-commercial.md) · [`ADR-0083`](../knowledge/decisions/ADR-0083-local-first-fully-commercial.md)
- Pricing: [`ADR-0012`](../knowledge/decisions/ADR-0012-pricing-packaging.md) (ranges) · [`ADR-0081`](../knowledge/decisions/ADR-0081-pricing-indicative-placeholders.md) · [`ADR-0082`](../knowledge/decisions/ADR-0082-go-live-site-posture.md) (committed display anchors)

> Verified against the working tree on 2026-06-28 (src LOC excl. tests, test-file counts,
> `registry/index.json` manifest `stability`, `packages/*/package.json` `license`).

---

## At a glance

| Edition               | Role                                                  | From (committed, ADR-0082)                                              | License    | Build status                          |
| --------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------- | ---------- | ------------------------------------- |
| **Base**              | OSS-renamed core substrate; every edition composes it | per-module from $49; included in editions/bundle (no standalone anchor) | commercial | **BUILT** (alpha)                     |
| **Compliance**        | **HERO** wedge (regulated SaaS)                       | $1,299                                                                  | commercial | implemented, alpha (unverified)       |
| **AI Production Kit** | #2 - AI feature production rigor                      | $599                                                                    | commercial | implemented, alpha (unverified)       |
| **Local-first AI**    | on-device / offline AI; **AGPL flank KILLED**         | $499                                                                    | commercial | implemented, alpha (unverified)       |
| **Agentic-Dev**       | governed agent kernel + emitter                       | $499                                                                    | commercial | **labeled roadmap** (ADR-0082 sec. 4) |
| _Bundle_              | base + all 4 editions                                 | $2,499                                                                  | commercial | n/a                                   |

**Build-status legend.** `BUILT` = real implementation + passing-shaped test files, operator-acknowledged
as the genuine core. `implemented, alpha (unverified)` = substantial src + tests present in the tree
(`stability: alpha` in the registry), but production-readiness, end-to-end wiring, and the edition
reference app are **not** verified here, and the reference apps are thin scaffolds. `labeled roadmap` =
positioned as "coming" on the site regardless of package state. **No edition is "fully built."** See
[Accuracy flags](#accuracy-flags).

---

## Licensing (uniform - all commercial)

Every package ships `LicenseRef-Caisson-Commercial` (verified: all 24 `packages/*/package.json`).
Buy once -> build unlimited products -> no resale/redistribution of the kit. **No free / OSS / AGPL /
copyleft tier exists anywhere in the product.**

- The fully-commercial model: [`ADR-0023`](../knowledge/decisions/ADR-0023-fully-commercial-licensing-model.md) (supersedes ADR-0010 open-core base).
- The old **Local-first AGPL flank is killed**: [`ADR-0050`](../knowledge/decisions/ADR-0050-local-ai-fully-commercial.md) (Wave-1) then reaffirmed at site level by [`ADR-0083`](../knowledge/decisions/ADR-0083-local-first-fully-commercial.md). The `oss` manifest tier marks nothing; the ADR-0022 AGPL contamination gate is a dormant tripwire.
- Enforcement: Ed25519 offline license + entitlement-gated registry ([`packages/license-verify`](../packages/license-verify), [`ADR-0010`](../knowledge/decisions/ADR-0010-licensing-open-core-boundary.md)/ADR-0008).

## Pricing (committed display anchors)

The site shows the [`ADR-0012`](../knowledge/decisions/ADR-0012-pricing-packaging.md) anchor point-values
as the prices, no "subject to change" ([`ADR-0082`](../knowledge/decisions/ADR-0082-go-live-site-posture.md) sec. 2):
Compliance **$1,299** · AI Production Kit **$599** · Local-first AI **$499** · Agentic-Dev **$499** ·
Bundle **$2,499** · per-module **from $49** · subscriptions Compliance Updates **$199/mo** /
Developer **$99/mo**. Final-number authority stays the operator's, silently.

> The `priceCents` in `registry/index.json` are **internal placeholders** (e.g. ai-kit edition `49900`
> = $499, primitives `4900` = $49) and do **not** all match the committed ADR-0082 anchors (ai-kit
> site anchor is $599). Customer-facing prices = ADR-0082; registry `priceCents` is not the SoT.

---

## Base

OSS-positioning-renamed core substrate (no free tier post-ADR-0023). Every edition composes it; its
modules also sell a-la-carte. Spec: [`specs/00-product-spec.md`](../specs/00-product-spec.md) sec. 4 (Base row).

**Composition (genuinely built):**

| Package                                                 | What                                                                                                        | src LOC / tests |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------- |
| [`packages/kernel`](../packages/kernel)                 | error model, gate (402/license), audit-chain, event-sink, migration-assembly, fetchWithTimeout              | 1363 / 9        |
| [`packages/tenancy-rls`](../packages/tenancy-rls)       | fail-closed Postgres RLS (`withTenant`), ADR-0005                                                           | 75 / 1          |
| [`packages/field-crypto`](../packages/field-crypto)     | per-tenant AEAD field encryption, envelope, crypto-shred, AAD (ADR-0043/0045/0046/0055)                     | 1319 / 9        |
| [`packages/auth`](../packages/auth)                     | JWT + session/RLS seam (ADR-0015)                                                                           | 143 / 1         |
| [`packages/billing`](../packages/billing)               | billing provider port — Paddle MoR webhook (sole mounted, ADR-0200) + dormant Stripe driver (ADR-0017/0116) | 249 / 1         |
| [`packages/credits`](../packages/credits)               | integer credit ledger, idempotent debit (ADR-0007/0024/0074)                                                | 328 / 2         |
| [`packages/cli`](../packages/cli)                       | **`create-caisson`** generator + meter + migrate-assemble (ADR-0048/0049)                                   | 488 / 3         |
| [`packages/mcp-server`](../packages/mcp-server)         | buyer MCP server + auth + tool-registration seam (ADR-0008/0076)                                            | 514 / 2         |
| [`packages/license-verify`](../packages/license-verify) | Ed25519 offline license verify (ADR-0010)                                                                   | 272 / 2         |
| [`packages/ui`](../packages/ui)                         | design-floor token contract (ADR-0042/0078)                                                                 | 381 / 1         |

- **License:** commercial · **Price:** no standalone edition anchor; per-module from $49, bundled into editions.
- **Build:** **BUILT (alpha).** This is the genuine, operator-acknowledged core. Reference app [`apps/base`](../apps/base) = plain-TS consumer (4 `.ts` src, no `.tsx`/`app/` pages; the real-HTTP 402->grant->200->MCP loop).

## Compliance (HERO)

The acquisition wedge: fail-closed RLS + S3 WORM Object-Lock + append-only SHA-256 audit chain +
per-tenant field-crypto + SOC2/HIPAA evidence-pack generator. Lineage: Wardfile. Hero rationale:
[`ADR-0040`](../knowledge/decisions/ADR-0040-positioning-hero.md). Edition ADRs: 0051-0058
(WORM mode, chain anchor, version schema, artifact store, crypto-shred, evidence signing, control model, evidence determinism).

**Composition:**

| Package                                             | What                                                                                                                  | src LOC / tests |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------- |
| [`packages/audit-worm`](../packages/audit-worm)     | WORM store (local + S3 Object-Lock), hash chain-store, append-only version-store, retention (ADR-0051/0052/0053/0054) | 1302 / 6        |
| [`packages/compliance`](../packages/compliance)     | control model, evidence-pack generate/sign (frameworks/, evidence/), tenant-crypto integration (ADR-0057/0058)        | 2871 / 11       |
| [`packages/field-crypto`](../packages/field-crypto) | (base) at-rest crypto reuse (ADR-0055)                                                                                | (base)          |

- **License:** commercial · **Price:** from **$1,299**.
- **Build:** **implemented, alpha (unverified).** Substantial src + 17 test files (incl. integration + golden) landed in Wave-1; production-readiness not verified here. App [`apps/compliance`](../apps/compliance) = Next.js, 2 pages (scaffold). The site demo CTAs are gated to built substrate only per ADR-0082 sec. 3.

## AI Production Kit

The metered `infer()` gateway + the AI-feature rigor layer behind Vercel AI SDK v5. Lineage: gridwork +
prospector + gridwork-core. Edition ADRs: 0059-0063 (gateway, metering/spend-cap, prompt-registry, eval-harness, guardrails).

**Composition** (registry edition deps + standalone eval primitive):

| Package                                                   | What                                                                                                                | src LOC / tests |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------- |
| [`packages/ai-kit`](../packages/ai-kit)                   | the metered `infer()` gateway edition composing the below (ADR-0059)                                                | 358 / 2         |
| [`packages/ai-config`](../packages/ai-config)             | provider-agnostic AI config (ADR-0011)                                                                              | 49 / 1 (thin)   |
| [`packages/ai-meter`](../packages/ai-meter)               | estimate->reserve->reconcile, price book, caps, circuit breaker (ADR-0060)                                          | 957 / 3         |
| [`packages/prompt-registry`](../packages/prompt-registry) | versioned prompt registry (ADR-0061)                                                                                | 582 / 2         |
| [`packages/guardrails`](../packages/guardrails)           | input/output guardrails (ADR-0063)                                                                                  | 520 / 2         |
| [`packages/ai-evals`](../packages/ai-evals)               | eval harness + grader taxonomy + regression gate (ADR-0062); a-la-carte primitive, not in the edition manifest deps | 800 / 1         |

- **License:** commercial · **Price:** from **$599** (registry placeholder `$499` differs - see pricing note).
- **Build:** **implemented, alpha (unverified).** Gateway + metering + registry + guardrails + evals all have src + tests; `ai-config` is thin (49 LOC). App [`apps/ai-kit`](../apps/ai-kit) = Next.js, 2 pages.

## Local-first AI

On-device / offline AI over a single-file-per-tenant SQLite store: in-house two-way sync (CRDT/LWW +
tombstones), sqlite-vec + FTS5 hybrid (RRF) retrieval, `InferenceBackend` port, field-crypto at-rest.
Lineage: tessera + health-service (rebuilt clean). Edition ADRs: [`0064`](../knowledge/decisions/ADR-0064-local-first-edition-architecture.md) (built sync/vector/inference), 0067 (local-store base), 0073 (DB-file-per-tenant).

**Composition:**

| Package                                           | What                                                                               | src LOC / tests |
| ------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------- |
| [`packages/local-ai`](../packages/local-ai)       | inference/, privacy/ (egress guard), store/, sync/ (reconcile), crypto/ (ADR-0064) | 2209 / 9        |
| [`packages/local-store`](../packages/local-store) | base single-file SQLite store (ADR-0067/0073)                                      | 1043 / 7        |

- **License:** **commercial** - the **AGPL flank is removed** (ADR-0050/0083). No "Free"/"AGPL" anywhere.
- **Price:** from **$499** (ADR-0083).
- **Build:** **implemented, alpha (unverified).** Sync/privacy/store/inference all have src + tests. App [`apps/local-ai`](../apps/local-ai) = Next.js, 2 pages.

## Agentic-Dev (labeled roadmap)

Governed, **engine-neutral** TS agent kernel (deterministic policy/guards + lifecycle FSM, steps
recorded into the kernel audit-chain) + a thin multi-harness emitter (one Caisson schema ->
`.claude/` · Codex `AGENTS.md` · Cursor). Also underpins the generator + buyer MCP. Lineage:
gridwork-core. Edition ADRs: [`0065`](../knowledge/decisions/ADR-0065-base-agent-kernel-package.md) (base kernel), [`0066`](../knowledge/decisions/ADR-0066-agentic-dev-governed-kernel-emitter.md) (governed emitter).

**Composition:**

| Package                                             | What                                                         | src LOC / tests |
| --------------------------------------------------- | ------------------------------------------------------------ | --------------- |
| [`packages/agent-kernel`](../packages/agent-kernel) | base: schema + lifecycle FSM + hooks dispatcher (ADR-0065)   | 1101 / 7        |
| [`packages/agent-dev`](../packages/agent-dev)       | governed runtime + multi-harness emitter + golden (ADR-0066) | 761 / 3         |

- **License:** commercial · **Price:** from **$499**.
- **Build:** **labeled roadmap.** Per [`ADR-0082`](../knowledge/decisions/ADR-0082-go-live-site-posture.md) sec. 4 this is the one honest "coming" edition: forward-looking CTA, kept out of primary nav, **not** rewritten as shipping. Package src exists (above) but the edition is positioned as unbuilt; app [`apps/agent-dev`](../apps/agent-dev) = plain-TS consumer (no `.tsx`/`app/` pages).

---

## Accuracy flags

1. **"Empty stubs" claim is stale.** [`ADR-0082`](../knowledge/decisions/ADR-0082-go-live-site-posture.md)
   sec. 3 (2026-06-28) states audit-worm / compliance / local-ai / ai-kit are "empty stubs - structure
   only." The working tree as verified shows **substantial implementations + tests** in all of them
   (compliance 2871 LOC / 11 tests, local-ai 2209 / 9, audit-worm 1302 / 6, agent-kernel 1101 / 7,
   local-store 1043 / 7, ai-meter 957 / 3, ai-evals 800 / 1, agent-dev 761 / 3). The Wave-1 editions
   integration (per project memory, PR #11) landed after that ADR's snapshot. **Neither "empty stub"
   nor "fully built" is accurate** - the edition packages are `stability: alpha` implementations whose
   production-readiness, end-to-end wiring, and reference apps are **not verified here**. The base
   substrate remains the only operator-acknowledged genuinely-built core.

2. **Stale licensing rows in the frozen founding spec.** [`specs/00-product-spec.md`](../specs/00-product-spec.md)
   sec. 4 still labels Local-first "AGPL open-core" and Base "OSS core + paid modules" — **superseded**
   by ADR-0023/0050/0083 (uniform commercial, no free tier), but specs/00 is a frozen founding spec
   (superseded-by-ADR, not edited in place). The root [`README.md`](../README.md) offer table has been
   corrected to commercial. This catalog reflects the corrected state.

3. **Registry price drift.** `registry/index.json` `priceCents` are internal placeholders and do not
   all equal the committed ADR-0082 customer anchors (ai-kit `49900`/$499 vs site $599). ADR-0082 is
   the customer-facing SoT.

4. **Registry coverage is partial.** Only 7 modules are published in `registry/index.json`
   (ai-evals, ai-kit, ai-meter, cli, field-crypto, guardrails, prompt-registry) per the
   publish-what-exists backfill (ADR-0069); the compliance/local-ai/agent-dev/base edition manifests
   are not yet published, so composition for those is sourced from `apps/*/package.json` deps +
   `specs/00` sec. 4, not a published manifest. (unverified against a registry manifest)
