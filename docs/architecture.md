---
updated: 2026-07-20
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

| Tree        | Count | Owns                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/` | 55    | independently-sellable capability units, framework-free. **17 Apache-2.0 base** (kernel · auth · tenancy-rls · ui · billing · jobs · email · ai-config · mcp-server · registry-schema · observability · cli · migrate · license-verify · rate-limit · analytics · ds-manifest, ADR-0094/0097/0117/0136/0287 — credits flipped commercial per ADR-0258 §2; ds-manifest is the wave's one new package, PR #237/ADR-0330/ADR-0345 — the shared component-manifest+contrast/doctor library behind the CLI's second `caisson` bin, the buyer MCP's design-system tools, and the local stdio-only discovery server) vs **35 `LicenseRef-Caisson-Commercial`** — the 6 bundle metas (compliance/ai-production/local-first/agentic-dev/provenance/everything, ADR-0257; the legacy edition purchase ids were purged per ADR-0270 and the 3 edition meta-packages were DELISTED from the served index per ADR-0271 — their publish history and tarball provenance stay in the append-only ledger) + the sellable modules (field-crypto, audit-worm, alerting, retention-runner, ai-meter, ai-evals, guardrails, prompt-registry, local-store, agent-kernel, agent-runner, tool-exec, compliance-core, frameworks-pack, signing-primitive, credits, local-sync, local-inference, local-privacy, org-controls, billing-orchestration, ui-pro) + internal-only (platform-reads, pricebook, license-issue, audit-harness, brand). ui-pro published @0.1.0 to the registry index (PR #142, 2026-07-07 — the reservation graduated with it; `RESERVED_MODULE_ENTITLEMENT_IDS` is now empty, kept as the documented mechanism for the next sold-before-published SKU) |
| `services/` | 5     | seller-platform side-cars: `license` (issuer + Paddle webhook), `docs` (RAG), `support-bot` (Discord, Python), `intel` (admin intelligence daemon, ADR-0286), `betterstack-adapter` (uptime monitor bridge)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `apps/`     | 7     | the only layer that imports a framework: `site` (GTM+docs, Next 16), `admin` (control-plane, Next 16), `compliance`/`ai-kit`/`local-ai` (edition reference templates, Next), `base`/`agent-dev` (plain-TS reference consumers). `studio` is gone — absorbed into `admin` (ADR-0140); the untracked on-disk leftover was cleared 2026-07-07                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `registry/` | —     | versioned module sources + the CI-built `index.json` (bundle-only per ADR-0271 — see registry/index.json for the current module count) + the `worker/` (CF Worker serving the npm install protocol at `registry.caisson.sh`, ADR-0223)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `infra/`    | —     | `terraform/` (Cloudflare DNS+Access+WAF), `discord/` (guild provisioning), `kms`/`license-issuer`/`signoz`/`worm` (key + retention infra)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `tooling/`  | 5     | the one eslint/tsconfig/test/lint-gate source (`standards-gate`, `eslint-config`, `testing`, `tsconfig`, `design-critic`); nothing ships except through it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

Down-only dependency direction (ADR-0003): bundle/module packages compose base, never the
reverse; a bundle/module never depends on another bundle/module. Provider-SDK reach is confined
to `ai-config`+`ai-kit` (ADR-0011).

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
- **Design-system agent surface** (ADR-0330/ADR-0345) — `@caisson/mcp-server` ships two trust
  tiers over the same `@caisson/ds-manifest` data: an unauthenticated **local stdio-only**
  discovery server (`discovery-bin.ts` — no bearer, no `authenticate`, no network listener, ever;
  serves the Apache base manifest only) a coding agent spawns 1:1, and Bearer-gated buyer MCP
  tools riding the existing ADR-0216 `registerTool` seam (`list_components`/`describe_component`/
  `get_tokens` free; `check_usage`/`describe_pro_component` entitlement-gated, `ds-doctor` sold
  independent of any edition). `packages/cli`'s second `caisson` bin (`describe`/`doctor`) is a
  thin client of the same manifest + MCP. The buyer MCP also serves a parallel **resources**
  surface (ADR-0355): `resources/list`+`resources/read` over `caisson://<ns>/<name>` URIs —
  design-system components/tokens (+ entitlement-gated pro-components) as a second front over
  the same pure functions, plus a full-catalog `caisson://registry/index` for any authenticated
  bearer; same entitlement gating, rate-limit hook, and invisible-not-found contract as the
  tools.
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
  Membership truth is the registry index members maps alone; a future module rename resolves
  through the ONE alias point (`normalizeEntitlementId`/`LEGACY_ENTITLEMENT_ALIASES` in
  `bundle-vocabulary.ts` — emptied of the dissolved edition ids by ADR-0270; the edition→bundle
  fold now lives in the decoupled `EDITION_BUNDLE_ID`, `entitlements.ts`); a
  sold-but-unpublished SKU sits in `RESERVED_MODULE_ENTITLEMENT_IDS` (fail-soft) until indexed.
  Deploy-order corollary: the claims schema is `.strict()`, so any wave that widens it deploys
  VERIFIERS (Worker) before the issuer re-mints (`docs/deploy/STATE.md` standing constraint).
