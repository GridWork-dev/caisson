---
updated: 2026-07-07
status: live
grounds:
  - package.json
  - tooling/standards-gate/src/checks.ts
  - .github/workflows/ci.yml
  - infra/terraform/main.tf
  - docs/state/providers.md
---

# Architecture — the one-page map

What runs where, right now. Deep design lives in [`specs/01-architecture.md`](../specs/01-architecture.md)

- the ADRs under [`knowledge/decisions/`](../knowledge/decisions/); live per-package build status
  lives in [`build-state.md`](build-state.md); the full ADR catalog is [`adr-index.md`](adr-index.md).
  This file routes, it does not restate.

## 1. Monorepo topology

Bun + Turborepo workspaces (`package.json`): `tooling/*`, `packages/*`, `apps/*`, `registry`,
`services/license`, `services/docs`. `services/support-bot` (Python) is intentionally outside the
workspace.

| Tree        | Count | Owns                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/` | 50    | independently-sellable capability units, framework-free. **15 Apache-2.0 base** (kernel · auth · tenancy-rls · ui · billing · jobs · email · ai-config · mcp-server · registry-schema · observability · cli · migrate · license-verify · rate-limit, ADR-0094/0097/0117/0136 — credits flipped commercial per ADR-0258 §2) vs **35 `LicenseRef-Caisson-Commercial`** — the 6 bundle metas (compliance/ai-production/local-first/agentic-dev/provenance/everything, ADR-0257; the 4 legacy edition metas ai-kit/local-ai/agent-dev + compliance stay resolvable via the alias map) + the sellable modules (field-crypto, audit-worm, alerting, retention-runner, ai-meter, ai-evals, guardrails, prompt-registry, local-store, agent-kernel, agent-runner, tool-exec, compliance-core, frameworks-pack, signing-primitive, credits, local-sync, local-inference, local-privacy, org-controls, billing-orchestration) + internal-only (platform-reads, pricebook, license-issue, audit-harness, brand). The ui-pro SKU is priced + Paddle-wired but its package ships in a sibling wave (not yet a `packages/` dir) |
| `services/` | 3     | seller-platform side-cars: `license` (issuer + Paddle webhook), `docs` (RAG), `support-bot` (Discord, Python)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `apps/`     | 7     | the only layer that imports a framework: `site` (GTM+docs, Next 16), `admin` (control-plane, Next 16), `compliance`/`ai-kit`/`local-ai` (edition reference templates, Next), `base`/`agent-dev` (plain-TS reference consumers)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `registry/` | —     | versioned module sources + the CI-built `index.json` (36 modules) + the `worker/` (CF Worker serving the npm install protocol at `registry.caisson.sh`, ADR-0223)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `infra/`    | —     | `terraform/` (Cloudflare DNS+Access+WAF), `discord/` (guild provisioning), `kms`/`license-issuer`/`signoz`/`worm` (key + retention infra)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `tooling/`  | 5     | the one eslint/tsconfig/test/lint-gate source (`standards-gate`, `eslint-config`, `testing`, `tsconfig`, `design-critic`); nothing ships except through it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

Down-only dependency direction (ADR-0003): editions compose base, never the reverse; edition ↛
edition. Provider-SDK reach is confined to `ai-config`+`ai-kit` (ADR-0011).

## 2. Trust boundaries

- **Open ↔ commercial no-depend-up** (ADR-0094/0097) — an Apache-2.0 package may depend only on
  other Apache-2.0 packages; a commercial package may depend on anything. Enforced by
  `checkOpenCoreLicensing` + `checkOpenCommercialBoundary` in `tooling/standards-gate/src/checks.ts`
  (license-keyed, not a name allowlist) — the graph-direction half (down-only base↛edition) is
  `dependency-cruiser`'s job.
- **License seam** — `@caisson/license-issue` holds the Ed25519 signing key and is `private: true`
  with no `publishConfig` (never published, ADR-0110); `@caisson/license-verify` (Apache-2.0) is the
  offline verifier every generated repo embeds. `checkEntitlementTokenScan` (checks.ts) fail-closes
  the gate if a real-signed token shape lands in a fixture/demo/mirror path.
- **Money seam** — `services/license` mounts the Paddle webhook (`app.ts`), sole MoR, at
  `license.caisson.sh` (DNS-only/grey in `infra/terraform/main.tf` — never Cloudflare-proxied, so no
  WAF/rate-limit rule can ever evaluate against it, by construction not by path-expression). Credits
  are an integer wallet (`@caisson/credits`, debit-before-spend, ADR-0007); branded-money/rounding
  provenance is ADR-0212.
- **Claims/entitlement seam** (the cross-service contract the 2026-07-06 SHIP audit proved
  breakable): license tokens sign the account's **PURCHASED entitlement ids** — never the index
  expansion — because every consumer (Worker `resolveGate`, npm surface, MCP server) expands
  against the registry index at verification, and the signed `updatesWindows`/`entitledSince`
  maps are purchased-id-keyed (an expanded claim silently kills the window fold → fail-open).
  Membership truth is the registry index members maps alone; legacy ids resolve through the ONE
  alias point (`normalizeEntitlementId`/`LEGACY_ENTITLEMENT_ALIASES`, registry-schema); a
  sold-but-unpublished SKU sits in `RESERVED_MODULE_ENTITLEMENT_IDS` (fail-soft) until indexed.
  Deploy-order corollary: the claims schema is `.strict()`, so any wave that widens it deploys
  VERIFIERS (Worker) before the issuer re-mints (`docs/deploy/STATE.md` standing constraint).
- **Tenancy** — fail-closed Postgres RLS (`@caisson/tenancy-rls`, `withTenant`/`SET LOCAL`; a missing
  `WHERE` fails closed, ADR-0005), verified against the real generator by `checkRlsEquivalence`
  (checks.ts) so hand-written migration RLS can't silently drift from `buildTenantPolicySql`.
- **Admin** — `apps/admin` sits behind a permanent Cloudflare Access edge gate PLUS an in-app
  CF-Access-JWT middleware check (ADR-0140 + ADR-0204, closing the direct-grey-origin bypass).

## 3. The live fleet

5 Railway services (`caisson-prod`, US-West) + 1 Cloudflare Worker, per `docs/state/providers.md`:

| Host                  | Service               | Posture                                                                                                                                                              |
| --------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `caisson.sh` / `www`  | `caisson-site`        | Railway, CF-proxied (pre-launch Access gate, removed at go-live)                                                                                                     |
| `admin.caisson.sh`    | `caisson-admin`       | Railway, CF-proxied + **permanent** operator CF-Access + in-app JWT check                                                                                            |
| `license.caisson.sh`  | `caisson-license`     | Railway, **grey/DNS-only** (Paddle webhook must reach it directly)                                                                                                   |
| `docs-api.caisson.sh` | `caisson-docs`        | Railway, CF-proxied                                                                                                                                                  |
| —                     | `caisson-support-bot` | Railway (Python/Discord), no public hostname                                                                                                                         |
| `registry.caisson.sh` | Cloudflare Worker     | serves the npm install protocol, license-token-authed; built (ADR-0223), dormant behind `CAISSON_PUBLISH_DRY_RUN=true` — R2/DNS activation is an operator DEPLOY act |

DNS + Access + the front rate-limit are Terraform-managed (`infra/terraform/{main,access,waf}.tf`).
Observability is Grafana Cloud (sole OTLP sink, ADR-0177); Paddle sandbox is still the checkout
backend (production Paddle account is a launch-gate item).

## 4. The gate stack

| Check               | Where it lives                                                                 | Guards                                                                                                                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `standards-gate`    | `.github/workflows/ci.yml` → `tooling/standards-gate/src/cli.ts` (`checks.ts`) | the SPDX/license authority — AGPL boundary, open-core split, down-only, manifest↔package.json agreement, RLS equivalence, shipped-prose, entitlement-token leaks. Runs pre-install (fs-only) AND post-install (needs `node_modules`) |
| `check`             | `.github/workflows/ci.yml`                                                     | `turbo run build lint test` (36-pkg tree) + `bun run gate` (`packages/kernel/src/gate.ts`)                                                                                                                                           |
| `registry-index`    | `.github/workflows/ci.yml`                                                     | `registry/index.json` is a byte-identical rebuild from the git-tracked ledger — proves CI (not a hand-edit) produced it                                                                                                              |
| `oscal-conformance` | `.github/workflows/ci.yml` (hosted, `ubuntu-latest`)                           | NIST OSCAL v1.2.2 JSON→XML→schema round-trip via `oscal-cli` (Maven), for `packages/compliance`                                                                                                                                      |

`standards-gate` + `check` + `registry-index` are the 3 unconditional required checks (ADR-0016);
the `greptile-gate` review check was RETIRED with the vendor (2026-07-06 — review is the
in-session SHIP audit lane per CLAUDE.md §PR review gate); `oscal-conformance`
runs hosted because `oscal-cli` isn't on the self-hosted `caisson-amd64` fleet.
