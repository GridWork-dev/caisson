# Public vs commercial package surface

Dated **2026-07-02**. This file OWNS the **npm-distribution-reality** view: for every
`packages/*` module — is it Apache-2.0 or `LicenseRef-Caisson-Commercial`, and where does the
code actually land today versus where the plan says it lands. `docs/state/package-catalog.md`
owns the license/price/sold-as catalog and `docs/state/public-surface-minimization.md` owns the
registry-Worker free-floor leak analysis (ADR-0136) — this file cites both, it does not restate
their tables. What is new here and lives nowhere else: the npm-scope + public-mirror-repo
distribution reality (§3–4, forks CLOSED by ADR-0222/0223 on 2026-07-02).

**Method:** every `packages/*/package.json` `license`/`private`/`publishConfig` field read
directly off disk, cross-checked against `tooling/standards-gate/src/checks.ts`
(`OPEN_BASE_NAMES`), `registry/index.json` (33 modules, schema v1), `.github/workflows/publish.yml`,
and ADR-0094 (open-core split), ADR-0097 (registry-schema split), ADR-0136 (license-keyed gate +
tooling-open), ADR-0111 (publish-readiness split plan), ADR-0069 (publish credential).

---

## 1. Apache-2.0 PUBLIC set (15 packages)

The `OPEN_BASE_NAMES` set the standards-gate enforces (`checkOpenCoreLicensing`). Every package
below carries `license: "Apache-2.0"`, no `private` flag, and `publishConfig.registry:
"https://registry.npmjs.org/"` in its own `package.json` — that registry target is the **plan**
(ADR-0111), not where the code lands today; see §3.

| Package                    | Purpose                                                                                                                   | License    | Distributed TODAY                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------- |
| `@caisson/kernel`          | Governance kernel: typed config loader, `CaissonError` model, security primitives, the standards gate                     | Apache-2.0 | Not published. Metadata served unauthenticated by the registry Worker (base floor, ADR-0136). |
| `@caisson/auth`            | Auth seam: EdDSA-JWT account tokens (RLS seam) + session contract, better-auth provider                                   | Apache-2.0 | same                                                                                          |
| `@caisson/tenancy-rls`     | Fail-closed multi-tenant Postgres RLS (FORCE policies + `withTenant`)                                                     | Apache-2.0 | same                                                                                          |
| `@caisson/ui`              | Design-system kit: OKLCH token floor + Radix-behavior component recipes                                                   | Apache-2.0 | same                                                                                          |
| `@caisson/billing`         | Stripe + Paddle billing behind a `BillingProvider` port                                                                   | Apache-2.0 | same                                                                                          |
| `@caisson/credits`         | Integer credit wallet + append-only ledger, debit-before-spend                                                            | Apache-2.0 | same                                                                                          |
| `@caisson/jobs`            | Provider-agnostic background-job queue port                                                                               | Apache-2.0 | same                                                                                          |
| `@caisson/email`           | Transactional email port (Resend/Postmark/SMTP/SES drivers)                                                               | Apache-2.0 | same                                                                                          |
| `@caisson/ai-config`       | Provider-agnostic AI config resolver + buyer settings file                                                                | Apache-2.0 | same                                                                                          |
| `@caisson/mcp-server`      | Auth-gated buyer MCP transport: timing-safe Bearer, entitlement-scoped reads, credit-gated `generate`                     | Apache-2.0 | same                                                                                          |
| `@caisson/registry-schema` | Open registry contract: module-manifest schema, index schema, allowlist helpers, feature-tags, entitlement-expansion math | Apache-2.0 | same                                                                                          |
| `@caisson/observability`   | Vendor-neutral OTel bootstrap (env-gated, inert until `OTEL_EXPORTER_OTLP_ENDPOINT` is set)                               | Apache-2.0 | same                                                                                          |
| `@caisson/cli`             | `create-caisson` generator: composes a tailored repo from the versioned registry                                          | Apache-2.0 | same                                                                                          |
| `@caisson/migrate`         | Base migration assembler/runner (merges per-package `migrations/*.sql` into one sequence)                                 | Apache-2.0 | same                                                                                          |
| `@caisson/license-verify`  | Offline Ed25519 license-token verification (tessera wire format, baked-in public key)                                     | Apache-2.0 | same                                                                                          |

Composition: the ADR-0094 original ten (`kernel` through `mcp-server`), plus `registry-schema`
(ADR-0097), plus `observability` (ADR-0117), plus the ships-with-generator trio
`cli`/`migrate`/`license-verify` (ADR-0136). Total: 15.

## 2. COMMERCIAL / private set (20 `packages/*` + the registry service)