- **Tenancy** — fail-closed Postgres RLS (`@caisson/tenancy-rls`, `withTenant`/`SET LOCAL`; a missing
  `WHERE` fails closed, ADR-0005), verified against the real generator by `checkRlsEquivalence`
  (checks.ts) so hand-written migration RLS can't silently drift from `buildTenantPolicySql`.
- **External anchoring seam** (ADR-0332/0346/0347) — `@caisson/audit-worm` gains a TSA leg
  (RFC-3161, `trusted-timestamped` grade only — v1 never claims `externally-transparent`)
  submitted through a durable Postgres outbox (`anchor-outbox.ts`, persist-before-egress: a
  `submitted` row can never be re-submitted, closing the blind-duplicate-against-a-public-log
  risk) and checked end-to-end by `verifyExternal` (full CMS/ASN.1 depth via `pkijs`). The
  per-row proof (`GET /api/admin/audit/proof`, `apps/admin`) rides the existing Admin CF-Access+JWT
  gate below.
- **Admin** — `apps/admin` sits behind a permanent Cloudflare Access edge gate PLUS an in-app
  CF-Access-JWT middleware check (ADR-0140 + ADR-0204, closing the direct-grey-origin bypass).

## 3. The live fleet

5 Railway services (`caisson-prod`, US-West) + 1 Cloudflare Worker, per `docs/state/providers.md`:

| Host                  | Service               | Posture                                                                                                                                                              |
| --------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `caisson.sh` / `www`  | `caisson-site`        | Railway, CF-proxied; marketing/docs public pre-launch, `/dashboard*` + `/cart*` still Access-gated (ADR-0303)                                                        |
| `admin.caisson.sh`    | `caisson-admin`       | Railway, CF-proxied + **permanent** operator CF-Access + in-app JWT check                                                                                            |
| `license.caisson.sh`  | `caisson-license`     | Railway, **grey/DNS-only** (Paddle webhook must reach it directly)                                                                                                   |
| `docs-api.caisson.sh` | `caisson-docs`        | Railway, CF-proxied                                                                                                                                                  |
| —                     | `caisson-support-bot` | Railway (Python/Discord), no public hostname                                                                                                                         |
| `registry.caisson.sh` | Cloudflare Worker     | serves the npm install protocol, license-token-authed; built (ADR-0223), dormant behind `CAISSON_PUBLISH_DRY_RUN=true` — R2/DNS activation is an operator DEPLOY act |

DNS + Access + the front rate-limit are Terraform-managed (`infra/terraform/{main,access,waf}.tf`).
Observability is Grafana Cloud (sole OTLP sink, ADR-0177); Paddle sandbox is still the checkout
backend (production Paddle account is a launch-gate item); the audit-worm external-anchoring
checkpoint scheduler on `caisson-license` ships inert pending the operator arming
`ANCHOR_CHECKPOINT_SCHEDULE`/`CAISSON_WORM_BUCKET`/`CAISSON_TSA_URL` (ADR-0346, a DEPLOY act).

## 4. The gate stack

| Check               | Where it lives                                                                 | Guards                                                                                                                                                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `standards-gate`    | `.github/workflows/ci.yml` → `tooling/standards-gate/src/cli.ts` (`checks.ts`) | the SPDX/license authority — AGPL boundary, open-core split, down-only, manifest↔package.json agreement, RLS equivalence, shipped-prose, entitlement-token leaks. Runs pre-install (fs-only) AND post-install (needs `node_modules`)                            |
| `check`             | `.github/workflows/ci.yml`                                                     | `turbo run build lint test` (the full workspace — 51 `packages/` + apps + services + tooling, no `--filter`) + `bun run gate` (`packages/kernel/src/gate.ts`)                                                                                                   |
| `registry-index`    | `.github/workflows/ci.yml`                                                     | `registry/index.json` is a byte-identical rebuild from the git-tracked ledger — proves CI (not a hand-edit) produced it                                                                                                                                         |
| `oscal-conformance` | `.github/workflows/ci.yml` (`blacksmith-4vcpu-ubuntu-2404`, ADR-0326)          | NIST OSCAL v1.2.2 JSON→XML→schema round-trip via `oscal-cli` (Maven), for `packages/compliance`; plus two direct JSON `oscal-cli validate` legs (ADR-0363/0364, oscal-spine): the generated caisson catalog and the vendored NIST SP 800-53 rev5 catalog itself |

`standards-gate` + `check` + `registry-index` + `oscal-conformance` + `deterministic` (the pinned security-scan gate, ADR-0327) are the 5 unconditional required checks (ADR-0016);
the `greptile-gate` review check was RETIRED with the vendor (2026-07-06 — review is the
in-session SHIP audit lane per CLAUDE.md §PR review gate); `oscal-conformance`
installs its own JDK + oscal-cli per-run, unlike the other Blacksmith CI jobs.
