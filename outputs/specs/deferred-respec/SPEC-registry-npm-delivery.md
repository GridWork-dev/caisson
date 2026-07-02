---
title: "SPEC — Self-hosted npm-protocol registry (registry.caisson.sh) for commercial package delivery"
status: "draft - operator lock required"
item: registry-npm-delivery
tags: [infra, external-system, security, billing, secrets]
class: EXECUTE (Worker npm routes + CI pack/upload pipeline + generator .npmrc) then DEPLOY (R2 bucket + registry DNS + Worker route + publish-gate flip — operator-gated, not the autonomous cycle)
supersedes: IF option A is locked — ADR-0069 + ADR-0021 registry-host row, for the BUYER channel only (internal-use posture may remain). NOT yet superseded — the board still reads GitHub Packages (`decisions-and-forks.md:33`).
new-adr: ONE new lock ADR (option-A self-hosted registry, this SPEC is its build plan). NUMBER NOT SETTLED — `main` ceiling is 0221, but **ADR-0222 is already claimed** by the in-flight `docs/adr-0222-distribution` branch (accepted; `@caisson-sh` public distribution — the "npmjs mirror" this SPEC references, NOT a number this SPEC reserves). File at the next free number after checking OPEN ADR branches, not just `main`; expect an ADR-0088 renumber-at-merge (likely 0223 once 0222 merges).
---

# SPEC — Self-hosted npm-protocol registry for commercial package delivery

**Status: DRAFT — operator lock required, at BOTH levels.** This SPEC **RECOMMENDS option A**
(confidence **HIGH**, evidence below) — it does not narrate it as already decided: Caisson serves
its **commercial** `@caisson/*` packages from a **self-hosted npm-protocol registry at
`registry.caisson.sh`** — buyer `.npmrc` points the `@caisson` scope at it, installs authenticate
with the buyer **license token**, tarballs live in **Cloudflare R2**, and the **already-live**
Ed25519 offline entitlement gate (`registry/worker/entitlement-filter.ts`) decides per-package
access. **This top-level direction is itself an open fork (Fork 0 below), not yet locked.** The
decisions board — CLAUDE.md source-of-truth #1, ranked **above** specs — still reads `Private
registry host = GitHub Packages` unchanged (`decisions-and-forks.md:33`); there is no open-fork
entry and no session artifact/kickoff anywhere in the repo recording an operator decision to
self-host an npm-protocol registry; and this SPEC's own "ADR interactions" flags that very board row
as one it _would_ SUPERSEDE — i.e. nothing has been decided yet. Per the one-operator rule the SPEC
states option A as a labeled recommendation with evidence, then waits; it does not presume the lock.
This SPEC is the build plan the option-A lock ADR would draw on; it resolves the recommended
direction into a concrete design and **tables the eight sub-forks option A would leave open** (plus
Fork 0, the direction itself) — each waits for the operator lock, none is auto-decided. No product
code lands before the direction + ADR + sub-fork picks are locked (the Caisson cadence rule).

**Structure note (deliberate deviation).** This SPEC follows the deferred-respec house template
(Goal → Why now → Non-goals → Current state → Design → Open forks → Tasks → Verify → Risks → ADR
interactions → Effort/Value), the same superset `SPEC-cloudflare-front-rate-limit.md` and
`SPEC-members-fold-republish.md` use — because it is pre-lock (eight open sub-forks) and touches a
live deployed surface (the registry Worker + the buyer install path). The extra sections are
scaffolding, not silent divergence.

**Why this channel exists (the dead-channel that forced option A).** The buyer tarball channel as
wired is **dead**. `packages/cli/templates/base/.npmrc:1` emits `@caisson:registry=https://npm.pkg.github.com`
and `.github/workflows/publish.yml:70` authenticates with the ephemeral `GITHUB_TOKEN` to publish
to GitHub Packages — but GitHub Packages requires the npm scope to equal the owner org, and the
GitHub org `caisson` (and the npm user `caisson`) are **verified third parties**, not us. That leg
**has only ever run in dry-run** (`publish.yml:49` `CAISSON_PUBLISH_DRY_RUN: "true"`); no buyer has
ever been told how to authenticate to it (grep of `apps/site`/`packages/cli`/`docs` for
`_authToken`/`NPM_TOKEN` returns only the CI job itself). Option A replaces it.

## Goal (WHAT + WHY)

Stand up `registry.caisson.sh` as a **read-only npm-protocol registry** that a plain `bun install`
/ `npm install` speaks to, serving the **commercial** `@caisson/*` tarball set gated per-buyer by
the existing offline Ed25519 license entitlement, so that:

- a buyer's generated repo installs `@caisson/*` with **one working `.npmrc`** + their license
  token, no GitHub-Packages dependency;
- the CI pipeline **produces + stores tarballs** (`npm pack` → R2) instead of the dead
  `changeset publish → npm.pkg.github.com` leg, feeding tarball provenance into the ledger;
- the **already-live** entitlement math (`entitledModuleSet` = base ∪ `expandEntitlements`,
  `registry/worker/handler.ts:58-72`; the offline verify `packages/license-verify/src/verify.ts:71-76`)
  is **reused verbatim** as the install-time gate — an anonymous caller sees the free base, a
  licensed buyer sees base + their editions, an unentitled commercial package is invisible.

The 15 open Apache-2.0 base packages (ADR-0094) publish **publicly to npmjs as `@caisson-sh/*`**
from the public-mirror repo — the **already-accepted, in-flight `ADR-0222` on the
`docs/adr-0222-distribution` branch** (caisson-sh GitHub org + `@caisson-sh` npm scope + catalog
completion), a separate track referenced here for the boundary but not built by this SPEC. Whether
the self-hosted registry **also** serves the base — so one `.npmrc` line covers a buyer repo — is
**Fork B**.

## Why now / trigger

- **The channel is provably dead, not merely un-flipped.** `npm.pkg.github.com` can never serve
  `@caisson/*` from an org we don't control; flipping `CAISSON_PUBLISH_DRY_RUN` to `"false"`
  would fail, not ship. Option A is the recommended replacement (Fork 0; pending operator lock).
- **The gate already runs at the edge.** `registry/worker/entitlement-filter.ts:19-29` +
  `handler.ts:58-72` + the offline `verifyLicense` (`verify.ts:71-76`, `nodejs_compat` at the
  edge, workerd `node:crypto`) are **live** on `caisson-registry.broken-wood-97a9.workers.dev`
  (`docs/state/providers.md:44`, 33-module index). The npm-protocol surface is a **new route set
  onto an existing, deployed, tested gate** — not a new auth system.
