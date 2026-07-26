---
updated: 2026-07-25
status: live
grounds:
  - package.json
  - packages/
  - apps/
  - services/
  - registry/
  - tooling/
  - apps/site/lib/pricing.ts
  - packages/pricebook/src/upgrades.ts
  - tooling/standards-gate/src/checks.ts
---

# Package catalog — license, sale posture, and price

The July 25 disk-truth view. This document owns the catalog summary; manifests, price authority,
and the standards gate are the executable sources. Build depth remains in
[build-state](../build-state.md).

## Workspace inventory

| Surface              |  Count | Members                                                            |
| -------------------- | -----: | ------------------------------------------------------------------ |
| Packages             |     61 | 17 Apache-2.0; 44 commercial                                       |
| Apps                 |      7 | `admin`, `site`, and five reference/demo apps                      |
| Bun services         |      4 | `betterstack-adapter`, `docs`, `intel`, `license`                  |
| Registry             |      1 | `@caisson/registry` plus its Worker                                |
| Tooling workspaces   |      6 | browser audit, design critic, eslint, standards, testing, tsconfig |
| Python projects      |      2 | `services/support-bot`, `tools/assert-lane` — frozen at two        |
| Bun workspaces total | **79** | root `workspaces` discovery                                        |

## Open Base — 17 Apache-2.0 packages

All are free and never individually sold. Open packages may depend only on other open packages.

| Package           | Role                                           |
| ----------------- | ---------------------------------------------- |
| `ai-config`       | provider-neutral AI configuration              |
| `analytics`       | analytics port and drivers                     |
| `auth`            | sessions and auth/RLS seam                     |
| `billing`         | buyer-side billing port                        |
| `cli`             | generator and delivery client                  |
| `ds-manifest`     | design-system manifest, reader, and validation |
| `email`           | email port                                     |
| `jobs`            | job queue/consumer port                        |
| `kernel`          | shared config, schemas, errors, hashing        |
| `license-verify`  | offline license verification                   |
| `mcp-server`      | buyer MCP transport                            |
| `migrate`         | migration assembler and runner                 |
| `observability`   | vendor-neutral telemetry                       |
| `rate-limit`      | IP/account limiter primitives                  |
| `registry-schema` | public registry contract                       |
| `tenancy-rls`     | fail-closed tenant isolation                   |
| `ui`              | open design-system component floor             |

## Commercial catalog

### Six bundles

| Bundle        | One-time price | Renewal |
| ------------- | -------------: | ------: |
| Compliance    |     **$1,649** |    $659 |
| AI-Production |           $739 |    $289 |
| Local-first   |           $629 |    $249 |
| Agentic-Dev   |           $329 |    $129 |
| Provenance    |           $399 |    $159 |
| Everything    |         $2,259 |    $899 |

Compliance’s current manifest and storefront price are $1,649. Historical append-only ledger
entries retain their then-current values and are not rewritten.

### Twenty-seven à-la-carte modules

| Module                  | Price | Bundle membership                                  |
| ----------------------- | ----: | -------------------------------------------------- |
| `access-review`         |  $199 | Compliance                                         |
| `agent-kernel`          |  $199 | Agentic-Dev                                        |
| `agent-runner`          |   $49 | Agentic-Dev                                        |
| `agent-trajectory`      |   $49 | Agentic-Dev                                        |
| `ai-evals`              |  $199 | AI-Production                                      |
| `ai-meter`              |  $199 | AI-Production                                      |
| `alerting`              |  $149 | Compliance                                         |
| `audit-worm`            |  $149 | Compliance, Provenance                             |
| `billing-orchestration` |   $99 | Everything only                                    |
| `compliance-core`       |  $299 | Compliance                                         |
| `credits`               |  $149 | AI-Production                                      |
| `field-crypto`          |  $199 | Compliance, AI-Production, Local-first, Provenance |
| `frameworks-pack`       |  $249 | Compliance                                         |
| `guardrails`            |  $149 | AI-Production                                      |
| `local-inference`       |  $249 | Local-first                                        |
| `local-privacy`         |   $99 | Local-first                                        |
| `local-store`           |   $99 | Local-first, Agentic-Dev                           |
| `local-sync`            |  $199 | Local-first                                        |
| `org-controls`          |  $249 | Everything only                                    |
| `oscal-spine`           |  $249 | Compliance                                         |
| `prompt-registry`       |   $99 | AI-Production                                      |
| `retention-runner`      |  $199 | Compliance                                         |
| `risk-register`         |  $279 | Compliance                                         |
| `signing-primitive`     |  $199 | Compliance, Provenance                             |
| `tool-exec`             |   $99 | Agentic-Dev                                        |
| `trust-page`            |  $149 | Compliance                                         |
| `ui-pro`                |  $129 | Everything only                                    |

`PRICE_AUTHORITY` covers every row in this table. Its 36 entries also include the six bundle SKUs
and three retired legacy aliases retained for historical resolution. The standards gate rejects
every current sellable commercial module missing from price authority or the site catalog; the
two legitimate $49 modules have no special exemption.

### Commercial packages outside the à-la-carte module table

| Class                          | Packages                                                                                                                                                                   |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sellable bundle SKUs           | `compliance`, `ai-production`, `local-first`, `agentic-dev`, `provenance`, `everything`                                                                                    |
| Retired aliases                | `ai-kit`, `agent-dev`, `local-ai` — explicitly `sellable: false`, retained in price authority for historical resolution                                                    |
| Runtime and delivery substrate | `agent-usage`, `artifact-render`, `audit-harness`, `brand`, `demo-registry`, `license-issue`, `platform-migrations`, `platform-reads`, `pricebook` — never separately sold |

The six bundle packages are products, but not à-la-carte modules. The remaining packages stay
commercial where their code is proprietary and are not independently purchasable.
`artifact-render` may be published to satisfy dependency resolution and is still never sold.

## Applications, services, registry, and tooling

| Surface      | Members                                                                                    | Sale posture                                        |
| ------------ | ------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| Apps         | `site`, `admin`, `base`, `compliance`, `ai-kit`, `local-ai`, `agent-dev`                   | storefront/control-plane/reference apps; never SKUs |
| Bun services | `license`, `docs`, `intel`, `betterstack-adapter`                                          | operator infrastructure; never SKUs                 |
| Python       | `support-bot`, `assert-lane`                                                               | one service and one verification tool; no expansion |
| Registry     | `@caisson/registry` and Worker                                                             | commercial fulfillment infrastructure               |
| Tooling      | `browser-audit`, `design-critic`, `eslint-config`, `standards-gate`, `testing`, `tsconfig` | private build-time infrastructure                   |

## Enforced invariants

- `tooling/standards-gate` enforces the 17-package Apache set and blocks open→commercial
  dependencies.
- Bundle-only/runtime commercial manifests state `sellable: false`; sellable manifests use the
  schema’s default and must appear in total price authority.
- `apps/site/lib/pricing.ts`, `packages/pricebook/src/upgrades.ts`, package manifests, Paddle
  catalog generation, and license fulfillment are parity-tested against one catalog.
- Prices and credits are integers. Unknown product IDs fail closed.
- Six bundles and 26 module SKUs are the only one-time product surface; production recreation is
  35 products and 66 prices after subscriptions and renewal rows are included.

## Decision lineage

ADR-0094/0097 own open-core; ADR-0257/0258 own the six-bundle vocabulary; ADR-0260 owns renewal
math; ADR-0373 owns the Compliance-gap SKUs and their superseded $1,449 bundle price; ADR-0379 owns total price
authority and explicit non-sellable posture.
