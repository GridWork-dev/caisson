---
updated: 2026-09-05
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
  Access assertion on every request except the `/healthz` canary. **Not yet true in production:**
  the serving revision predates #448, and no Access application fronts `admin.caisson.sh` today
  (measured 2026-08-26) — production Access is deferred to the Wave-5 edge sequencing.
- **Buyer gates:** marketing/docs/API are public; `/dashboard*` and `/cart*` are Cloudflare Access
  gated pre-launch.
- **Evidence:** audit chains, signed anchors, proof endpoints, and WORM exports keep redaction and
  provenance explicit. A technical receipt is required before a claim is promoted.

## Design-system surface

`@caisson-sh/ui` and `@caisson-sh/ui-pro` expose 39 components. `@caisson-sh/ds-manifest` is the shared
schema/reader/contrast authority consumed by CLI and MCP surfaces. The checked-in base manifest is
deterministically generated from all 39 primary `@caisson-sh/ui` component modules; CI checks its
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

All six services run `9cb7681c` (the 2026-08-25 #455 ride, run `32892857628` — deployment ids
`4294e507` site, `52b14a07` admin, `cd0fa10b` demos, `e1656466` docs, `86599eee` license,
`2cc0825f` support-bot, verified against the applied manifests 2026-08-26). **`main` is ahead by
4 commits / 151 files:** #448's ride failed on admin's healthcheck and Railway deploys are frozen
until the gate topology is decided — see [deploy state](deploy/STATE.md) and CAISSON-208. The index parity probe reports
`dc5ee000aebf`/54 entries equal across repo, license, Worker, and admin. Docs-RAG and support-bot
are private services reachable only through a Turnstile-gated site proxy, so their source parity
still has no automatable receipt — see
[production readiness](state/production-readiness.md).

## Gate stack

| Gate                | Guards                                                                  |
| ------------------- | ----------------------------------------------------------------------- |
| `check`             | full workspace build, lint, and tests                                   |
| formatting          | canonical formatting                                                    |
| `standards-gate`    | license split, manifest/price authority, RLS and entitlement invariants |
| dependency graph    | TypeScript-aware dependency direction and coverage sentinels            |
| `registry-index`    | byte-identical rebuild from the append-only ledger                      |
| `oscal-conformance` | OSCAL schema/round-trip validity                                        |
| `deterministic`     | security scan and deterministic artifact checks                         |
| `sot`               | ADR ceiling, state freshness, archive, tracker, and changeset drift     |

Local gates are executable. Private-repository access has been authorized since 2026-06-30, so
GitHub Actions and release evidence are certifiable — the current dispositions live in
[production readiness](state/production-readiness.md).
