# Architecture

The system map: a single synthesized index of the Caisson monorepo (layers, dependency
direction, the publish seam, the data tiers) plus a **filesystem-verified build-status
catalog** that no other doc owns.

**This file does not own the design.** Canonical shape lives in
[`specs/01-architecture.md`](../specs/01-architecture.md) and the ADRs under
[`knowledge/decisions/`](../knowledge/decisions/); each section below routes to the ADR
that decides it. This file is the map + the verified inventory, not a re-statement. On
conflict the spec/ADR wins (CLAUDE.md source-of-truth hierarchy).

> Build-status claims here were verified against the working tree on **2026-06-28** (src
> file counts, test presence, LOC). They drift as code lands; re-run the checks in the
> last section before trusting a status.

---

## 1. Layers (ingress order: standards -> packages -> registry -> apps -> services)

Full annotated tree: [`specs/01-architecture.md` §1](../specs/01-architecture.md). One line
per layer:

| Layer          | Path              | Owns                                                                                                                                                                 | Decides                                                                                                                                         |
| -------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Standards gate | `tooling/`        | the ONE eslint/tsconfig/test/lint-gate source; nothing ships except through it                                                                                       | [ADR-0001](../knowledge/decisions/ADR-0001-monorepo-tooling.md), [ADR-0002](../knowledge/decisions/ADR-0002-engineering-invariants.md)          |
| Packages       | `packages/*` (35) | independently-sellable capability units; framework-free                                                                                                              | [ADR-0003](../knowledge/decisions/ADR-0003-composable-package-base-split.md)                                                                    |
| Registry       | `registry/`       | versioned module sources + derived index; the single publish ingress + the one allowlist                                                                             | [ADR-0004](../knowledge/decisions/ADR-0004-generator-registry-codegen-credits.md)                                                               |
| Apps           | `apps/*` (7)      | one runnable reference template per edition + the GTM site + the admin control-plane (absorbed the design studio, ADR-0140); the ONLY layer that imports a framework | [ADR-0003](../knowledge/decisions/ADR-0003-composable-package-base-split.md)                                                                    |
| Services       | `services/*` (3)  | seller-platform side-cars: license issuer, docs, support-bot                                                                                                         | [ADR-0008](../knowledge/decisions/ADR-0008-buyer-mcp-server-auth.md), [ADR-0009](../knowledge/decisions/ADR-0009-custom-support-bot-service.md) |

Runtime/PM: Bun + TypeScript strict everywhere except `services/support-bot` (Python,
operator choice; NOT a Bun workspace member). Build orchestration: Turborepo
(`turbo run build|lint|test`). Versioning: changesets, per-package.

Bun workspaces (root `package.json`): `tooling/*`, `packages/*`, `apps/*`, `registry`,
`services/license`, `services/docs`. `services/support-bot` is intentionally outside the
workspace (Python).

---

## 2. Composable-package model + dependency direction

Editions are **compositions, never forks**: an edition package depends on a curated set of
base packages and adds vertical logic. It never copies base code, never depends "up" on
another edition, and no base package depends "up" on an edition. Rule:
[ADR-0003](../knowledge/decisions/ADR-0003-composable-package-base-split.md); CI
enforcement: [ADR-0022](../knowledge/decisions/ADR-0022-import-boundary-lint-gates.md).

The package set splits into 20 **base/primitive** packages and **4 edition** packages
(`compliance`, `ai-kit`, `local-ai`, `agent-dev`). The split is encoded as data in
[`.dependency-cruiser.cjs`](../.dependency-cruiser.cjs) (`BASE_PKGS` / `EDITIONS`).

