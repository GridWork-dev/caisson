# PLAN — registry self-hosted npm delivery (`registry.caisson.sh`)

**Implements:** ADR-0223 (accepted, merged PR#70) · SPEC `outputs/specs/deferred-respec/SPEC-registry-npm-delivery.md`
**Tags (from SPEC):** `infra` `external-system` `security` `billing` `secrets` → SHIP fires security-audit (external-system/secrets/billing) + infra-review.
**Direction + all 8 sub-forks LOCKED** (A1 same-origin Worker proxy · B1 base served here too · C1 raw license token auth · D3 401-bare/404-with-token · E1 latest-only · F1 offline revocation · G1 CF Worker+R2 · H1 commercial tarball sidecar). Nothing in this plan re-opens them.

> **ADR status correction (verified this worktree):** the SPEC's Task 6 says "file the option-A lock ADR." It is **already filed** — `knowledge/decisions/ADR-0223-registry-self-hosted-npm-delivery.md` exists and merged (PR#70); the ADR ceiling is now **0224** (`ADR-0224-live-harness-fork-locks.md`). This plan therefore **files no new ADR** — the SHIP task updates state docs only.

---

## Goal (WHAT + WHY)

Turn the already-live read-only registry Worker (`caisson-registry.broken-wood-97a9.workers.dev`, 32-module index — `docs/state/providers.md:44`) into a real npm-protocol registry so a buyer's generated repo runs `bun install @caisson/<edition>` against `registry.caisson.sh`, authenticated by the license token they already hold, gated by the **existing** offline-Ed25519 entitlement math (`registry/worker/entitlement-filter.ts` + `packages/registry-schema/src/entitlements.ts`), tarballs served same-origin from R2. The dead GitHub-Packages buyer leg (`templates/base/.npmrc:1`, `publish.yml` dry-run-only) is retired in the same change.

The auth gate is **reused, not rebuilt** — the whole cost is the npm-protocol surface + the R2/CI plumbing. Serve before flip: R2 + Worker routes go live and are proven with a real install **before** the generator `.npmrc` points buyers at the new host.

---

## Current state (grounded, real files)

| Fact                                                                                                                                                                                                                                | Evidence                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Worker serves custom JSON (`GET /`, `/index.json`, `/modules/:id`) — no bytes, no storage binding                                                                                                                                   | `registry/worker/handler.ts:82-147`; `deploy-entry.ts` esbuild-inlines `../index.json`                               |
| Entitlement gate complete + live: `Authorization: Bearer` → offline verify → `base ∪ expanded`, fail-safe-to-base, unentitled = same 404 as unknown (ADR-0076)                                                                      | `entitlement-filter.ts:18-30`, `handler.ts:56-72,131-146`, `verify.ts:71-92`                                         |
| Base membership is data-driven off the manifest `license`/`editions` fields (not a hardcoded list)                                                                                                                                  | `entitlements.ts:161-171` (`baseModuleIds`)                                                                          |
| License token bearer-anonymous, offline-verifiable, treated as "not a secret"                                                                                                                                                       | `claims.ts:37-43` (no buyer identity), `verify.ts:34-35` baked SPKI (fingerprint `0ae7d2abb886ca3d`, `verify.ts:27`) |
| `RegistryVersion` carries no tarball field; `registry/index.json` is a **public, unauthenticated** CI-built read                                                                                                                    | `packages/registry-schema/src/registry-index.ts:20-36`                                                               |
| Publish pipeline commits only `ledger.jsonl` + `index.json`; `changeset publish` is the dead GH-Packages leg, dry-run only; private pkgs excluded                                                                                   | `.github/workflows/publish.yml:64-105`, `registry/scripts/ci-publish-step.ts:66-77`                                  |
| Latent version-commit gap: `changeset version` bumps `package.json`/`CHANGELOG.md` + consumes `.changeset/*.md`, none of which the commit step stages (`config.json` `"commit": false`) — invisible only because the leg is dry-run | `publish.yml:78,94-105`                                                                                              |
| Zero R2 anywhere; `wrangler.toml` has no `[[r2_buckets]]`, `workers_dev = true`, no custom route                                                                                                                                    | `registry/worker/wrangler.toml`                                                                                      |
| No `registry.caisson.sh` DNS record; CF token scope is DNS+Pages+WAF only                                                                                                                                                           | `infra/terraform/main.tf`, `versions.tf`                                                                             |
| Generator emits the dead line, no auth                                                                                                                                                                                              | `templates/base/.npmrc:1`, `generate.ts:71-74` (legacy `defaultEngine`), `templates/base/README.md:9`                |
| `docs/operations.md` already flags the flip as ADR-0223 PENDING BUILD                                                                                                                                                               | `docs/operations.md:104` block                                                                                       |

Closest reusable pattern for idempotent bucket provisioning: `infra/worm/provision.ts` (S3 Object-Lock — a **different** account/credential; adapt the create-if-missing shape to R2/wrangler, do not copy the S3 client).

---

## Tasks (atomic, execution order — serve before flip)

### Task 1 — DEPLOY prereqs: R2 bucket + DNS + Worker route + CF token widen — **operator-gated**

- **Files:** `infra/terraform/main.tf` (new `cloudflare_dns_record.registry` — proxied, CNAME to the Worker route target; a `_railway-verify` TXT is **not** needed, this is a Worker not Railway), `infra/terraform/versions.tf` (widen the token-scope comment: add `Account:Workers Scripts:Edit` + `Account:Workers R2 Storage:Edit`), plus a Worker custom-domain/route binding for `registry.caisson.sh` (wrangler `routes`/custom-domain or a CF dashboard route — decide in Fork 2).
- **Change shape:** create the R2 bucket `caisson-registry-tarballs` (`bunx wrangler r2 bucket create`, idempotent — imitate the converge-on-rerun shape of `infra/worm/provision.ts`, R2-native not S3); add the DNS record + route; widen `CLOUDFLARE_API_TOKEN` in the CF dashboard **before** `terraform apply`.
- **Verify:** `cd infra/terraform && terraform plan` shows the `registry` record add, no 403; `bunx wrangler r2 bucket list` shows the bucket. Use the no-`-L` gate-probe convention for any HTTP status read.
- **Security-surfaces:** land a row in `gridwork-core identity/security-surfaces.md` for the new R2 sink + the widened token in this same step (same-commit invariant).
- **Lane:** operator (external-system/secrets — no autonomous cycle). **Size: S** (config, not code).

### Task 2 — Worker npm-protocol routes + R2 binding (EXECUTE)

- **Files:** new `registry/worker/npm-routes.ts` (the additive surface); `registry/worker/deploy-entry.ts` (dispatch to npm-routes on the npm path shapes, else fall through to the untouched `createIndexHandler`); `registry/worker/wrangler.toml` (add `[[r2_buckets]] binding = "TARBALLS"`); new `registry/worker/npm-routes.test.ts`. **`handler.ts` stays byte-identical** — the npm surface is a new module so `handler.test.ts` + `deploy-entry.test.ts` (the B2b leak guard) stay green.
- **Change shape:**
  - **Packument** `GET /@caisson%2f<name>`: synthesize the **abbreviated** packument from the inlined index — `{name, "dist-tags":{latest}, versions:{<v>:{name,version,dist:{tarball,shasum,integrity}}}, modified}`. `dist-tags.latest` = the index module's `.latest` (already computed by `build-index.ts`). **Content negotiation is mandatory:** on `Accept: application/vnd.npm.install-v1+json` return abbreviated and **never 406** (the Artifactory-bug class that breaks bun). Filter existence/versions through the **same** `entitledModuleSet` union already live (call the exported `licenseEntitlementResolver` + `baseModuleIds`/`expandEntitlements` — do not re-implement).
  - **Tarball** `GET /@caisson/<name>/-/<name>-<version>.tgz` (scope **dropped** from filename, per real npmjs; match a **literal** `/@caisson/<name>/-/…` — npm does not `%2f`-escape the tarball path, verdaccio#4913). **Re-run the entitlement check on the GET** (never trust that packument-read implies tarball-entitled). Serve bytes via `env.TARBALLS.get(<derived key>)` (A1 same-origin proxy). Key derived from the path: `<name>/<name>-<version>.tgz`.
  - **Fork D (D3):** commercial packument/tarball with **no** token → `401` (npm/bun retries with auth); token verifies but does not entitle → `404` (no-existence-leak, ADR-0076); base packages always `200` unauthenticated (B1).
  - **Diagnostics:** `GET /-/ping` → `200 {}`; any write route (`PUT`), `POST /-/npm/v1/security/audits*`, `GET /-/npm/v1/keys` → `404`/`501` (degrades `npm audit` only, never `install`).
  - **Headers:** reuse `handler.ts:31-42` discipline — `private, no-store` + `Vary: Authorization` + `nosniff` + HSTS on every gated response. Optional cheap win: ETag over the packument JSON + `If-None-Match`→`304`.
  - **Sidecar read:** the packument `dist.{shasum,integrity}` come from the tarball sidecar (Fork 1). If git-tracked+inlined (recommended), `import tarballs from "../tarballs.json"` in `deploy-entry.ts` alongside the index.
- **Verify:** `cd registry && bun test ./worker` — new `npm-routes.test.ts` asserts: abbreviated packument for an entitled module carries `dist-tags.latest` + `versions.<v>.dist.{tarball,shasum,integrity}`; `Accept: application/vnd.npm.install-v1+json` → `200` never `406`; unentitled commercial → Fork-D status (401 no-token / 404 with-token); base → `200` anonymous; tarball GET literal-slash path resolves and re-checks entitlement; `/-/ping`→200; write→404/501. Plus `bun test ./worker` shows `handler.test.ts` + `deploy-entry.test.ts` **unchanged/green** (index routes byte-identical).
- **Lane:** **opus** (context-bearing: must not regress the live entitlement gate; npm-protocol edge cases are subtle and security-adjacent). **Size: M** (~200-300 LOC incl. tests).

### Task 3 — CI: `npm pack` → R2 → sidecar provenance + close the version-commit gap (EXECUTE)

- **Files:** `.github/workflows/publish.yml`; `registry/scripts/ci-publish-step.ts` (+ its test) to record tarball metadata; the tarball sidecar file (Fork 1).
- **Change shape:**
  - Replace `changeset publish` (dead GH-Packages leg, `publish.yml:78-79`) with, per changed **non-private** package: `npm pack` → compute `shasum` (SHA-1) **and** `integrity` (sha512 SRI, via `ssri`) — emit **both** → `PutObject` to R2 at the derived key → record `{key, shasum, integrity, size}` into the sidecar.
  - Remove the GH-Packages `_authToken` write (`publish.yml:70`).
  - Repurpose `CAISSON_PUBLISH_DRY_RUN` (`publish.yml:49`) as the **R2-upload gate**: dry-run computes + logs the pack/hash/key plan and writes nothing to R2; `"false"` uploads.
  - **Close the inherited version-commit gap in the same change:** the commit step (`publish.yml:94-105`) must now **also** stage what `changeset version` produced — bumped `packages/*/package.json`, written `CHANGELOG.md`, consumed `.changeset/*.md` deletions — alongside `ledger.jsonl` + `index.json` (+ the sidecar). `config.json` is `"commit": false` and there is no `changesets/action`, so this commit step is the only place the bumps can land.
  - `ci-publish-step.ts` keeps `isPrivatePackage` exclusion (`@caisson/license-issue` signing key never packed/uploaded).
- **Verify:** `cd registry && bun test ./scripts` (ci-publish-step tarball-metadata unit); a `CAISSON_PUBLISH_DRY_RUN=true` run **logs the planned pack/hash/key set + writes nothing to R2**; a live run against a **staging** bucket uploads, and `ssri` over the fetched object matches the recorded `integrity`; the resulting commit contains the bumped `package.json` + `CHANGELOG.md` + changeset deletions (not just ledger+index).
- **Lane:** **opus** (context-bearing: CI + the latent-bug fix, and it holds `contents:write`/R2 creds). **Size: M**.

### Task 4 — Generator `.npmrc` flip + docs flip (EXECUTE)

- **Files:** `packages/cli/templates/base/.npmrc`, `packages/cli/templates/base/README.md:9`, `packages/cli/src/generate.ts:71-74` (legacy `defaultEngine` literal — flip for parity even though `templatesEngine` is the live path), `docs/operations.md:104` block.
- **Change shape:** template `.npmrc` becomes:
  ```
  @caisson:registry=https://registry.caisson.sh
  //registry.caisson.sh/:_authToken=${CAISSON_LICENSE_TOKEN}
  ```
  `${CAISSON_LICENSE_TOKEN}` is **npm's own env interpolation** at install time — the template engine's `replaceTokens` only touches `{{…}}` (`engine-templates.ts` `tokensFor`), so it passes through untouched and **no token is ever committed**. `_authToken` is sent as `Authorization: Bearer` — the exact header `entitlement-filter.ts:22` already parses (zero auth-read change). README line → "install from `registry.caisson.sh` with your license token in `CAISSON_LICENSE_TOKEN`." Flip `docs/operations.md` from "PENDING BUILD" to done.
- **Verify:** `cd packages/cli && bun test ./src` — the generator golden/composition test shows the new `.npmrc`; assert the generated file set contains **no** raw token (only the `${CAISSON_LICENSE_TOKEN}` placeholder).
- **Lane:** **sonnet** (bounded, mechanical, clear spec). **Size: S**.

### Task 5 — DEPLOY: populate R2, deploy Worker, live install proof — **operator-gated**

- **Change shape:** run the pipeline with the R2-upload gate open to populate the bucket; `registry/worker/deploy.sh` to push the new Worker (it already builds `@caisson/registry-schema` first, then `bunx wrangler deploy`); then in a throwaway dir with a real buyer token in `CAISSON_LICENSE_TOKEN`: `bun install @caisson/<entitled>` succeeds + integrity verifies; `bun install @caisson/<not-entitled>` returns the Fork-D status; base installs unauthenticated (B1).
- **Verify:** transcript in the DEPLOY note (no-`-L` gate-probe convention for status reads).
- **Lane:** operator (DEPLOY, separate from SHIP). **Size: S**.

### Task 6 — SHIP: state docs (no new ADR)

- **Files:** `docs/state/decisions-and-forks.md:33` (registry-host row: GitHub Packages → self-hosted `registry.caisson.sh`), `docs/state/providers.md:44` (new npm surface + R2 sink), `docs/adr-index.md` (cross-reference 0223 as built — it already lists 0223), `gridwork-core identity/security-surfaces.md` (confirm the Task-1 sink/token rows landed).
- **Change shape:** flip the board row + provider entry; **do not file an ADR** (0223 already merged, ceiling 0224). Reference ADR-0222 as the separate `@caisson-sh/*` npmjs public-discovery track — do not re-file it.
- **Verify:** `gw verify docs` passes; `git grep -n "GitHub Packages" docs/state/decisions-and-forks.md` no longer returns the registry-host row.
- **Lane:** **sonnet/haiku** (doc sweep — never opus). **Size: S**.

---

## Open forks (residual implementation decisions the ADR did NOT pin — operator picks before Task 2/3)

The 8 headline sub-forks are locked. Two mechanism-level decisions sit **under** H1/G1 that ADR-0223 leaves unspecified:

### Fork 1 — where the tarball sidecar physically lives + how the Worker reads it (under H1)

ADR-0223 H1 locks "a private sidecar maps `(id, version)` → `{R2 key, shasum, integrity, size}`" but not the storage/transport.

- **1.1 — git-tracked `registry/tarballs.jsonl`, inlined into the Worker bundle at build time exactly like `index.json` (Recommended, confidence HIGH).** Matches the live inline-deploy model (`deploy-entry.ts` already `import`s `../index.json`; add `import tarballs from "../tarballs.json"`); **$0** extra binding; coherence enforced by the same CI commit that writes `ledger.jsonl`+`index.json` (Task 3 already stages it). The repo is private, so commercial R2 keys/hashes in a git-tracked file are fine (only `index.json` is served publicly). Cost: one more CI-staged file; the sidecar rebuilds deterministically from the ledger like the index.
- 1.2 — an R2 object (`_meta/tarballs.json`) the Worker `.get()`s at request time. No git coupling; cost: an R2 read on every packument + a coherence gap between R2 and git the byte-identical index check can't police.
- 1.3 — a KV or D1 binding. Cost: a net-new binding + a CI write path, for a read the inline model already serves at cold-start for free.

### Fork 2 — how CI (GitHub-hosted `ubuntu-latest`) authenticates to R2, and how the Worker route is bound

`publish.yml` runs on a hosted runner and needs R2 write creds; the `registry.caisson.sh` route needs a binding mechanism.

- **2.1 — S3-compatible R2 access keys as GH Actions repo secrets scoped to the one bucket, + a wrangler `routes`/custom-domain entry in `wrangler.toml` deployed by `deploy.sh` (Recommended, confidence MEDIUM-HIGH).** One new scoped credential surface (lands in `identity/security-surfaces.md` per Task 1); the route lives in versioned config next to the Worker.
- 2.2 — CI uploads via `bunx wrangler r2 object put` using the existing `CLOUDFLARE_API_TOKEN` (widened in Task 1), route set in the CF dashboard. Fewer secrets, but the token is broader-scoped and the route is un-versioned (dashboard drift).

Both forks are genuinely two-way but low-stakes; each has a clear recommended default so Task 2/3 are not blocked long.

---

## Out of scope (explicit non-goals)

- npm **WRITE** endpoints (`PUT /{package}`, dist-tag PUT/DELETE, `npm login`) — CI uploads straight to R2; write routes 404/501.
- **C2** derived/rotatable install tokens · **F2** online per-install revocation — the recorded hardening pair; launch keeps C1 raw token + F1 offline (a refunded buyer installs until token expiry; clawback stays at the billing layer, ADR-0113).
- **E2** prerelease/`next` channel — one `latest` dist-tag only (E1); add when a prerelease tarball actually ships.
- **B2** two-scope split — B1 serves base + commercial from one `@caisson` scope/`.npmrc` line.
- The `@caisson-sh/*` **npmjs public-mirror publish** — separate track (ADR-0222, `scripts/export-public-mirror.ts` + `mirror-sync.yml`); referenced for the boundary, not built here.
- Version **ranges** beyond resolving `latest` — the packument exposes indexed versions; buyers pin exact versions the generator writes.
- **No change** to license claims shape (`claims.ts`), the entitlement math (`entitlements.ts`), or the index routes (`handler.ts` byte-identical).

---

## Verification (goal-backward)

Re-ask the goal: _can a buyer `bun install @caisson/*` from `registry.caisson.sh` with their license token, gated by the live entitlement math, with the dead GH-Packages leg gone?_

- Entitled `@caisson/*` → packument resolves (abbreviated, 200 on the vendor `Accept`, never 406), tarball downloads (A1 same-origin), client SRI/`integrity` passes (both `shasum`+`integrity` emitted).
- Not-entitled commercial → 401 (no token) / 404 (authed-but-unentitled), never leaking existence (ADR-0076).
- Base installs unauthenticated from the same registry (B1).
- CI produces+stores tarballs in R2 with recorded shasum+integrity; the GH-Packages `_authToken` write and `changeset publish` leg are gone; `CAISSON_PUBLISH_DRY_RUN` gates R2 upload; the commit persists the version bump+changelog+changeset deletions.
- Index routes + entitlement gate unchanged (`handler.test.ts` + `deploy-entry.test.ts` green).
- Generated repo `.npmrc` points at `registry.caisson.sh` with an env-var auth line, no committed token.
- State docs flipped; no new ADR filed (0223 already merged).

---

## Risks (carried from SPEC, still live)

1. **Scoped-slash tarball routing** (verdaccio#4913): npm escapes `/` for the packument but **not** the tarball → match a literal `/@caisson/<name>/-/…`; Task-2 test on the exact shape.
2. **bun load-time prefix-match auth** (bun#30513): keep packument+tarball under one host + shared prefix; A1 same-origin makes the `_authToken` path trivially correct.
3. **406 on the vendor `Accept` breaks bun outright**: content-negotiation returns abbreviated, never 406; Task-2 asserts 200.
4. **Version-commit gap must actually close** (Task 3): assert a staging live-run commit contains the bump+changelog+changeset deletions, else ledger/R2 silently diverge from git on the second run.
5. **New credential surfaces** (secrets/external-system): widened CF token + R2 keys land a row in `identity/security-surfaces.md` in the Task-1 commit.
6. **Offline verify ⇒ no install-layer revocation** (F1, accepted launch posture) and **bearer-anonymous token as `_authToken`** (C1, "not a secret") — explicit, not silent; C2/F2 are the hardening path.

---

## Effort / Value

**Effort: L** (~2-3 days: opus Worker routes + opus CI plumbing + sonnet generator flip + operator-gated R2/DNS/token provisioning + live install proof). Most auth machinery is **reused, not built**. **Value: HIGH** — the only working buyer delivery channel for commercial packages the store already sells; without it a purchased edition has a license token and no installable code.
