---
updated: 2026-09-26
status: live
grounds:
  - package.json
  - tooling/standards-gate/src/checks.ts
  - tooling/standards-gate/src/dependency-graph-guard.ts
  - .github/workflows/ci.yml
  - .github/workflows/security.yml
  - .github/workflows/release.yml
  - apps/site/wrangler.jsonc
---

# Architecture — one-page map

Deep design lives in [specs/01-architecture.md](../specs/01-architecture.md) and
append-only decisions in [knowledge/decisions](../knowledge/decisions).

## Monorepo

| Tree        | Count | Purpose                                                                               |
| ----------- | ----: | ------------------------------------------------------------------------------------- |
| `packages/` |    48 | framework-free capability units, all Apache-2.0 (ADR-0428)                            |
| `apps/`     |     2 | `site` (marketing + docs + demo gallery), `demos` (interactive demos)                 |
| `tooling/`  |     7 | audit harness, demo registry, lint policy, scripts, standards gate, testing, tsconfig |

The root carries 56 Bun workspaces (`tooling/*` + `packages/*` + `apps/*`). There is no
separate registry service, admin app, or hosted backend — `create-caisson` and the
`mcp-server` package read the public npm registry and a schema library
(`@caisson-sh/registry-schema`), not a Caisson-run ledger.

Dependency direction is down-only: a base-substrate package can never depend on a bundle
package, and bundle composition cannot flow upward into another bundle
([ADR-0003](../knowledge/decisions/ADR-0003-composable-package-base-split.md)). The
standards gate enforces manifest invariants; dependency-cruiser enforces graph direction,
and its guard fails unless project TypeScript is active, representative `.ts`/`.tsx`
sentinels appear, and the graph has realistic module/edge counts.

## Provider ports

Provider SDKs are isolated behind the package that owns each port:

| Port           | Owner                  | Current adapters                                                    |
| -------------- | ---------------------- | ------------------------------------------------------------------- |
| AI/model       | `ai-kit` / `ai-config` | frozen eight-adapter family                                         |
| Jobs           | `jobs`                 | existing queue adapters; Inngest v4 is the active ADR-0379 addition |
| KMS            | `field-crypto`         | AWS/GCP/Azure clients — a self-hosted deployment picks one          |
| WORM artifacts | `audit-worm`           | S3/GCS/R2 family; Azure Blob is the active addition                 |

Core contracts receive injected clients/config and do not read ambient provider
credentials.

## Architectural invariants

- **Down-only composition:** a bundle is a composition of base-substrate packages plus
  vertical logic, never a fork; the reverse dependency never happens.
- **Tenant data:** `packages/tenancy-rls` implements Postgres RLS as fail closed, with
  generator parity CI-enforced — a building block for anything built on top of Caisson,
  not a Caisson-run service.
- **Money:** `packages/billing` and `packages/billing-orchestration` implement a
  provider-agnostic (Stripe/Paddle/LemonSqueezy/Polar) webhook + event port with
  integer-unit amounts and fail-closed unknown-SKU handling — again a building block, not
  something Caisson itself runs commercially.
- **Evidence:** audit chains, signed anchors, proof endpoints, and WORM exports keep
  redaction and provenance explicit. A technical receipt is required before a claim is
  promoted.

## Design-system surface

`@caisson-sh/ui` and `@caisson-sh/ui-pro` expose 39 components. `@caisson-sh/ds-manifest`
is the shared schema/reader/contrast authority consumed by the CLI and MCP surfaces. The
checked-in base manifest is deterministically generated from all 39 primary
`@caisson-sh/ui` component modules; CI checks its barrel bijection and exact bytes. The UI
quality gate and agent doctor share one browser-rendered contrast implementation,
including semantic, functional, and code-syntax colors.

## Deploy topology

`caisson.sh` is a single static export (`apps/site`, with `apps/demos` nested under
`/demos`) served by Cloudflare Workers static assets — no server, no database, every
request is an asset read (`apps/site/wrangler.jsonc`). `.github/workflows/site.yml`
rebuilds and redeploys it on every `main` push that touches the site, the demos app, a
package, or `tooling/`. Publishing packages to npm is a separate flow
(`.github/workflows/release.yml`): Changesets versions on merge, then
`tooling/scripts/publish-packages.ts` publishes anything not yet on npm through npm
trusted publishing (OIDC, provenance) — no registry token, no Caisson-run registry.

## Gate stack

| Gate                | Guards                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| `standards-gate`    | manifest/license declarations, down-only dependency direction, import boundaries                 |
| `check`             | full workspace build, lint, typecheck, test, format, deterministic evals                         |
| `oscal-conformance` | NIST OSCAL v1.2.2 schema/round-trip validity                                                     |
| `native-ext`        | the platform-specific sqlite-vec extension on Linux + macOS (main only)                          |
| `site-e2e`          | Playwright against a production build of the site                                                |
| `evidence-pack`     | assembles the build-provenance evidence pack for the commit                                      |
| `dts-drift`         | declaration-emit drift when a PR bumps the pinned TypeScript compiler                            |
| `deterministic`     | the pinned security-scan layer (`security.yml`): semgrep, trivy, osv-scanner, trufflehog, zizmor |

`ci` (in `ci.yml`) is the one required status check and passes only when every job above
it passed or was skipped by its own event gate. Local gates mirror CI: `bun run check`
runs the same build/lint/typecheck/test/gate sequence as the `check` job.