```
                framework boundary (only apps cross it)
   apps/site  apps/admin   apps/compliance  apps/ai-kit  apps/local-ai  apps/base  apps/agent-dev
   (Next 16)  (Next 16)    (Next 16)        (Next 15)    (Next 16)      (plain TS) (plain TS)
        |          |            |               |             |             |           |
        v          v            v               v             v             v           v
   +-----------------------------------------------------------------------------------------+
   |                          EDITIONS (compositions)                                        |
   |   compliance        ai-kit          local-ai         agent-dev                          |
   +------|------------------|----------------|----------------|----------------------------+
          |  down-only       |                |                |     (no edition -> edition)
          v  (ADR-0003)      v                v                v
   +-----------------------------------------------------------------------------------------+
   |             BASE + PRIMITIVE PACKAGES (framework-free, independently sellable)           |
   |  kernel  tenancy-rls  field-crypto  auth  billing  credits  ai-config  mcp-server  ui    |
   |  jobs  email  audit-worm  agent-kernel  local-store  prompt-registry  ai-meter           |
   |  guardrails  ai-evals  license-verify                          cli (create-caisson)      |
   +-----------------------------------------------------------------------------------------+
          ^                                              ^
          | builds to                                    | consumes (no upward edge)
   +--------------+                              +-------------------+
   | tooling/     |  standards gate (one source) | registry/         |  versioned sources + index
   +--------------+                              +-------------------+
```

Provider-SDK reach is a second directed boundary: **only `ai-config` + `ai-kit`** may
import a model-provider SDK ([ADR-0011](../knowledge/decisions/ADR-0011-provider-agnostic-ai-config.md));
everything else routes through `ai-config`. Enforced in the cruiser
(`no-provider-sdk-outside-ai`) and ESLint.

---

## 3. Framework-free packages (verified)

**Rule:** a `packages/*` unit imports no web framework; only `apps/*` may import Next.js.
This keeps every package independently sellable and composable into any host.

**Verification (2026-06-28):** no file under any `packages/*/src` imports `next` or
`react` (grep clean). The `ui` package currently ships **design tokens only** (`src/index.ts`
is 32B + `tokens/`); it has no React components yet, so even the UI layer holds the line.
Of the 7 apps, 5 carry a Next dependency (`site`, `admin`, `compliance`, `ai-kit`,
`local-ai`); `apps/base` and `apps/agent-dev` are plain-TS reference consumers with no
framework at all.

---

## 4. The standards-gate + registry seam (single publish ingress)

A module enters the buyer-reachable surface **only through the `tooling/` standards gate +
the registry**; there is no other ingress
([ADR-0004](../knowledge/decisions/ADR-0004-generator-registry-codegen-credits.md),
[ADR-0022](../knowledge/decisions/ADR-0022-import-boundary-lint-gates.md)).

**Three enforcement layers** (belt-and-suspenders; each closes a hole the others miss; full
division-of-labor table in [ADR-0022](../knowledge/decisions/ADR-0022-import-boundary-lint-gates.md)):

| Layer                           | File                                                    | Authority                                                                           |
| ------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| ESLint `no-restricted-imports`  | `tooling/eslint-config/boundaries.js`                   | fast static provider-SDK import signal                                              |
| dependency-cruiser              | [`.dependency-cruiser.cjs`](../.dependency-cruiser.cjs) | the real module graph: dynamic + transitive reach, base->edition direction, cycles  |
| `@caisson/standards-gate` (Bun) | `tooling/standards-gate/src/checks.ts`                  | SPDX/license authority: AGPL boundary, down-only, manifest<->package.json agreement |

Verified gate checks (`checks.ts`): `checkAgplBoundary`, `checkExternalAgpl`,
`checkDownOnly`, `checkDeclarations`, `checkManifestAgreement`. The kernel also exposes a
runnable gate entry at `packages/kernel/src/gate.ts` (root `bun run gate`).

**Registry** (`registry/`, verified built): typed schema
(`registry/schema/{module-manifest,registry-index,entitlements,feature-tags}.ts` +
golden-file tests), an index builder (`registry/scripts/build-index.ts` + test), and a
Cloudflare Worker (`registry/worker/handler.ts` + `wrangler.toml`). The **registry index is
the single source of truth** for which modules exist, what they cost, and edition/bundle
membership; the CLI, the buyer's agent, and the docs all read it (one artifact, many
consumers).

