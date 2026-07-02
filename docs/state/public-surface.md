# Public vs commercial package surface

Dated **2026-07-02**. This file OWNS the **npm-distribution-reality** view: for every
`packages/*` module — is it Apache-2.0 or `LicenseRef-Caisson-Commercial`, and where does the
code actually land today versus where the plan says it lands. `docs/state/package-catalog.md`
owns the license/price/sold-as catalog and `docs/state/public-surface-minimization.md` owns the
registry-Worker free-floor leak analysis (ADR-0136) — this file cites both, it does not restate
their tables. What is new here and lives nowhere else: the public-npm-scope open fork and the
public-mirror-repo plan (§3–4).

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

## 3. Distribution reality vs plan

Verified 2026-07-02, operator session — cited as such, not re-derived:

- **Nothing is published on public npmjs.** No `@caisson/*` package exists on
  `registry.npmjs.org` today.
- **The box has no npm login.** No local npm publish credential exists on this machine.
- **`.github/workflows/publish.yml` publishes to GitHub Packages (`npm.pkg.github.com`) with the
  ephemeral `GITHUB_TOKEN`** (ADR-0069) — zero stored PAT, workflow-scoped, expires with the job.
  `CAISSON_PUBLISH_DRY_RUN` defaults to `"true"`; going live is an explicit operator flip of that
  env var, not a code change.
- **The bare npm package name `caisson` is TAKEN** by a third party (v0.1.3, unrelated project).
- **The operator holds an npm org named `caisson-sh`.**
- **Whether the `@caisson` npm scope/org name itself is free is UNVERIFIED** — resolving it
  needs an actual `npm login` + scope lookup, not done this session.

**Gap found this session, worth flagging alongside the above:** every one of the 15 open
packages' own `publishConfig.registry` points at `https://registry.npmjs.org/` (the ADR-0111
plan — open Base → public npm, commercial remainder → GH Packages restricted), but
`publish.yml` only ever writes an `~/.npmrc` auth line for `npm.pkg.github.com`. There is no
`NPM_TOKEN`/npmjs credential anywhere in `.github/workflows/`. So even with
`CAISSON_PUBLISH_DRY_RUN=false`, `changeset publish` would attempt to push the 15 open packages
to `registry.npmjs.org` and fail for lack of auth — the ADR-0111 split is wired into every
package's `publishConfig`, but the CI credential half of that split was never finished. This sits
on top of, not in place of, the open npm-scope fork below.

### OPEN OPERATOR FORK — which npm scope to publish the open set under

Not decided here; recorded for the operator to pick when the npmjs credential gap above gets
closed:

- **Option `@caisson`** — matches the in-repo package names (`@caisson/kernel`, …) exactly, zero
  rename tax. Blocked on verifying the scope is actually available on npmjs (unverified, see
  above) — if `@caisson` is taken or reserved, every open package's `name` field, every
  generated-repo import, `create-caisson`'s templates, and the docs site's install snippets would
  need a rename.
- **Option `@caisson-sh`** — the operator already owns this npm org today, zero registration risk.
  Costs a rename across the same surface (package names, generated-repo imports, `cli` templates,
  docs) whether or not `@caisson` turns out to be free, since it diverges from the org name either
  way.

Recommendation is deliberately withheld — this is exactly the class of decision
`docs/state/decisions-and-forks.md` exists for. The next action is mechanical (`npm login` +
`npm access` scope check on `@caisson`), not a design call, so resolving it doesn't need to wait
for a full picker round.

## 4. Planned public mirror repo

Plan on record (not yet executed): mirror the 15 Apache-2.0 packages into a **public** GitHub
repo, separate from the private `GridWork-dev/caisson` monorepo, as an acquisition/GTM surface
(discoverable OSS trust layer, per the ADR-0094 open-core rationale) independent of whether the
npm-publish gap above is closed.

- **The `caisson-sh` GitHub org does not exist yet** — creating it is an operator action, not
  something this session did or could verify.
- Until that org exists, the interim home for a public mirror is a repo under the existing
  `GridWork-dev` GitHub org. A GitHub repo transfer preserves stars/issues/watchers and
  auto-redirects the old URL, so starting under `GridWork-dev` and transferring to `caisson-sh`
  later is not a one-way door — no reason to block the mirror on the org existing first.
- Scope, sync mechanism (git subtree vs a CI job vs a one-shot snapshot), and cadence are all
  undecided — out of scope for this doc; flagging the plan's existence and its one hard
  dependency (the org) is as far as ground truth extends today.
