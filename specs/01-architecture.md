# Architecture & Data Model — Concept Spec

**Status:** spec-committed pending Gate 4. Option **C** (composable packages + generator/registry).
**Scope:** the monorepo shape, package graph, the seller-platform data model, and cross-cutting
invariants. DDL/migrations are PLAN work — this is the shape they implement. ADRs:
0001 (tooling), 0003 (package split), 0004 (generator), 0005 (RLS), 0006 (WORM/audit), 0007 (credits), 0008 (MCP auth).

## 1. Monorepo layout

```
forge/
  tooling/                 # the ONE standards layer (ADR-0002): eslint-config, tsconfig,
                           #   testing harness, lint-gate, AGENTS.md authoring rules
  packages/
    kernel/                # governance: typed config/schema + validator + lint-gate (← gridwork-core)
    auth/  tenancy-rls/  billing/  credits/  ai-config/  mcp-server/  ui/  jobs/  email/
                           # BASE — each independently sellable, each built to tooling/ standards
    audit-worm/  field-crypto/                # compliance primitives (← Wardfile)
    compliance/            # Compliance EDITION = composition + SOC2/HIPAA evidence engine
    ai-kit/                # AI Production Kit EDITION
    local-ai/              # Local-first AI EDITION (AGPL)
    agent-dev/             # Agentic-Dev EDITION (← gridwork-core kernel)
    cli/                   # `create-stack` generator (Option C)
  registry/                # versioned module sources the CLI + buyer's agent pull from
  apps/                    # ONE runnable reference template per edition (the sellable starters)
    base/  compliance/  ai-kit/  local-ai/  agent-dev/
  services/
    support-bot/           # custom: Discord + Python LLM dispatch + codebase RAG (ADR-0009)
    license/               # Ed25519 issuer + MoR webhook + credit grants
    docs/                  # AI-native docs (feeds support-bot + buyer agents)
  knowledge/decisions/     # ADRs (append-only, ADR-NNNN-slug.md)
  specs/                   # this spec set
```

- **Runtime/PM:** Bun + TypeScript strict (ADR-0001/0002). `support-bot` is Python (operator choice).
- **Versioning:** changesets; each package independently versioned + published (à-la-carte commerce).
- **Editions = compositions**, not forks: an edition package depends on base packages + adds vertical logic. Buying an edition = a curated set of packages; buying à-la-carte = any single package.

## 2. The two planes

Inherited from gridwork's proven split (ADR-0007):

- **Control plane (TS/Bun)** — the seller platform + every shipped app's web tier: auth, tenancy/RLS, billing, credit gating, MCP server, registry/generator. EdDSA JWT + cached JWKS at the trust seam.
- **Execution plane (Python where it fits)** — `support-bot` (LLM dispatch + codebase RAG on cloud runners), and the buyer's optional AI-feature workers. Constant-time internal Bearer at the seam; hosted inference via API (no local models).

## 3. Seller-platform data model (the commerce/licensing/credits spine)

What Caisson-the-business runs on (distinct from what a _buyer's_ app ships). Multi-tenant, RLS, credit-metered — and itself a reference of the base.

```
account (buyer/tenant)                      RLS-isolated; member × role (owner|seat)
├── entitlement        what they own: edition | module | bundle | subscription
│                      (source: purchase | subscription); license_id (Ed25519)
├── license            Ed25519 offline token: entitlements + tier + expiry; revocable
├── credit_wallet      balance (integer credits); APPEND-ONLY ledger of grants/debits
│   └── credit_event   grant (purchase|sub-allotment|topup) | debit (codegen|ai-feature)
│                      idempotent (DB-anchored, ADR-0007); debit-before-spend; 402 on empty
├── registry_access    scoped token → which registry modules/versions they may pull
├── generation         a `create-stack` run: edition+modules selected, repo emitted,
│                      credits debited (the codegen meter)
└── usage_event        metered events (per-generation, per-ai-feature) → billing/analytics
support_ticket         AI-triaged; ai_brief (jsonb); escalated_to (human); links account
module / module_version   the registry: package, semver, changelog, OSS|paid, price
```

**Cross-cutting invariants (apply to all platform + shipped-base code):**

1. **Tenancy fail-closed (ADR-0005).** Every tenant-owned row carries `account_id`; app-layer filter + **Postgres RLS keyed by `SET LOCAL`** underneath — a missing `WHERE` fails closed. (← gwdigital 16-FORCE-policy pattern.)
2. **Credits are integer; the ledger is append-only (ADR-0007).** Never floats. Debit-before-spend, DB-anchored idempotency (partial unique index + 23505 mapping); insufficient balance → 402.
3. **Secrets timing-safe, env-only.** `crypto.timingSafeEqual` for **opaque Bearer/registry tokens**; **Ed25519 licenses verify via `crypto.verify()`** (asymmetric — NOT timingSafeEqual); no hardcoded keys; `fetchWithTimeout` on every outbound call; Zod `.strict()` at boundaries; no `any`, no `console.log` (gridwork-core security floor).
4. **License verifies offline (ADR-0010).** Ed25519; fail-safe-to-free for OSS tiers; revocation via the issuer.
5. **Compliance edition adds: append-only versions + WORM + audit chain (ADR-0006).** Locked artifacts immutable; supersede never mutate; S3 Object-Lock + SHA-256 hash chain; field encryption via a column custom-type (key-version registry; KMS envelope at SOC2 tier).
6. **Buyer MCP server is auth-gated (ADR-0008).** Bearer/license-scoped; **read-mostly** over codebase conventions; the one write surface (drive `create-stack` generation) is **credit-gated (ADR-0007) + validates module/edition names against the registry allowlist** before any file/subprocess use, and is per-account rate-limited.
7. **Provider-agnostic AI config (ADR-0011).** One config resolves any provider (OpenAI/Anthropic/Gemini/OpenRouter/local) + a buyer settings file; no provider hardcoded; agent-assisted setup writes it.

## 4. The generator / registry (Option C)

- `create-stack` (CLI) reads `registry/` (versioned module sources) → composes a tailored repo from the buyer's edition+module selection. Driven either by the CLI directly or **by the buyer's AI agent via the MCP server** (the agent picks modules + configures).
- Generation is a `generation` row + a **credit debit** (codegen-credits) — the metered monetization of Option C.
- The registry is the single source the CLI, the buyer's agent, AND the docs pull from — one artifact, many consumers (mirrors the support-strategy "one content source" insight).

## 5. Standards seam (deferred deep-dive, D9)

`tooling/` holds the enforced coding standards (the ground-up strategy). The **module/item
production-standards pipeline** — how each registry module is authored, validated (golden-file),
versioned, and published — is a **separate dedicated session**. This spec fixes the _seam_
(`tooling/` + `registry/` + golden-file harness from P0) and the invariant ("a module ships
only through the standards gate"), not the internal pipeline.