**Entitlement -> allowlist** is registry-derived
([ADR-0071](../knowledge/decisions/ADR-0071-entitlement-expansion-registry-graph.md)): an
edition's members = every manifest whose `editions[]` contains it; the bundle = the union;
a resolver expands a purchased edition/bundle id into member-module slugs at gate time
against the current index. Membership is never hand-listed and never frozen into the license
token, so adding a module to an edition reaches existing buyers with no re-issue.

`create-caisson` (`packages/cli`) reads the registry to compose a tailored repo; each run is
a `generation` row + a credit debit (the codegen meter,
[ADR-0007](../knowledge/decisions/ADR-0007-credit-metering-model.md)).

---

## 5. Data tiers + migration assembly

Two persistence tiers, one invariant ("tenant boundary == enforced boundary"), enforced
differently per tier:

| Tier                                   | Isolation floor        | Mechanism                                                                                                                    | ADR                                                                             |
| -------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Postgres (control plane + hosted apps) | fail-closed RLS        | `account_id` on every tenant row + Postgres RLS keyed by `SET LOCAL` (`withTenant`); a missing `WHERE` fails closed          | [ADR-0005](../knowledge/decisions/ADR-0005-fail-closed-rls-tenancy.md)          |
| Local SQLite (local-ai, agent-dev)     | one DB file per tenant | the resolved file path IS the boundary; a cross-tenant query is not expressible; path derived server-side, traversal-guarded | [ADR-0073](../knowledge/decisions/ADR-0073-local-tenancy-db-file-per-tenant.md) |

Both tiers pin field-crypto keys **per-tenant-derived** so an exfiltrated row/file is still
AAD/tenant-scoped ciphertext
([ADR-0043](../knowledge/decisions/ADR-0043-field-crypto-per-tenant-keys.md),
[ADR-0045](../knowledge/decisions/ADR-0045-field-crypto-aead-cipher.md)). The WORM audit
chain + append-only locked artifacts are the Compliance-edition layer on top
([ADR-0006](../knowledge/decisions/ADR-0006-worm-audit-chain-field-crypto.md)).

**Migration assembly** ([ADR-0070](../knowledge/decisions/ADR-0070-migration-assembly-single-ledger.md)):
each package owns numbered, forward-only, append-only migrations in its own namespace
(`packages/<pkg>/migrations/NNNN_*.sql`); a **compose-time assembler** (built:
`packages/kernel/src/migration-assembly.ts` + test) topologically merges the selected
packages' migrations into one ordered sequence and computes a **single `schema_version`
checksum ledger** over the merged set. No package owns global ordering; no edition owns
assembly. Note: no `packages/*/migrations/` directories exist on disk yet (the assembler is
built; package-owned migration files are not yet populated).

---

## 6. Build-status catalog (verified 2026-06-28)

The synthesized inventory this file owns. Status reflects **code volume + test presence**,
NOT feature-completeness. `LOC` = non-test `.ts` lines under `src/`; `T` = `*.test.ts`
count.

> **Authoritative business-claims framing:** [ADR-0082 §3](../knowledge/decisions/ADR-0082-go-live-site-posture.md)
> (go-live copy posture) declares that only the base substrate (kernel, tenancy-rls,
> field-crypto, auth, billing, credits) + `create-caisson` are "built," and classifies the
> four editions as **"structure only"** for the purpose of not over-claiming on the site.
> The filesystem now shows materially more merged code than that snapshot (e.g. compliance
> 2871 LOC / local-ai 2209 LOC), but it remains **scaffold with stub internals in places**
> (e.g. `packages/local-ai/src/inference/stub.ts`, an `onnx-backend.ts` TODO), not
> production-complete. **Do not claim any edition is fully built.** When in doubt the
> ADR-0082 framing governs external claims.

### Base substrate (built + tested; the load-bearing core)

