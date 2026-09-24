---
updated: 2026-09-24
status: live
grounds:
  - package.json
  - tooling/standards-gate/src/checks.ts
  - tooling/standards-gate/src/dependency-graph-guard.ts
  - .github/workflows/ci.yml
  - infra/terraform/access.tf
  - docs/state/package-catalog.md
  - docs/state/providers.md
  - docs/deploy/STATE.md
---

# Architecture — one-page map

Deep design lives in [specs/01-architecture.md](../specs/01-architecture.md), append-only decisions
in [knowledge/decisions](../knowledge/decisions), and per-package depth in
[build-state](build-state.md).

## Monorepo

| Tree        | Count | Purpose                                                                 |
| ----------- | ----: | ----------------------------------------------------------------------- |
| `packages/` |    58 | framework-free capability units: 16 Apache-2.0 and 42 commercial        |
| `apps/`     |     3 | site, admin, and demos                                                  |
| `services/` |     5 | four Bun services plus Python support-bot                               |
| `registry/` |     1 | registry service, append-only ledger/index, and Cloudflare Worker       |
| `tooling/`  |     6 | audit harness, demo registry, lint policy, standards, testing, tsconfig |

The root has 72 Bun workspaces. The only Python projects are `services/support-bot` and
`tools/assert-lane`; this surface is frozen at two. Retired self-hosted SigNoz infrastructure is
not part of the live topology.

Dependency direction is down-only: open Base cannot depend on commercial packages, and bundle
composition cannot flow upward into a higher bundle. The standards gate enforces licensing and
manifest invariants. Dependency-cruiser enforces graph direction, and its guard now fails unless
project TypeScript is active, representative `.ts`/`.tsx` sentinels appear, and the graph has
realistic module/edge counts.

## Provider ports

Provider SDKs are isolated behind the package that owns each port:

| Port           | Owner                  | Current adapters                                                    |
| -------------- | ---------------------- | ------------------------------------------------------------------- |
| AI/model       | `ai-kit` / `ai-config` | frozen eight-adapter family                                         |
| Jobs           | `jobs`                 | existing queue adapters; Inngest v4 is the active ADR-0379 addition |
| KMS            | `field-crypto`         | AWS/GCP/Azure clients; hosted production uses Azure Key Vault       |
| WORM artifacts | `audit-worm`           | S3/GCS/R2 family; Azure Blob is the active addition                 |

Core contracts receive injected clients/config and do not read ambient provider credentials.

## Trust boundaries

- **Open core:** an Apache-2.0 package can depend only on Apache-2.0 packages.
- **Licensing:** signing stays in private `license-issue`; open `license-verify` verifies offline.
- **Tenant data:** Postgres RLS is fail closed and generator parity is CI-enforced.
- **Money:** Paddle webhook ingestion is the sole merchant-of-record path; amounts and credits are
  integer units; unknown SKU IDs fail closed.
- **Rate limiting:** Paddle webhook limiter-infrastructure failures fail open and alert; issuer,
  admin, and evaluation routes fail closed with 503.
- **Admin:** in-app GitHub OAuth plus immutable numeric-user-ID allowlist (ADR-0283), **and**
  Cloudflare Access. PR #448 re-coupled admin to Access and **ADR-0415** ratified it, retiring
  ADR-0283's "no longer depends on it either way" claim; the better-auth session gate is unchanged.
  `apps/admin` now requires `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD` at startup and verifies an
  Access assertion on every request except the `/healthz` canary. The serving revision has carried
  that check since the #464 carve unfroze deploys (2026-08-27), but no Access application fronts
  `admin.caisson.sh` (last measured 2026-09-01: `/healthz` 200, `/` and `/api/health` 403), so every
  non-probe admin route refuses until the application lands with the Wave-5 edge sequencing —
  tracked as the CAISSON-208 residual in [outstanding work](state/outstanding-work.md).
- **Buyer gates:** marketing/docs/API are public; `/dashboard*` and `/cart*` are Cloudflare Access
  gated pre-launch.
- **Evidence:** audit chains, signed anchors, proof endpoints, and WORM exports keep redaction and
  provenance explicit. A technical receipt is required before a claim is promoted.

## Design-system surface

`@caisson/ui` and `@caisson/ui-pro` expose 39 components. `@caisson/ds-manifest` is the shared
schema/reader/contrast authority consumed by CLI and MCP surfaces. The checked-in base manifest is
deterministically generated from all 39 primary `@caisson/ui` component modules; CI checks its
barrel bijection and exact bytes. The UI quality gate and agent doctor share one browser-rendered
contrast implementation, including semantic, functional, and code-syntax colors.

## Live fleet

| Host                  | Runtime                   | Access posture                                       |
| --------------------- | ------------------------- | ---------------------------------------------------- |
| `caisson.sh` / `www`  | Railway `caisson-site`    | marketing public; dashboard/cart gated               |
| `admin.caisson.sh`    | Railway `caisson-admin`   | OAuth + numeric allowlist; Access in code, unfronted |
| `license.caisson.sh`  | Railway `caisson-license` | DNS-only so Paddle can reach webhook                 |
| `docs-api.caisson.sh` | Railway `caisson-docs`    | public API with route controls                       |
| support bot           | Railway Python service    | no public hostname                                   |
| `registry.caisson.sh` | Cloudflare Worker         | live authenticated npm protocol                      |

Deploys are unfrozen since the #464 health-path carve (2026-08-27). The push path
(`deploy-railway`, five services) last ran green at `fd6f6084` (run `35815698009`, 2026-09-23);
`caisson-license` is dispatch-only and its newest receipt is `6604844a` (2026-09-14). The
2026-09-16 version cut (#487) is not yet published, so the committed `registry/index.json` is ahead
of the Worker's baked index until the next release train; the last recorded index-parity reading
(`dc5ee000aebf`/54, 2026-08-26) predates that cut — see [deploy state](deploy/STATE.md). Docs-RAG
and support-bot are private services reachable only through a Turnstile-gated site proxy, so their
source parity still has no automatable receipt — see
[production readiness](state/production-readiness.md).

## Gate stack

| Gate                  | Guards                                                                  |
| --------------------- | ----------------------------------------------------------------------- |
| `check`               | full workspace build, lint, and tests                                   |
| formatting            | canonical formatting                                                    |
| `standards-gate`      | license split, manifest/price authority, RLS and entitlement invariants |
| dependency graph      | TypeScript-aware dependency direction and coverage sentinels            |
| `registry-index`      | byte-identical rebuild from the append-only ledger                      |
| `oscal-conformance`   | OSCAL schema/round-trip validity                                        |
| `deterministic`       | security scan and deterministic artifact checks                         |
| `support-bot`         | the Python gate for `services/support-bot` (required since ADR-0414)    |
| `runtime-images-gate` | aggregate of the per-image runtime scan matrix (required since R359)    |
| `sot`                 | ADR ceiling, state freshness, archive, tracker, and changeset drift     |

Local gates are executable. Private-repository access has been authorized since 2026-06-30, so
GitHub Actions and release evidence are certifiable — the current dispositions live in
[production readiness](state/production-readiness.md).