- **Editions are being sold with no delivery.** P6 commerce is live (Paddle sandbox), a buyer can
  purchase + get a license token (`apps/site/components/license-token-card.tsx`), but there is no
  `@caisson/*` they can actually `install`. This closes the fulfillment gap.

## Non-goals

- **Not building the public-mirror → npmjs `@caisson-sh/*` publish** (the in-flight ADR-0222 on
  `docs/adr-0222-distribution`, already operator-locked there). Named for the boundary (Fork B
  decides overlap); the public-mirror publish is its own track.
- **Not implementing npm WRITE endpoints** (`PUT /{package}`, dist-tag PUT/DELETE, `npm login`).
  CI uploads straight to R2; `npm publish`/`npm version`/`npm deprecate` 404/501 cleanly against a
  read-only registry as long as no write route is advertised (research §6). No special-casing.
- **Not changing the license claims shape.** `licenseClaimsSchema` (`claims.ts:37-43`:
  `licenseId`, `tier`, `entitlements`, `major`, `expiry` — **no buyer identity**) is reused
  unchanged. A derived/DB-backed install token (Fork C) would be a _new_ credential, not a claims
  change.
- **Not adding online per-install revocation** unless Fork F selects it — the launch default keeps
  the offline contract the whole system already runs on.
- **Not re-writing the existing index routes.** `GET /`, `GET /index.json`, `GET /modules/:id`
  (`handler.ts:105-146`, custom JSON, consumed by the buyer MCP + generator) stay verbatim; the
  npm-protocol routes are **additive** and coexist.
- **Not touching the internal/CI publish provenance for private packages.**
  `@caisson/license-issue` stays `private:true`, excluded from the ledger (`ci-publish-step.ts:66-77`)
  and never packed/uploaded — the signing key never reaches R2.

## Current state (real files, verified on this worktree)

- **The Worker is JSON-metadata-only, no bytes, no storage binding.**
  `registry/worker/handler.ts:82-147` `createIndexHandler` routes only `GET /`, `/index.json`,
  `/modules/:id` returning **custom JSON** (not npm packument format). `deploy-entry.ts:16-26`
  esbuild-**inlines** `../index.json` into the bundle (no KV/R2/fetch at runtime).
  `wrangler.toml` (full read): `name = "caisson-registry"`, `main = "deploy-entry.ts"`,
  `workers_dev = true`, **no `[[r2_buckets]]`, no `[[kv_namespaces]]`, no route/custom-domain**.
- **The entitlement gate is complete + live.** `entitlement-filter.ts:22-28` reads
  `Authorization: Bearer <token>` (`BEARER_RE`, line 11), calls offline `verifyLicense`, returns
  `verified.entitlements` or `null`. `handler.ts:58-72` unions base ∪ expanded purchases,
  fail-safe-to-base on any throw; `handler.ts:139-141` returns the **same 404** for an
  unentitled-known module as an unknown one (ADR-0076, no existence leak). **This is the auth
  surface option A reuses.**
- **The license token is a bearer-anonymous, offline-verifiable string, shown as plaintext.**
  Wire format `PREFIX-TIER-base64url(payload‖64-byte-sig)` (`token.ts`, `SIGNATURE_BYTES=64`);
  `verify.ts:71-76` is 100% offline against the baked key (the SPKI constant at `verify.ts:34-35`;
  fingerprint `0ae7d2abb886ca3d` is in the key doc-comment at `verify.ts:27`),
  **fail-safe-to-community, never throws**. Delivered to the buyer only as a
  copy-to-clipboard `<code>` block (`apps/site/components/license-token-card.tsx`), documented as
  **"not a secret"** (already returned at `/issue`, independently offline-verifiable).
- **The open schema carries no tarball field.**
  `packages/registry-schema/src/registry-index.ts:21-35` `RegistryVersion` = `{version, manifest,
publishedAt, gateAttestation}` — Apache-2.0, and the CI-committed `registry/index.json` is a
  **public unauthenticated read**. Adding a tarball field here ripples into open + public surfaces
  (Fork H).
- **The publish pipeline commits index metadata, produces no tarball.**
  `.github/workflows/publish.yml`: `changeset version` + `changeset publish` (lines 78-79, both
  guarded by `CAISSON_PUBLISH_DRY_RUN`; the `publish` leg is the dead GH-Packages one, dry-run only)
  → `ci-publish-step.ts` scans `packages/*/manifest.ts`, appends new `(id,version)` to
  `registry/ledger.jsonl`, rebuilds `index.json` (`runPublishStep`, `ci-publish-step.ts:119-209`)
  → commits **only** `ledger.jsonl` + `index.json` back to main (lines 94-105). **No `npm pack`,
  no artifact store.** `--dry-run` gates the ledger write; the ledger entry has **no tarball
  field**. Private packages excluded (`isPrivatePackage`, `ci-publish-step.ts:66-77`).
- **Latent version-commit gap in the publish leg (real, but never exercised — dry-run only).**
  `changeset version` (`publish.yml:78`) bumps every changed `packages/*/package.json`, writes
  `CHANGELOG.md`, and **consumes (deletes)** the `.changeset/*.md` files in the runner tree — but
  `.changeset/config.json` is `"commit": false` and there is no `changesets/action` wiring, and the
  commit step (`publish.yml:94-105`) stages **only** `registry/ledger.jsonl` + `registry/index.json`.
  Nothing persists the version bumps / changelogs / changeset deletions to `main`. Because the
  `version`+`publish` block is skipped in dry-run, the gap is invisible today; the moment
  `CAISSON_PUBLISH_DRY_RUN` flips to `"false"`, `npm pack` (the new step) packs a bump that is never
  committed, the next CI run re-reads the same un-bumped `package.json`, re-processes the same
  never-deleted changesets, and the ledger/R2 tarball version diverges from git. Design §3 closes
  this in the same change rather than inheriting it.
- **Zero R2 anywhere.** No `[[r2_buckets]]`, no R2 client, no `CLOUDFLARE_R2_*`. The only
  object-storage code is `infra/worm/provision.ts` (**AWS S3** Object-Lock for audit-worm — a
  different account/credential, but the closest "provision-a-bucket-idempotently" pattern).