Every row below carries `license: "LicenseRef-Caisson-Commercial"`. "How a buyer gets it" covers
only rows that are actually sold; internal-only rows say so plainly — carrying the commercial
license does not by itself mean a buyer ever receives the code.

### Edition meta-packages (sold as a bundle, ADR-0137 below-sum pricing)

| Package               | Edition           | How a buyer gets it                                                                                                                                                                                    |
| --------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@caisson/compliance` | Compliance        | Paddle checkout → `entitlement_grant` → license token → `create-caisson --edition compliance` (ADR-0092) or license-keyed registry pull (ADR-0136), both delivering the edition's frozen `members` set |
| `@caisson/ai-kit`     | AI Production Kit | same, `--edition ai-kit`                                                                                                                                                                               |
| `@caisson/local-ai`   | Local-first AI    | same, `--edition local-ai`                                                                                                                                                                             |
| `@caisson/agent-dev`  | Agentic-Dev       | same, `--edition agent-dev`                                                                                                                                                                            |

### Edition members (delivered by the edition purchase — entitlement expansion, ADR-0071/0077)

Per the frozen `members` map in `registry/index.json` (0.2.0):

| Package                     | Edition                                                    | How a buyer gets it                                                                                                                                                                                                                                            |
| --------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@caisson/field-crypto`     | Compliance, AI Production Kit, Local-first (shared member) | Per-tenant HKDF+AES-256-GCM field encryption — bundled with any of the three edition purchases above, or à la carte (ADR-0129)                                                                                                                                 |
| `@caisson/audit-worm`       | Compliance                                                 | WORM artifact store + SHA-256 audit chain — bundled with Compliance, or à la carte                                                                                                                                                                             |
| `@caisson/alerting`         | Compliance                                                 | SOC2 CC7.2 multi-channel alerting pipeline — bundled with Compliance (ADR-0205 runtime composition), or à la carte                                                                                                                                             |
| `@caisson/retention-runner` | Compliance                                                 | CCPA/GDPR erasure runner — bundled with Compliance (ADR-0205), or à la carte                                                                                                                                                                                   |
| `@caisson/ai-meter`         | AI Production Kit                                          | Metered-inference money path — bundled with AI Production Kit, or à la carte                                                                                                                                                                                   |
| `@caisson/guardrails`       | AI Production Kit                                          | Content-safety/PII layer — bundled with AI Production Kit, or à la carte                                                                                                                                                                                       |
| `@caisson/prompt-registry`  | AI Production Kit                                          | Append-only versioned prompts — bundled with AI Production Kit, or à la carte                                                                                                                                                                                  |
| `@caisson/local-store`      | Local-first, Agentic-Dev (shared member)                   | sqlite-vec + FTS5 hybrid retrieval — bundled with either edition, or à la carte                                                                                                                                                                                |
| `@caisson/agent-kernel`     | Agentic-Dev                                                | Engine-neutral agent/skill/rule kernel — bundled with Agentic-Dev, or à la carte                                                                                                                                                                               |
| `@caisson/tool-exec`        | Agentic-Dev                                                | Governed sandboxed tool-call primitive (ADR-0153/0199) — bundled with Agentic-Dev, or à la carte                                                                                                                                                               |
| `@caisson/agent-runner`     | Agentic-Dev (designated, ADR-0186)                         | Sandboxed governed agent runner. **Not yet in the frozen `members` map** in `registry/index.json` (0.2.0) — a known lag between the ADR-0186 lock and the next index snapshot, not a contradiction; folded into the Agentic-Dev SKU per ADR-0186 F5 either way |

### Standalone commercial — sold à la carte, not an edition member

| Package             | Tier      | How a buyer gets it                                                                                              |
| ------------------- | --------- | ---------------------------------------------------------------------------------------------------------------- |
| `@caisson/ai-evals` | primitive | Not present in any edition's `members` map — à la carte only (ADR-0129), same purchase→entitlement→delivery path |

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
- **Commercial buyer channel — `registry.caisson.sh` (ADR-0223, build pending).** The
  `@caisson-sh/*` npmjs mirror is the PUBLIC-DISCOVERY surface only. Buyers install COMMERCIAL
  modules from **`registry.caisson.sh`** — a real npm registry (packuments + tarballs, authenticated
  by the license token they hold) — which **supersedes** the structurally-dead GitHub-Packages buyer
  channel baked into `packages/cli/src/generate.ts` (the `npm.pkg.github.com` emit) +
  `packages/cli/templates/base/.npmrc`. That generator + docs flip lands in the build that
  implements the ADR-0223 SPEC — **not yet built**; the generator's `npm.pkg.github.com` emit
  correctly stays un-flipped until then.

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