| Package        |  LOC |   T | Role                                                                                                 |
| -------------- | ---: | --: | ---------------------------------------------------------------------------------------------------- |
| `kernel`       | 1363 |   9 | governance: config, gate, audit-chain, migration-assembly, event-sink, errors, crypto, observability |
| `field-crypto` | 1319 |   9 | per-tenant AEAD field encryption                                                                     |
| `credits`      |  328 |   2 | integer credit ledger, debit-before-spend, 402                                                       |
| `billing`      |  249 |   1 | MoR / subscription spine                                                                             |
| `auth`         |  143 |   1 | EdDSA JWT + JWKS seam                                                                                |
| `tenancy-rls`  |   75 |   1 | `withTenant` / `SET LOCAL` fail-closed RLS (the hero primitive)                                      |
| `cli`          |  488 |   3 | `create-caisson` generator                                                                           |

### Base/primitive packages (substantial code + tests; scaffold, not feature-complete)

| Package        |  LOC |   T |     | Package           | LOC |   T |
| -------------- | ---: | --: | --- | ----------------- | --: | --: |
| `audit-worm`   | 1302 |   6 |     | `prompt-registry` | 582 |   2 |
| `agent-kernel` | 1101 |   7 |     | `guardrails`      | 520 |   2 |
| `local-store`  | 1043 |   7 |     | `mcp-server`      | 514 |   2 |
| `ai-meter`     |  957 |   3 |     | `license-verify`  | 272 |   2 |
| `ai-evals`     |  800 |   1 |     |                   |     |     |

### Thin / token-only base packages

| Package     | LOC |   T | Note                                        |
| ----------- | --: | --: | ------------------------------------------- |
| `ui`        | 381 |   1 | design tokens only; no React components yet |
| `email`     |  82 |   1 | thin                                        |
| `jobs`      |  73 |   1 | thin                                        |
| `ai-config` |  49 |   1 | provider-agnostic resolver; near-stub       |

### Edition packages (compositions; "structure only" per ADR-0082 §3, scaffold with stubs)

| Package      |  LOC |   T | Edition                                                                                                                                                          | License note                                                                                                                                                                              |
| ------------ | ---: | --: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `compliance` | 2871 |  11 | Compliance (HERO): evidence/, frameworks/, migrate/, registry/                                                                                                   | commercial                                                                                                                                                                                |
| `local-ai`   | 2209 |   9 | Local-first AI: privacy/egress-guard + inference/ (stub backend present)                                                                                         | now COMMERCIAL, AGPL flank killed ([ADR-0083](../knowledge/decisions/ADR-0083-local-first-fully-commercial.md), [ADR-0050](../knowledge/decisions/ADR-0050-local-ai-fully-commercial.md)) |
| `agent-dev`  |  761 |   3 | Agentic-Dev: thinnest edition surface (the [ADR-0082 §4](../knowledge/decisions/ADR-0082-go-live-site-posture.md) roadmap label was retired by ADR-0237 rider 2) | commercial                                                                                                                                                                                |
| `ai-kit`     |  358 |   2 | AI Production Kit: gateway (one of two provider-SDK consumers)                                                                                                   | commercial                                                                                                                                                                                |

Note: every package and edition is uniform fully-commercial
([ADR-0023](../knowledge/decisions/ADR-0023-fully-commercial-licensing-model.md)); the old
AGPL boundary survives in the gate only as a defensive check, with no AGPL package shipped.

### Apps (7) — reference templates + GTM surface

| App          | Framework       | Built?               | Note                                                                              |
| ------------ | --------------- | -------------------- | --------------------------------------------------------------------------------- |
| `site`       | Next 16         | yes (43 tsx, 20 mdx) | GTM marketing + Fumadocs docs, standalone Node app on Railway (ADR-0114/0115)     |
| `admin`      | Next 16         | yes (20 tsx)         | operator control-plane; absorbed the design-system studio (ADR-0140)              |
| `compliance` | Next 16         | thin shell (2 tsx)   | edition reference template                                                        |
| `ai-kit`     | Next 15         | thin shell (3 tsx)   | edition reference template                                                        |
| `local-ai`   | Next 16         | thin shell (2 tsx)   | edition reference template                                                        |
| `base`       | none (plain TS) | thin                 | reference consumer; deps: auth, billing, credits, kernel, mcp-server, tenancy-rls |
| `agent-dev`  | none (plain TS) | stub                 | roadmap edition template (src/ + test/ only)                                      |