- **DNS: no `registry` record.** `infra/terraform/main.tf:17-100` declares apex/www (`proxied =
true`), `license` (`proxied = false`, grey — Paddle webhook), `admin` (`proxied = true`) — no
  `registry.caisson.sh`. `versions.tf` token scope is DNS+Pages only (no R2/Workers-route perm).
- **The generator emits the dead line.** `templates/base/.npmrc:1` (the live `templatesEngine`
  path, `generate.ts:110`) = `@caisson:registry=https://npm.pkg.github.com`, **no auth line**.
  The legacy `defaultEngine` hardcodes the same (`generate.ts:71-74`). `templates/base/README.md:9`
  tells buyers "install from GitHub Packages."

## Design

Assuming option A (Fork 0) is locked, this is HOW. Five surfaces change; the entitlement gate and
license verify are **reused, not rebuilt** (the auth is already live at the edge).

### 1. Worker: npm-protocol routes, additive (reuse the gate)

Add npm-protocol routes to the existing `caisson-registry` Worker (wired in `deploy-entry.ts`,
alongside the untouched index routes). The new routes call the **same**
`licenseEntitlementResolver` and `entitledModuleSet` union already live.

- **Packument** — `GET /@caisson%2f<name>` (npm URL-encodes the scope slash). Synthesize the
  **abbreviated** packument from the ledger/index for that module: `{name, modified, dist-tags:
{latest}, versions: {<v>: {name, version, dist: {tarball, shasum, integrity}}}}` (research §1 —
  the confirmed-minimal field set; `dependencies`/`readme`/`maintainers` NOT required). **Content
  negotiation is mandatory:** on `Accept: application/vnd.npm.install-v1+json` return the
  abbreviated form and **MUST NOT `406`** (research §1 — the old-Artifactory bug that breaks bun
  outright); any other/no `Accept` may return the full form. bun sends the fallback-tolerant
  `application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*` (bun#341). Filter the
  `versions`/existence by the caller's entitled set exactly as `handler.ts` filters `/modules/:id`
  (Fork D decides the not-entitled status code).
- **Tarball** — `GET /@caisson/<name>/-/<name>-<version>.tgz` (scope **dropped** from the filename,
  matching real npmjs; research §2). Handle the scoped-slash landmine: npm escapes `/` for the
  packument but historically **not** for the tarball, so the route must match a literal
  `/@caisson/<name>/-/...` (verdaccio#4913). Serve/authorize per Fork A. Re-run the same
  entitlement check on the tarball GET (never trust that packument-read implies tarball-entitled —
  research §7 `always-auth` class of bug).

* **Keep packument + tarball under one host + shared path prefix** (research §3) so bun's
  historically-buggy load-time prefix-matching auth (bun#30513/#28233/#26462) resolves — do not
  emit a tarball URL under a divergent/longer path than the `.npmrc` scope root.
* **Diagnostic/degradable routes:** `GET /-/ping` → `200 {}` (cheap, avoids a confusing
  `npm ping` failure); `POST /-/npm/v1/security/audits*` + `GET /-/npm/v1/keys` → `404`/`501`
  (degrades only `npm audit`/`audit signatures`, never `install` — research §6); any write route →
  `404`/`501`.
* **Conditional GET (cheap win):** compute an ETag over the packument JSON, honor
  `If-None-Match` → `304` (research §5 — zero risk if omitted; benefits npm's cacache
  revalidation and bun alike). Optional; recommend implementing.
* **Response headers:** keep the filtered-response discipline already in `handler.ts:31-42`
  (`private, no-store` + `Vary: Authorization` on gated responses, `nosniff`, HSTS) so a
  per-buyer packument is never shared-cached to another buyer.

### 2. R2: tarball store + binding

Add an R2 bucket (e.g. `caisson-registry-tarballs`) and bind it in `wrangler.toml`
(`[[r2_buckets]]`). Key convention (deterministic, computed from `(id, version)`):
`<name>/<name>-<version>.tgz` (scope stripped) — the Worker derives the key from the request path,
no lookup table needed for the location. Provision idempotently, imitating the
`infra/worm/provision.ts` create-if-missing pattern (but R2/Cloudflare-native, not S3 — Fork G).

### 3. CI: `npm pack` → R2 → ledger provenance (replace the dead leg)

Extend `.github/workflows/publish.yml` — **keep `changeset version`** (version bumps + changelogs)
but **replace `changeset publish`** (the dead `npm.pkg.github.com` leg) with, per changed
non-private package: `npm pack` → compute `shasum` (SHA-1) **and** `integrity` (sha512 SRI) —
**emit both** (research §4: modern npm treats `integrity` as canonical, legacy/`shasum` still read;
cheap at pack time) → `PutObject` to R2 at the derived key → record the tarball metadata
(`{key, shasum, integrity, size}`) for the Worker to serve (Fork H decides where this metadata
lives). Remove the `~/.npmrc` GH-Packages `_authToken` write (`publish.yml:70`). Repurpose the
`CAISSON_PUBLISH_DRY_RUN` gate (`publish.yml:49`) as the **R2-upload gate** — dry-run computes +
logs the pack/hash/key plan without uploading; `"false"` uploads. The ledger-append +
index-rebuild step (`ci-publish-step.ts`) is unchanged except for the added tarball metadata.

**Close the inherited version-commit gap in the same change (do NOT carry it forward).** Because
this leg now KEEPS `changeset version` running for real (it stops being dry-run-only once the
R2-upload gate opens), the commit step (`publish.yml:94-105`) must **also** stage what `changeset
version` produced — the bumped `packages/*/package.json`, the written `CHANGELOG.md`, and the
consumed `.changeset/*.md` deletions — in the same `git add`/`commit`, alongside `ledger.jsonl` +
`index.json`. Otherwise the bump never lands on `main`, the next run re-reads the un-bumped
`package.json` and re-processes the same changesets, and the ledger/R2 tarball version diverges
from git (see Current state). `.changeset/config.json` is `"commit": false` and there is no
`changesets/action`, so this commit step is the ONLY place the bumps can land. This is a real
pre-existing latent bug the SPEC surfaces + fixes, not new scope.

### 4. Buyer `.npmrc`: generator + templates

Flip `packages/cli/templates/base/.npmrc` (and the legacy literal `generate.ts:71-74`, and the
README line `templates/base/README.md:9`) to point at `registry.caisson.sh` with an **env-var
auth line** (never a committed token):

```
@caisson:registry=https://registry.caisson.sh
//registry.caisson.sh/:_authToken=${CAISSON_LICENSE_TOKEN}
```

`_authToken` is sent by npm/bun as `Authorization: Bearer <token>` — the **exact header
`entitlement-filter.ts:22` already parses** (the elegant reuse: no auth-read code changes). The
env-var indirection keeps the buyer's license token out of their committed repo; baking the raw
token into the committed `.npmrc` is **rejected** (a credential in the buyer's git history). Which
credential the env var holds — the raw license token vs a derived install token — is **Fork C**.
Whether a second scope line for the public `@caisson-sh/*` base is also emitted is **Fork B**.

### 5. Rollout / migration order (locked sequence; each DEPLOY step operator-gated)

1. **Prereqs (DEPLOY):** provision the R2 bucket; add the `registry.caisson.sh` DNS record +
   Worker custom route in `infra/terraform`; widen the CF API token scope (Workers-route + R2).
2. **Worker routes (EXECUTE):** add npm-protocol routes + R2 binding, additive to the live index
   routes; unit-test packument/tarball/content-negotiation/entitlement-filter against the existing
   `handler.test.ts` harness.
3. **CI pipeline (EXECUTE):** `npm pack` → R2 → tarball-metadata provenance; retire the
   GH-Packages leg; repurpose `CAISSON_PUBLISH_DRY_RUN`.
4. **Generator (EXECUTE):** flip `.npmrc` template + README (Forks B/C).
5. **Publish + deploy (DEPLOY):** run the pipeline with the R2-upload gate open to populate R2;
   `registry/worker/deploy.sh` to push the new Worker; verify a real `bun install` end-to-end.
6. **Public mirror (separate track — the in-flight ADR-0222 on `docs/adr-0222-distribution`):**
   public-mirror repo → npmjs `@caisson-sh/*`. Not filed by this SPEC (already accepted there).
7. **File the option-A lock ADR** (this SPEC) at merge — at the next free number after confirming
   the ceiling against BOTH `main` (currently 0221) **and open ADR branches**
   (`docs/adr-0222-distribution` already claims 0222); likely 0223, expect an ADR-0088 renumber if a
   sibling merges first.

## Open forks (operator-owned — do NOT auto-decide; lock in the option-A ADR)

### Fork 0 — the top-level direction: self-host (option A) vs stay on GitHub Packages vs a third-party registry

This is the headline decision the board has **not** recorded (`decisions-and-forks.md:33` still
reads `Private registry host = GitHub Packages`, ADR-0021). Sub-forks A–H below only apply once
Fork 0 = self-host. Do not presume it.

| Option                                                                                                                   | Tradeoff                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0.1 — self-hosted npm-protocol registry at `registry.caisson.sh`, R2 tarballs, license-gated (option A, Recommended)** | The only design that works with the live offline-Ed25519 gate at the edge **and** the `@caisson` scope Caisson controls — GitHub Packages cannot serve `@caisson/*` from an org Caisson does not own (see "Why this channel exists"). Reuses the deployed gate; closes the fulfillment gap. Cost: net-new R2 credential + DNS record + Worker route, and Caisson owns the registry's uptime. |
| 0.2 — keep GitHub Packages (the current board row, ADR-0021)                                                             | Zero new infra — but provably dead for the buyer channel: `@caisson/*` cannot publish to an org Caisson does not control. Retained only to name what the board still says; not a real buyer-delivery option.                                                                                                                                                                                 |
| 0.3 — a third-party private registry (npmjs Teams, Cloudsmith, hosted Verdaccio, …)                                      | Off-the-shelf npm protocol, someone else's uptime. Cost: re-implements the entitlement gate off the edge where it already runs, a new vendor + credential, and per-buyer license gating is not native to any of them.                                                                                                                                                                        |

**Recommendation: 0.1 (option A)** — confidence **HIGH**, on the "Why this channel exists" + "Why
now" evidence. But it is an operator lock the board has not yet recorded; the option-A ADR records
it alongside the sub-forks. The remaining forks (A–H) presuppose 0.1.

### Fork A — tarball delivery: same-origin Worker proxy vs R2 pre-signed 302

| Option                                                                                                          | Tradeoff                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A1 — Worker proxies the tarball same-origin, R2 binding + Bearer entitlement check on the GET (Recommended)** | One host, one auth surface; the buyer's `_authToken` travels correctly (research §3) and the Worker re-checks entitlement on the tarball GET. Sidesteps bun's cross-host/cross-path auth regressions and the leaked-URL problem entirely. Cost: Worker request duration + R2→Worker egress (free same-account on CF); tarballs are small.                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| A2 — Worker 302-redirects to a short-TTL pre-signed R2 URL                                                      | The tarball bytes never transit the Worker. A standards-compliant client **strips `Authorization` on the cross-host redirect** (RFC 9110), so the pre-signed URL must carry ALL auth in its query params — a bearer capability leaked into the buyer's lockfile/cache (short-TTL only). Worse, the strip is not guaranteed: **Bun 1.3.11/1.3.13 FORWARDS the scope's `Authorization` across the redirect** (claude-code#51618 — curl/npm strip it and succeed, Bun does not), so under Bun the raw bearer license token would reach the third-party R2 host as a header, and the query-token + forwarded-header combination is exactly what trips a 503 in a sandboxed egress proxy. Two independent leak/failure modes for no benefit at Caisson's tarball sizes. Fragile. |

**Recommendation: A1** — confidence **HIGH**. The research's load-bearing recommendation is
same-origin proxy for a license-gated registry; A2's auth is more fragile for no meaningful benefit
at Caisson's tarball sizes.

### Fork B — does the self-hosted registry ALSO serve the base packages?

| Option                                                                                                                                       | Tradeoff                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **B1 — serve base here too (community/unauthenticated) + commercial (license-gated), one `@caisson` scope, one `.npmrc` line (Recommended)** | Lowest buyer friction: a single `@caisson:registry=…` + one `_authToken` line covers the whole repo. Reuses the **exact** `base ∪ entitled` union already live (`handler.ts:58-72`) — base served regardless of token, commercial gated by it, so one token line "just works" (base ignores it). Cost: the Apache base is then dual-published (npmjs `@caisson-sh/*` per ADR-0222 **and** self-hosted `@caisson/*`), and even the free tier depends on Caisson infra. |
| B2 — base ONLY from public npmjs (`@caisson-sh/*`), commercial ONLY from `registry.caisson.sh` (`@caisson/*`)                                | Base survives a registry outage; no dual-publish; the open packages get npmjs discoverability/SEO. Cost: **two scopes** in the buyer `.npmrc` (a `@caisson-sh` line + a `@caisson` line), and the buyer's own imports differ by scope (`@caisson-sh/kernel` vs `@caisson/compliance`) — a worse DX and a rename ripple.                                                                                                                                               |

**Recommendation: B1** — confidence **MEDIUM**. One scope + one line is the cleaner buyer contract
and reuses the live union; the `@caisson-sh/*` npmjs mirror (ADR-0222) then serves public
discovery, not the buyer install path. Genuinely two-way — B2's outage-independence for the free
tier is a real argument. Operator owns it.

### Fork C — install credential: raw license token vs derived install token

| Option                                                                                            | Tradeoff                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **C1 — reuse the raw Ed25519 license token as `_authToken` (Recommended for launch)**             | Zero new infra: the Worker already verifies exactly this token offline (`entitlement-filter.ts` + `verify.ts`). The buyer pastes the token they already have (`license-token-card.tsx`). Cost: bearer-anonymous (no buyer identity in claims, `claims.ts:37-43`), not per-install-scoped, not individually rotatable, and offline-verify ⇒ no revocation before expiry (couples to Fork F). Already treated as "not a secret." |
| C2 — mint a separate, opaque, DB-backed npm install token (per-install, revocable, online lookup) | Scoped + rotatable + server-side-revocable; natural pairing with online revocation (Fork F2). Cost: a token store, an online entitlement lookup on every install, a new issuance + delivery surface, and latency/availability coupling to the license service.                                                                                                                                                                 |

**Recommendation: C1** — confidence **HIGH** for launch. Ship the reuse; treat C2 as the hardening
follow-up if per-install rotation or online revocation becomes a requirement (decide with Fork F).

### Fork D — status code for not-entitled / not-authenticated

| Option                                                                                                                                                           | Tradeoff                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D3 — `401` when NO token is sent for a commercial package (npm/bun retries with auth), `404`-hide once a token IS present but does not entitle (Recommended)** | Reconciles the two constraints: the npm challenge-flow expectation (research §7 — Verdaccio fixed to 401-no-creds so clients resend) **and** ADR-0076's no-existence-leak (an authenticated-but-unentitled buyer gets the same 404 as unknown, `handler.ts:139-141`). Base packages always `200` unauthenticated (Fork B1). |
| D1 — blanket `404`-hide (current Worker posture, ADR-0076) for every not-entitled case                                                                           | Maximal no-leak, matches today's `/modules/:id`. But a client that sent no credentials gets `404` with no `WWW-Authenticate` challenge and may never retry with its token (research §7) — a "package doesn't exist" dead-end for a legitimate buyer who mis-set their `.npmrc`.                                             |
| D2 — Verdaccio model: `401` no-creds / `403` insufficient-creds, packument visible                                                                               | Best client ergonomics + clearest diagnostics. But `403` on an owned-but-unentitled package **reveals the commercial package exists**, breaking ADR-0076's no-leak.                                                                                                                                                         |

**Recommendation: D3** — confidence **MEDIUM-HIGH**. Research §7 flags this as the one genuinely
open design fork among the researched facts; D3 keeps ADR-0076's no-leak while still triggering the
auth-retry a bare `404` (D1) would starve. (npm ≥ 7.10 always sends creds to its configured
registry, muting the concern for npm; D3 matters most for the no-token misconfiguration case and
for clients that challenge-flow.)

### Fork E — dist-tag / version-channel policy

| Option                                                                                          | Tradeoff                                                                                                                                                                               |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **E1 — `latest` only, mapped from the ledger's `latest` field (Recommended)**                   | The abbreviated packument requires `dist-tags` with at least `latest` (research §1); the ledger already carries one `latest` per module. Simplest, matches the single-channel publish. |
| E2 — `latest` + a `next`/prerelease channel (the semver regex already permits `-alpha`/`-beta`) | Enables staged prerelease installs. But nothing produces prerelease tarballs today — speculative.                                                                                      |

**Recommendation: E1** — confidence **HIGH**. YAGNI; add `next` when a prerelease channel actually
ships.

### Fork F — revocation: keep offline vs online per-install check

| Option                                                                                                                                | Tradeoff                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F1 — keep the offline Ed25519 contract; a revoked/refunded buyer installs until token expiry (Recommended for launch)**             | Zero new infra, matches the entire live model (`verify.ts` offline everywhere). Perpetual-per-major licenses (`expiry: null`) never lapse, consistent with the product's own semantics. Cost: a refund (ADR-0113 clawback exists at the billing layer) does not stop mid-stream installs. |
| F2 — online revocation check at the registry (consult the `services/license` entitlement-store / ADR-0113 clawback state per install) | Closes the install-layer revocation gap. Cost: a live dependency + latency on every install, and edge-Worker coupling to the license service DB; natural only if Fork C2 (DB-backed token) is also chosen.                                                                                |

**Recommendation: F1** — confidence **MEDIUM**. Ship offline; revisit F2 (with C2) if refund-abuse
becomes real. Note the pairing: F2 without C2 still needs an online identity to key the revocation
on, which the anonymous license token lacks.

### Fork G — infra ownership: Cloudflare-native vs Railway-hosted

| Option                                                                                                                                                                     | Tradeoff                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **G1 — Cloudflare Worker + native R2 binding + `registry.caisson.sh` custom route on the existing zone (Recommended)**                                                     | Extends the **live** `caisson-registry` Worker (`deploy-entry.ts`) with new routes + an `[[r2_buckets]]` binding; the offline verify already runs at CF's edge; R2 is CF-native (free same-account egress to the Worker); one credential surface; one new DNS record + route in `infra/terraform`. |
| G2 — Railway service speaking npm protocol, fronting R2 via the S3-compatible API (CNAME-to-Railway like `license`/`docs-api`, `infra/worm/provision.ts` S3Client pattern) | Full Node-server flexibility. Cost: a new Railway service, new R2 S3-API credentials, cross-provider egress, and re-implementing the entitlement gate off the edge Worker where it already lives.                                                                                                  |

**Recommendation: G1** — confidence **HIGH**. Extend the surface that already works; don't stand up
a parallel server for a read path CF already serves.

### Fork H — tarball metadata storage: parallel sidecar vs extend the open schema

| Option                                                                                                                                                                                                             | Tradeoff                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **H1 — a commercial tarball sidecar (deterministic R2 key + a `tarballs` ledger/sidecar carrying `{key, shasum, integrity, size}` per `(id,version)`), open schema + public `index.json` untouched (Recommended)** | Keeps `@caisson/registry-schema` (Apache-2.0) and the **public, unauthenticated** `registry/index.json` free of commercial tarball locations; the Worker joins `(id,version)` → sidecar to synthesize the packument `dist`. The R2 key is derivable from the path; the sidecar supplies the hashes. Cost: a second provenance file to keep coherent with the ledger. |
| H2 — add `dist`/`tarball`/`shasum`/`integrity` fields to `RegistryVersion`                                                                                                                                         | One source of truth. Cost: ripples into the **open** schema and the **CI-committed public** `index.json` (which would then carry commercial tarball URLs + hashes in a world-readable file), and forces a schema-version bump consumed by the CLI/MCP/docs.                                                                                                          |

**Recommendation: H1** — confidence **MEDIUM-HIGH**. Keep the open, public artifacts clean; let the
commercial registry own commercial tarball metadata. Integrity fields (both `shasum` + `integrity`,
research §4) live in the sidecar, computed at CI `npm pack` time.

## Tasks (atomic — run only after the option-A lock (Fork 0) + Fork A–H picks)

1. **DEPLOY prereqs (operator-gated).** Provision the R2 bucket (idempotent, `infra/worm/provision.ts`
   pattern, R2-native per Fork G1); add the `registry.caisson.sh` DNS record + Worker custom route
   in `infra/terraform/main.tf`; widen `CLOUDFLARE_API_TOKEN` (Workers-route + R2) and update the
   `versions.tf` scope comment. Verify: `terraform plan` shows the record + route add, no 403;
   `wrangler` can bind the bucket.
2. **Worker npm routes + R2 binding (EXECUTE).** Add packument (`GET /@caisson%2f<name>`,
   abbreviated with content-negotiation, never 406), tarball
   (`GET /@caisson/<name>/-/<name>-<version>.tgz`, Fork A delivery), `/-/ping` → 200, write/audit →
   404/501, ETag/304, all calling the existing `entitledModuleSet`. Add `[[r2_buckets]]` to
   `wrangler.toml`. Verify: extend `handler.test.ts` — an abbreviated packument for an entitled
   module carries `dist-tags.latest` plus `versions.<v>.dist.{tarball,shasum,integrity}`;
   `Accept: application/vnd.npm.install-v1+json` returns 200 (never 406); an unentitled commercial
   module returns the Fork-D status; a tarball GET re-checks entitlement; the index routes
   (`GET /`, `/index.json`, `/modules/:id`) are byte-identical to pre-change.
3. **CI pack → R2 → provenance + close the version-commit gap (EXECUTE).** In `publish.yml`, replace
   `changeset publish` with per-non-private-package `npm pack` → compute shasum + sha512 integrity →
   PutObject to R2 → record tarball metadata (Fork H sink); remove the GH-Packages `_authToken`
   write; repurpose `CAISSON_PUBLISH_DRY_RUN` as the R2-upload gate; **and extend the commit step
   (lines 94-105) to also stage the `changeset version` output** — bumped `packages/*/package.json`,
   `CHANGELOG.md`, and the consumed `.changeset/*.md` deletions — so the bump is persisted to `main`
   (Design §3). Verify: a dry-run run logs the planned pack/hash/key set + writes nothing to R2; a
   live run (staging bucket) uploads, the recorded integrity matches `ssri` over the fetched object,
   and the resulting commit contains the bumped package.json + CHANGELOG + the changeset deletions
   (not just `ledger.jsonl` + `index.json`).
4. **Generator `.npmrc` + README (EXECUTE).** Flip `templates/base/.npmrc` (+ `generate.ts:71-74`
   legacy literal + `templates/base/README.md:9`) to `registry.caisson.sh` + the env-var auth line
   (Forks B/C). Verify: the generator's composition/golden test shows the new `.npmrc` content; a
   generated repo's `.npmrc` contains no committed token.
5. **End-to-end install proof (DEPLOY, operator).** After deploy, in a throwaway dir with a real
   buyer license token in `CAISSON_LICENSE_TOKEN`: `bun install @caisson/<entitled>` succeeds and
   the tarball integrity verifies; `bun install @caisson/<not-entitled>` returns the Fork-D
   status; base packages install per Fork B. Verify: transcript recorded in the SHIP/DEPLOY note
   (use the no-`-L` gate-probe convention for status reads).
6. **File the option-A lock ADR; update state (SHIP).** Write ONE new ADR — the option-A lock (the
   Fork 0 resolution + the Fork A–H resolutions). Do NOT re-file the `@caisson-sh` npmjs mirror: it
   is the **already-accepted in-flight ADR-0222** on `docs/adr-0222-distribution` (reference it).
   Confirm the free number against BOTH `main` (currently 0221) **and** open ADR branches — 0222 is
   taken, so file ≥ 0223, expecting an ADR-0088 renumber-at-merge if a sibling lands first. Update
   `docs/state/decisions-and-forks.md` (registry-host row: GitHub Packages → self-hosted
   `registry.caisson.sh`), `docs/state/providers.md` (new registry surface + R2), `docs/adr-index.md`.
   Verify: `gw verify docs` passes; the ADR-index lists the new lock ADR (and 0222 once it has
   merged).

## Verification (goal-backward)

Re-ask the goal — _can a buyer `bun install @caisson/*` from `registry.caisson.sh` with their
license token, gated by the live entitlement math, with the dead GH-Packages leg gone?_

- A licensed buyer's `bun install`/`npm install` of an **entitled** `@caisson/*` package resolves
  the packument (abbreviated form, 200 on the vendor `Accept`, never 406), downloads the tarball
  (Fork A delivery), and the client's SRI/`integrity` check **passes** (both `shasum` + `integrity`
  emitted).
- A **not-entitled** commercial package returns the Fork-D status (D3: 401-no-token / 404-hide when
  authenticated) — never leaking that an unentitled package exists to an authenticated buyer, per
  ADR-0076.
- Base packages install per Fork B (B1: unauthenticated from the same registry; B2: from npmjs
  `@caisson-sh/*`).
- The CI pipeline **produces + stores tarballs** in R2 with recorded shasum + integrity; the
  GH-Packages `_authToken` write and `changeset publish` leg are **gone**;
  `CAISSON_PUBLISH_DRY_RUN` now gates R2 upload, not a no-op.
- The existing index routes (`GET /`, `/index.json`, `/modules/:id`) and the entitlement gate are
  **unchanged** (byte-identical `handler.ts` core; `handler.test.ts` still green).
- A generated repo's `.npmrc` points at `registry.caisson.sh` with an **env-var** auth line and
  **no committed token**.
- The option-A lock ADR exists (next free number ≥ 0223; the in-flight ADR-0222 mirror is
  referenced, not re-filed); the decisions board `registry-host` row, providers doc, and ADR-index
  reflect the new channel.

## Risks

1. **Scoped-slash tarball routing (research §2, verdaccio#4913).** npm escapes `/` for the
   packument but NOT for the tarball — the tarball route must match a literal `/@caisson/<name>/-/…`.
   A router that only handles the `%2f` form 404s every scoped tarball. Mitigation: explicit
   literal-slash route + a Task-2 test on the exact tarball path shape.
2. **bun's load-time prefix-matching auth (bun#30513/#28233/#26462).** If the tarball URL's path
   diverges from the `.npmrc` scope root, bun can fail to attach the `_authToken` → a masked 404.
   Mitigation: keep packument + tarball under one host + shared path prefix (Design §1); Fork A1
   same-origin proxy makes the token path trivially correct.
3. **406 on the vendor `Accept` header breaks bun outright (research §1).** A registry that 406s
   `application/vnd.npm.install-v1+json` (the old-Artifactory bug) fails `bun install` before
   anything downloads. Mitigation: content-negotiation returns abbreviated on that header, never
   406; Task-2 test asserts 200.
4. **Cross-host redirect auth is unreliable across clients (research §2/§3, RFC 9110).** A
   standards-compliant client strips `Authorization` on a cross-host redirect, so an A2 pre-signed
   R2 URL must self-carry all auth in its query string — leaking a bearer capability into the
   lockfile/cache. But the strip is NOT guaranteed: **Bun 1.3.11/1.3.13 forwards the scope
   `Authorization` across the redirect where curl/npm strip it** (claude-code#51618) — so under Bun
   the raw bearer license token reaches the third-party R2 host as a header (a worse leak), and the
   forwarded-header + query-token combination itself trips a 503 in a sandboxed egress proxy.
   Mitigation: Fork A1 (same-origin proxy) sidesteps both — no cross-host hop, no query-string
   capability; the Worker re-checks entitlement on the tarball GET.
5. **Public index.json vs commercial tarball locations.** `registry/index.json` is a public
   unauthenticated read; putting commercial tarball URLs/hashes in it (Fork H2) exposes the
   commercial catalog's storage layout. Mitigation: Fork H1 (commercial sidecar) keeps the public
   artifact clean.
6. **Offline verify ⇒ no install-layer revocation (Fork F).** A refunded/revoked buyer keeps
   installing until token expiry; the ADR-0113 clawback lives at the billing layer, not the
   registry. Mitigation: accept as launch posture (F1) or add F2 (online check) — an explicit fork,
   not a silent gap.
7. **License token is bearer-anonymous + shown as plaintext (`claims.ts:37-43`,
   `license-token-card.tsx`).** Reusing it as `_authToken` (Fork C1) means an install credential
   with no buyer identity, no per-install scope, no individual rotation. Mitigation: acceptable for
   launch (already "not a secret"); Fork C2 (derived token) is the rotation/scoping path.
8. **CF token scope + R2 provisioning are new credential surfaces (`secrets`/`external-system`).**
   The token must widen beyond DNS+Pages, and R2 is a net-new storage credential/binding. Both are
   DEPLOY-gated prereqs (Task 1) and land a row in `identity/security-surfaces.md` (new sink) per
   the same-commit invariant.
9. **Dual-publish coherence (Fork B1).** If the base is served both self-hosted (`@caisson/*`) and
   on npmjs (`@caisson-sh/*`), the two must not drift. Mitigation: single CI source (the ledger)
   drives both; or Fork B2 avoids the overlap.
10. **Live ADR-0222 number collision (process).** ADR-0222 is NOT free: the in-flight
    `docs/adr-0222-distribution` branch (6 commits ahead of `main`, same day) already carries an
    accepted `ADR-0222-public-distribution-and-catalog-completion.md` and states `ceiling 0222` in
    its own `adr-index`. Whichever of the two branches merges second collides and needs the
    ADR-0088 renumber-at-merge (already exercised six times this week). Confirming only `main`'s
    ceiling (0221) is insufficient. Mitigation: this SPEC files just ONE new ADR (the option-A
    lock, ≥ 0223), references — never re-files — the mirror 0222, and checks OPEN ADR branches at
    filing time, expecting a renumber.
11. **Version-commit gap must actually close (regression).** `changeset version` bumps
    `package.json`/`CHANGELOG.md` and consumes `.changeset/*.md` that the current commit step never
    stages (`.changeset/config.json` `"commit": false`; Current state). Design §3 / Task 3 stage
    those in the same commit. Mitigation: a Task-3 assertion that a live (staging) run's commit
    contains the bump + changelog + changeset deletions, not just `ledger.jsonl` + `index.json` —
    otherwise the ledger/R2 version silently diverges from git on the second run.

## ADR interactions

- **The option-A lock ADR (self-hosted registry) — this SPEC is its BUILD PLAN.** File at merge at
  the next free number after checking BOTH `main` (ceiling 0221) **and open ADR branches** —
  **ADR-0222 is already taken** by the in-flight `docs/adr-0222-distribution` (accepted), so file
  ≥ 0223 and expect an ADR-0088 renumber if a sibling merges first (see the collision risk). It
  records the Fork 0 direction + the Fork A–H resolutions.
- **ADR-0222 (public distribution: caisson-sh org + `@caisson-sh` npm scope + catalog completion) —
  ALREADY ACCEPTED, in-flight on `docs/adr-0222-distribution`; NOT filed by this SPEC.** It IS the
  "npmjs mirror" this SPEC references — the 15 Apache base packages publish publicly as
  `@caisson-sh/*` there. Fork B decides whether the self-hosted registry overlaps it. This SPEC must
  not re-file 0222.
- **ADR-0069 (publish-flow credential backfill) — SUPERSEDED for the BUYER channel** (if option A is
  locked). The ephemeral `GITHUB_TOKEN` → `npm.pkg.github.com` publish leg is retired for buyer
  delivery; any internal-use publish posture may remain, recorded as such in the option-A lock ADR.
- **ADR-0021 / decisions-board "Private registry host = GitHub Packages" (`decisions-and-forks.md:33`)
  — SUPERSEDED.** The registry host becomes self-hosted `registry.caisson.sh`; update the board row.
- **ADR-0111 (publish-readiness flip) — BECOMES this pipeline.** The private→public flip's real
  mechanism is now `npm pack` → R2 + the license-gated read path, not a GH-Packages flip; the
  never-published `@caisson/license-issue` invariant (`ci-publish-step.ts:66-77`) is unchanged.
- **ADR-0047 (registry read-path Worker seam) — EXTENDS.** The npm-protocol routes are additive to
  the seam this Worker already is; the index routes + `env.REGISTRY_INDEX` contract stay valid.
- **ADR-0094 (open-core base Apache-2.0) — the base∪entitled union it defines is reused verbatim.**
  Fork B decides whether the base is served here too.
- **ADR-0136 (license-keyed registry gating) — EXTENDS to the tarball layer.** Gating moves from
  index-metadata-only to metadata **and** tarball bytes, same entitlement math.
- **ADR-0076 (buyer-MCP fail-closed no-existence-leak) — the 404-hide posture Fork D reconciles**
  with the npm auth-retry flow (D3).
- **ADR-0113 (entitlement revoke / clawback) — the revocation seam Fork F would extend** to the
  install layer (F2), or explicitly not (F1).
- **ADR-0008/0010/0071 (license token model + entitlement resolution) — reused unchanged.** The
  offline verify + `expandEntitlements` are the install auth; no claims-shape change.

## Effort / Value

Effort: **L** (~2–3 days across EXECUTE + operator-gated DEPLOY steps: Worker npm routes + R2
binding, CI pack/upload/provenance, generator flip, R2/DNS/token provisioning, end-to-end install
proof), gated on the option-A lock (Fork 0) + the eight fork picks. Most of the auth machinery is **reused, not
built** — the cost is the npm-protocol surface + the storage/CI plumbing, not a new gate. Value:
**HIGH** — it is the **only** working buyer delivery channel for the commercial packages the store
already sells; without it, a purchased edition has a license token and no installable code. The
dead GH-Packages leg is retired in the same change.

## Revision provenance (2026-07-02 adversarial-critique pass)

Five critique findings, each verified against this worktree before acting. **All five CONFIRMED;
all fixed.** One sub-reference inside a finding was refuted (noted below).

1. **DEFECT 1 (Critical — unverified top-level operator lock) — CONFIRMED, fixed.** The prior draft
   asserted "The operator locked option A (2026-07-02)" and "the DIRECTION is LOCKED" while the SoT
   board `docs/state/decisions-and-forks.md:33` still reads `Private registry host = GitHub Packages`
   (ADR-0021), unchanged on both `main` and this worktree, with no open-fork entry and no
   session/kickoff artifact recording a self-hosting decision (grep of `docs/state` + `outputs/`
   returns only this SPEC and the adjacent rate-limit SPEC's passing mention). The status line even
   says "draft - operator lock required." Fix: demoted the direction to a **labeled recommendation
   (option A, confidence HIGH)** consistent with the one-operator rule; added **Fork 0** (self-host
   vs GitHub Packages vs third-party) as the explicit unresolved headline fork; the status
   paragraph, frontmatter `supersedes`/`new-adr`, and "ADR interactions" now state the board is NOT
   yet superseded. No fork auto-decided.
2. **DEFECT 2 (High — live ADR-0222 collision) — CONFIRMED, fixed.** `git log main..docs/adr-0222-distribution`
   = 6 commits (ace3d26, 2026-07-02); that branch carries an **accepted**
   `ADR-0222-public-distribution-and-catalog-completion.md` (caisson-sh org + `@caisson-sh` scope +
   catalog completion) and its `docs/adr-index.md` states `ceiling 0222`. The prior draft reserved
   0222 for its own "caisson-oss npmjs mirror" and safeguarded only by "confirm the ceiling on
   `main`." Fix: this SPEC now files **one** ADR (the option-A lock, ≥ 0223), **references** the
   in-flight 0222 as the mirror rather than re-filing it, instructs checking OPEN ADR branches (not
   just `main`), and adds **Risk 10** flagging the ADR-0088 renumber-at-merge.
3. **DEFECT 3 (Medium — version-commit gap inherited) — CONFIRMED, fixed.** `publish.yml:94-105`
   stages only `registry/ledger.jsonl` + `registry/index.json`; `.changeset/config.json` is
   `"commit": false` and no `changesets/action` exists, so the `changeset version` bumps
   (`package.json`, `CHANGELOG.md`, consumed `.changeset/*.md`) are never persisted. Real latent bug,
   un-exercised because the leg is dry-run only. Fix: surfaced in **Current state**, and Design §3 /
   Task 3 now extend the commit step to stage the version-bump artifacts in the same commit, with a
   Task-3 assertion + **Risk 11**.
4. **DEFECT 4 (Low — citation precision) — CONFIRMED, fixed** (with one sub-reference refuted). The
   fingerprint `0ae7d2abb886ca3d` is in the doc-comment at `verify.ts:27`, not the SPKI constant at
   `verify.ts:34-35`. Fix: the sole citation (Design "Current state", formerly line ~110) now cites
   `verify.ts:27` for the fingerprint and `verify.ts:34-35` for the baked key. **Refuted
   sub-reference:** the critique also cited "SPEC line 413" as carrying the same mis-citation — it
   does not; line 413 (Risk 7) cites `claims.ts:37-43` + `license-token-card.tsx`, never
   `verify.ts:34-35`. Only the one citation existed and is fixed.
5. **DEFECT 5 (Low/Medium — mischaracterized upstream issue) — CONFIRMED, fixed.** Verified against
   `github.com/anthropics/claude-code/issues/51618`: the issue documents **Bun 1.3.11/1.3.13
   FORWARDING** the `Authorization` header across a cross-origin redirect (curl/npm strip it and
   succeed); the forwarded header + SAS query token trips a 503 in the sandbox egress proxy — the
   opposite of the prior draft's "the client strips Authorization." Fix: Fork A2 tradeoff + Risk 4
   rewritten — standard RFC-9110 clients strip (so A2's query-string capability leaks into the
   lockfile), AND Bun unpredictably forwards (so the raw bearer license token reaches the R2 host as
   a header) — two independent leak/failure modes, reinforcing the A1 (same-origin) recommendation.
