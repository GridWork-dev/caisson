---
updated: 2026-07-13
status: live
---

# Public vs commercial package surface

Dated **2026-07-02**, §2 refreshed **2026-07-06** for the six-bundle catalog rework
(ADR-0257/0258 — supersedes the edition-era §2 below). This file OWNS the **npm-distribution-reality** view: for every
`packages/*` module — is it Apache-2.0 or `LicenseRef-Caisson-Commercial`, and where does the
code actually land today versus where the plan says it lands. `docs/state/package-catalog.md`
owns the license/price/sold-as catalog and `docs/archive/public-surface-minimization.md` owns the
registry-Worker free-floor leak analysis (ADR-0136) — this file cites both, it does not restate
their tables. What is new here and lives nowhere else: the npm-scope + public-mirror-repo
distribution reality (§3–4, forks CLOSED by ADR-0222/0223 on 2026-07-02).

**Method:** every `packages/*/package.json` `license`/`private`/`publishConfig` field read
directly off disk, cross-checked against `tooling/standards-gate/src/checks.ts`
(`OPEN_BASE_NAMES`), `registry/index.json` (46 modules, schema v1, current as of 2026-07-11), `.github/workflows/publish.yml`,
and ADR-0094 (open-core split), ADR-0097 (registry-schema split), ADR-0136 (license-keyed gate +
tooling-open), ADR-0111 (publish-readiness split plan), ADR-0069 (publish credential).

---

## 1. Apache-2.0 PUBLIC set (16 packages)

The `OPEN_BASE_NAMES` set the standards-gate enforces (`checkOpenCoreLicensing`). Every package
below carries `license: "Apache-2.0"`, no `private` flag, and `publishConfig.registry:
"https://registry.npmjs.org/"` in its own `package.json` — that registry target is the **plan**
(ADR-0111), not where the code lands today; see §3.