### Services (3) — essentially unbuilt

| Service       | State                                 | Note                                                                 |
| ------------- | ------------------------------------- | -------------------------------------------------------------------- |
| `license`     | stub (`package.json` + `README` only) | Ed25519 issuer + MoR webhook + credit grants (planned)               |
| `docs`        | stub (`package.json` + `README` only) | AI-native docs source (planned)                                      |
| `support-bot` | stub (`README` only)                  | Python; Discord + LLM dispatch + codebase RAG; outside Bun workspace |

Repo-wide test files (`packages` + `tooling` + `registry` + `apps`): **101**.

### Re-verify

```bash
# per-package src LOC + test count
for p in packages/*; do n=$(basename "$p"); \
  loc=$(find "$p/src" -name '*.ts' ! -name '*.test.ts' 2>/dev/null | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}'); \
  t=$(find "$p" -name '*.test.ts' 2>/dev/null | wc -l); echo "$n loc=${loc:-0} tests=$t"; done
# framework-free check (expect: empty)
grep -rlE "from ['\"]next|from ['\"]react" packages/*/src 2>/dev/null
```

---

## 7. Source-of-truth routing

| For the decision on...                           | Canonical source                                                                                                                                                                                                                   |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monorepo shape + the two planes + data model     | [`specs/01-architecture.md`](../specs/01-architecture.md)                                                                                                                                                                          |
| Composable packages, no-upward-dep               | [ADR-0003](../knowledge/decisions/ADR-0003-composable-package-base-split.md)                                                                                                                                                       |
| Generator + registry + codegen-credits           | [ADR-0004](../knowledge/decisions/ADR-0004-generator-registry-codegen-credits.md)                                                                                                                                                  |
| Import-boundary CI gates (3 layers)              | [ADR-0022](../knowledge/decisions/ADR-0022-import-boundary-lint-gates.md)                                                                                                                                                          |
| Fail-closed RLS tenancy                          | [ADR-0005](../knowledge/decisions/ADR-0005-fail-closed-rls-tenancy.md)                                                                                                                                                             |
| Local SQLite file-per-tenant                     | [ADR-0073](../knowledge/decisions/ADR-0073-local-tenancy-db-file-per-tenant.md)                                                                                                                                                    |
| Migration assembly + single ledger               | [ADR-0070](../knowledge/decisions/ADR-0070-migration-assembly-single-ledger.md)                                                                                                                                                    |
| Entitlement -> allowlist graph                   | [ADR-0071](../knowledge/decisions/ADR-0071-entitlement-expansion-registry-graph.md)                                                                                                                                                |
| WORM audit chain + field-crypto                  | [ADR-0006](../knowledge/decisions/ADR-0006-worm-audit-chain-field-crypto.md), [ADR-0043](../knowledge/decisions/ADR-0043-field-crypto-per-tenant-keys.md), [ADR-0045](../knowledge/decisions/ADR-0045-field-crypto-aead-cipher.md) |
| Build-status framing for external claims         | [ADR-0082 §3](../knowledge/decisions/ADR-0082-go-live-site-posture.md)                                                                                                                                                             |
| Live decision board (locked + open)              | [`docs/state/decisions-and-forks.md`](state/decisions-and-forks.md)                                                                                                                                                                |
| ADR number renumber (GTM 0045-0048 -> 0084-0087) | [ADR-0088](../knowledge/decisions/ADR-0088-adr-number-collision-renumber.md)                                                                                                                                                       |