| Package                    | Purpose                                                                                                                           | License    | Distributed TODAY                                                                             |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------- |
| `@caisson/kernel`          | Governance kernel: typed config loader, `CaissonError` model, security primitives, the standards gate                             | Apache-2.0 | Not published. Metadata served unauthenticated by the registry Worker (base floor, ADR-0136). |
| `@caisson/auth`            | Auth seam: EdDSA-JWT account tokens (RLS seam) + session contract, better-auth provider                                           | Apache-2.0 | same                                                                                          |
| `@caisson/tenancy-rls`     | Fail-closed multi-tenant Postgres RLS (FORCE policies + `withTenant`)                                                             | Apache-2.0 | same                                                                                          |
| `@caisson/ui`              | Design-system kit: OKLCH token floor + Radix-behavior component recipes                                                           | Apache-2.0 | same                                                                                          |
| `@caisson/billing`         | Stripe + Paddle billing behind a `BillingProvider` port                                                                           | Apache-2.0 | same                                                                                          |
| `@caisson/analytics`       | Vendor-neutral `AnalyticsProvider` port: capture driver for tests + Plausible/PostHog/GA4 drivers (ADR-0287), fail-open by design | Apache-2.0 | same                                                                                          |
| `@caisson/jobs`            | Provider-agnostic background-job queue port                                                                                       | Apache-2.0 | same                                                                                          |
| `@caisson/email`           | Transactional email port (Resend/Postmark/SMTP/SES drivers)                                                                       | Apache-2.0 | same                                                                                          |
| `@caisson/ai-config`       | Provider-agnostic AI config resolver + buyer settings file                                                                        | Apache-2.0 | same                                                                                          |
| `@caisson/mcp-server`      | Auth-gated buyer MCP transport: timing-safe Bearer, entitlement-scoped reads, credit-gated `generate`                             | Apache-2.0 | same                                                                                          |
| `@caisson/registry-schema` | Open registry contract: module-manifest schema, index schema, allowlist helpers, feature-tags, entitlement-expansion math         | Apache-2.0 | same                                                                                          |
| `@caisson/observability`   | Vendor-neutral OTel bootstrap (env-gated, inert until `OTEL_EXPORTER_OTLP_ENDPOINT` is set)                                       | Apache-2.0 | same                                                                                          |
| `@caisson/cli`             | `create-caisson` generator: composes a tailored repo from the versioned registry                                                  | Apache-2.0 | same                                                                                          |
| `@caisson/migrate`         | Base migration assembler/runner (merges per-package `migrations/*.sql` into one sequence)                                         | Apache-2.0 | same                                                                                          |
| `@caisson/license-verify`  | Offline Ed25519 license-token verification (tessera wire format, baked-in public key)                                             | Apache-2.0 | same                                                                                          |
| `@caisson/rate-limit`      | Per-IP token-bucket limiter + per-account store (extracted from services/docs + services/license, PR #119)                        | Apache-2.0 | same                                                                                          |

Composition: the ADR-0094 original ten (`kernel` through `mcp-server`), plus `registry-schema`
(ADR-0097), plus `observability` (ADR-0117), plus the ships-with-generator trio
`cli`/`migrate`/`license-verify` (ADR-0136), plus `rate-limit` (the R1+R2 hygiene extraction,
PR #119). Total: 16.

## 2. COMMERCIAL / private set (20 `packages/*` + the registry service)

Every row below carries `license: "LicenseRef-Caisson-Commercial"`. Bundle membership and pricing
are `docs/state/package-catalog.md`'s job (§2b, the "Sellable catalog" tables) — cited here, not
restated. Internal-only rows say so plainly — carrying the commercial license does not by itself
mean a buyer ever receives the code.

### Bundle meta-packages (six-bundle catalog rework, ADR-0257/0258, 2026-07-06)

The four persona **editions DISSOLVED into six bundles** 2026-07-06. **Compliance kept its existing
package id** (`@caisson/compliance`); its manifest flipped to `kind:"bundle"` at 104900 in the
CAISSON-24 republish (2026-07-06, hygiene-package-standards session) — historical `kind:"edition"`
ledger entries stay valid forever, ADR-0257 §1 forbids only the ledger REWRITE, never a newly
appended version. The other five bundles are fresh `kind:"bundle"` meta-packages. Prices (full
detail: `package-catalog.md` §2b): **Compliance $1,049 · AI-Production $739 · Local-first $629 ·
Agentic-Dev $329 · Provenance $399 · Everything $2,059.**

| Package                  | Bundle                                                               | How a buyer gets it                                                                                                                                                        |
| ------------------------ | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@caisson/compliance`    | Compliance (kept id; `kind:"bundle"` since the CAISSON-24 republish) | Paddle checkout → `entitlement_grant` → license token → `create-caisson --edition compliance` or license-keyed registry pull, delivering the bundle's frozen `members` set |
| `@caisson/ai-production` | AI-Production (new `kind:"bundle"`)                                  | same, `--edition ai-production`                                                                                                                                            |
| `@caisson/local-first`   | Local-first (new `kind:"bundle"`)                                    | same, `--edition local-first`                                                                                                                                              |
| `@caisson/agentic-dev`   | Agentic-Dev (new `kind:"bundle"`)                                    | same, `--edition agentic-dev`                                                                                                                                              |
| `@caisson/provenance`    | Provenance (net-new, `kind:"bundle"`)                                | same, `--edition provenance` — composite of 3 Compliance-carve members, no edition-era equivalent                                                                          |
| `@caisson/everything`    | Everything (new `kind:"bundle"`)                                     | same, `--edition everything` — every bundle and every à la carte module, one purchase                                                                                      |

(The generator's `--edition` flag accepts ONLY the six canonical bundle ids — the legacy edition
spellings were purged by ADR-0270 (2026-07-07) and are rejected; the flag name predates the
vocabulary.)

**Retired edition ids** — `@caisson/ai-kit` (superseded by AI-Production), `@caisson/agent-dev`
(superseded by Agentic-Dev), `@caisson/local-ai` (superseded by Local-first) — are never sold new;
all three keep their `kind:"edition"` manifests (prices trued to their bundle targets —
$739/$329/$629 — per the local-ai convention, 2026-07-06). Per ADR-0257 §1, every pre-rework
`kind:"edition"` registry manifest and ledger entry **stays valid forever** (never migrated). The
legacy purchase ids themselves no longer resolve — ADR-0270 emptied the alias map
(`packages/registry-schema/src/bundle-vocabulary.ts`), gated on zero real buyers with live grants
drained to canonical ids at deploy; the edition→bundle fold for index expansion runs through the
decoupled `legacyEditionNamesFor`/`EDITION_BUNDLE_ID` relation
(`packages/registry-schema/src/entitlements.ts`).

### Bundle members + à la carte modules (delivered by purchase — entitlement expansion)

Distribution mechanics are unchanged from the edition era: every member/primitive package is
delivered bundled with its parent bundle purchase(s), or à la carte on its own purchase, through
the same purchase → entitlement → delivery path as the bundle meta-packages above. The full priced
module ↔ bundle membership table (all 22 à la carte SKUs — including moves the rework made, e.g.
`@caisson/ai-evals` joining the AI-Production bundle where it was previously standalone-only) is
`docs/state/package-catalog.md` §2b; not restated here.

### Internal-only — never distributed to a buyer

| Package                                                   | Why                                                                                                 | Status                                                                                                                             |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `@caisson/platform-reads`                                 | Shared typed reads over `services/license` tables for `apps/site`/`apps/admin` — server-side only   | `private: null` but `publishConfig` restricted; carries the commercial license for IP-protection uniformity, not because it's sold |
| `@caisson/pricebook`                                      | The seller's own price catalog (plan-book + action-book)                                            | same                                                                                                                               |
| `@caisson/license-issue`                                  | Ed25519 offline-license ISSUER — the private counterpart to `license-verify`; holds the signing key | `private: true`, `publishConfig: null` — **never published anywhere**, by design (ADR-0110)                                        |
| `@caisson/audit-harness`                                  | Cross-domain internal audit/validate harness (ADR-0134)                                             | `private: true`, `publishConfig: null` — explicitly "not a sellable module" per its own manifest description                       |
| `registry` (repo root `registry/`, not under `packages/`) | The registry SERVICE — CI index builder, gated publish flow, the Worker itself                      | `private: true`, never published; re-exports `@caisson/registry-schema` (the open contract) but the service code stays internal    |

Two packages (`license-issue`, `audit-harness`) are `private: true` with no `publishConfig` at
all — they are structurally unpublishable, distinct from the 18 other commercial packages which
carry a real (GH-Packages-restricted) `publishConfig` and are gated by entitlement rather than by
`private:true`.

`apps/*` (7 reference apps) and `tooling/*` (5 workspaces) are all `private: true` with no
`publishConfig` — internal-only by construction, out of scope for this doc.

---

## 3. Distribution reality vs plan (RESOLVED 2026-07-02 — ADR-0222 + ADR-0223)

The two open forks this section tracked are now **CLOSED**. Verified 2026-07-02 operator session,
then locked:

- **npm scope — LOCKED `@caisson-sh` (ADR-0222).** The bare npm name `caisson` is
  third-party-taken (v0.1.3, unrelated), the operator owns npm org **`caisson-sh`**, and nothing
  open is on public npmjs. So the PUBLIC mirror publishes under **`@caisson-sh/*`** — renamed at
  export by `scripts/export-public-mirror.ts` (`@caisson/` → `@caisson-sh/`); in-repo package names
  stay `@caisson/*`, and registry product/entitlement ids never rename. The "which scope" fork is
  closed — no per-package `name` rename in the monorepo.
- **npmjs credential — SET.** `NPM_TOKEN` is now configured (in the `caisson-sh/caisson-oss` mirror
  repo's secrets), closing the CI-credential gap this section previously flagged. The monorepo's own
  `.github/workflows/publish.yml` still targets GitHub Packages with the ephemeral `GITHUB_TOKEN`
  (ADR-0069) and stays `CAISSON_PUBLISH_DRY_RUN="true"` — **npmjs publishing belongs to the public
  mirror repo, not the monorepo** (ADR-0222). So the earlier "every open `publishConfig` points at
  npmjs but no npmjs auth exists in CI" gap is resolved by moving npmjs publishing off the monorepo
  entirely; the packages' `publishConfig.registry` fields are consumed by the mirror's publish job,
  not the monorepo's.
- **Commercial buyer channel — `registry.caisson.sh` (ADR-0223, BUILT 2026-07-02, dormant pending
  operator DEPLOY).** Buyers install COMMERCIAL modules from **`registry.caisson.sh`** — a real npm
  registry (packuments + tarballs, license-token-authed) — superseding the dead GitHub-Packages
  buyer channel baked into `packages/cli/src/generate.ts` + `packages/cli/templates/base/.npmrc`.
  It runs behind `CAISSON_PUBLISH_DRY_RUN=true`; the wrangler route + R2 bucket DEPLOY is the
  remaining operator act (`docs/state/decisions-and-forks.md` "Private registry host" row).

**Still true:** nothing is published on public npmjs yet. The pipelines are armed (see §4) but
publishing is gated on a manual dispatch — armed, not auto-firing.

## 4. Public mirror repo — CREATED (2026-07-02)

The plan this section previously flagged as "not yet executed" is now **executed**:

- **The `caisson-sh` GitHub org EXISTS**, and the private monorepo was **transferred into it** — the
  repo home is now **`caisson-sh/caisson`** (the old `GridWork-dev/caisson` URL auto-redirects,
  preserving stars/issues/watchers).
- **The public mirror repo `caisson-sh/caisson-oss` is CREATED** — PRIVATE for now (pre-launch),
  **flips PUBLIC at launch**. The first **416-file mirror snapshot** has been pushed.
- **The mirror sync + npm publish pipelines are ARMED:** `MIRROR_PUSH_TOKEN` (mirror push) +
  `NPM_TOKEN` (npmjs publish) are both set. Publishing stays **gated on a manual `confirm=publish`
  workflow dispatch** — armed, not auto-firing. The exporter is `scripts/export-public-mirror.ts`
  (Apache-set only, `@caisson-sh/*` scope rename, provenance `MIRROR-MANIFEST.json` whose
  `sourceRepo` is `caisson-sh/caisson`).
- **Scope:** the 15 Apache-2.0 packages (§1) only; the commercial set never mirrors (ADR-0094
  open-core boundary). Sync cadence + git-subtree-vs-snapshot mechanics live with the mirror
  pipeline (PR #64), not this doc.
