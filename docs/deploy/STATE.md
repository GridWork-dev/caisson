---
updated: 2026-07-08
status: live
grounds:
  - docs/build-state.md
  - docs/state/launch-runbook.md
---

# Deploy log

Reverse-chronological. One entry per operator-executed DEPLOY act (never autonomous —
`identity/doctrine.md` DEPLOY line). Each entry: date · services/SHAs · WHY (the consumed-package
diff that forced the redeploy) · live-verify evidence.

**Going-forward convention:** every future DEPLOY act appends a NEW entry at the top of this file
with **pasted** live-verify output (curl/health-check stdout), not a paraphrase. Do not edit a past
entry except to fix a factual error — new truth is a new entry, per the frontmatter-freshness
convention (`outputs/archive/specs/sot-expansion/SPEC.md` §1.4).

**Seed note:** the entries below (2026-07-01 through 2026-07-05) are seeded RETROACTIVELY from
`docs/build-state.md` banners, `docs/state/decisions-and-forks.md`, `docs/state/launch-runbook.md`,
and `docs/state/opportunity-backlog.md`. None of the seed entries carry raw pasted terminal output —
none survived in the source docs verbatim. Where a source recorded a concrete result (an HTTP status,
a fingerprint, a row count) that value is quoted; where it only recorded a verification claim in
prose, this entry cites the doc/section that made the claim instead of fabricating a transcript.

**Standing sequence constraint (catalog-program, SHIP-audit F5):** the license claims schema is
`.strict()`, and the catalog-program wave adds `updatesWindows`/`entitledSince` to signed tokens —
an old verifier build REJECTS a new token (fail-safe to community/base, but a paying buyer degrades).
Deploy order for any wave that widens the claims schema: **registry Worker (and any other verifier
consumer) FIRST, license service re-mints AFTER.** Buyer-side tooling needs the bumped
`@caisson/license-verify` before it can read new-shape tokens.

---

## 2026-07-08 — EXECUTED: credential-sweep propagation — per-service OpenRouter keys + vault + docs embed cache (PR #185)

**Operator-approved same-session ("run the propagation fully and redeploy and resync").** The
runbook Phase 1–2 execution: all OpenRouter keys revoked + re-minted as SIX per-service keys
(gw-box · caisson-docs · caisson-support-bot · caisson-site · caisson-intel · aeo-probe), the
1Password "Caisson Launch" vault created and CLI-filled (one item per env name, per-service
concealed fields, tags = services), values propagated vault→consumers, and PR #185 (docs
content-hash embed cache + vault-parity non-env tag) deployed with a persistent volume.

- **Propagation:** Railway sets ×5 (docs/support-bot/site keys, `DISCORD_TOKEN`,
  `NEXT_PUBLIC_DISCORD_INVITE_URL` — site's key + invite are NEW vars) · box `~/.gridwork/env`
  gw-box key · `services/intel/.env` + container recreate (healthy) · GH secrets ×6
  (`OPENROUTER_API_KEY`, `POSTHOG_CAPTURE_KEY`, `POSTHOG_CAPTURE_HOST`, `DATAFORSEO_LOGIN`,
  `DATAFORSEO_PASSWORD`; `MIRROR_PUSH_TOKEN` still pending the operator's PAT mint).
- **Key verification (pasted):** all six keys probed against `GET /api/v1/key` → `HTTP 200`;
  every key reports `limit=null` — per-key credit limits **waived by the operator 2026-07-08**
  (uncapped keys accepted; attribution, not caps, was the goal of the split).
- **Redeploys:** `caisson-docs` deployed from `main@be359eeb` (embed-cache code) — SUCCESS;
  `caisson-support-bot` + `caisson-site` redeployed — SUCCESS.
- **Volume:** dashboard-created volume landed on support-bot by mistake; moved via
  `railway volume detach/attach` (the `add` subcommand panics — CLI bug) and renamed
  `caisson-docs-volume`, mount `/data`.
- **Embed cache PERSISTING (pasted, PR #186 `main@7bc8e713`):** the first deploys wrote
  nothing — Railway mounts the volume ROOT-owned while the container ran `USER bun` (uid
  1000), and the cache write is fail-soft by design (`0 hits / 75 misses` then `0 hits / 87
misses`). PR #186 fixed it: entrypoint chowns the mount then drops privileges via
  `setpriv --reuid=bun` (healthcheck dropped the same way — review finding), plus visible
  errno logging on cache read/save failures. Proof after redeploying from #186: cold boot
  `[service-docs] embed cache: 0 hits / 68 misses (/data/embed-cache.json)` with no
  save-failure line, warm boot `60 hits / 81 misses` — the cache survived the redeploy, and
  because hits are network-free the same 3-minute embed deadline covered 141 chunks instead
  of 68. Coverage converges to the full corpus across the next boot or two, then
  unchanged-corpus redeploys make zero embedding calls.
- **Vault parity (pasted):** `vault-parity-check: clean — vault and caisson.env agree on names.`
  with `--rotated-after 2026-07-08` — 126 names, 7 non-env exclusions printed by title, exit 0.
- **Cost verdict recorded (runbook 1.1):** the credit exhaustion was about 92 tracked
  frontier-model calls (about $0.81 avg) on the PAL lanes, not embeddings; per-service keys
  make future burn attributable per consumer.

---

## 2026-07-08 — EXECUTED: CF beacon auto-injection OFF + full-fleet redeploy (twelfth-sitting fix wave)

**Operator-approved same-session ("do the terrafom apply and fleet redeploy").** Two acts:

**Act 1 — terraform apply, `cloudflare_web_analytics_site.caisson` (CAISSON-50/51 root fix).**
The dashboard-created Web Analytics site (site_tag `d2a2578432d94e78a5ab08392d9f63c4`) was
imported into state first (the file's documented adoption step), then plan showed exactly
`0 to add, 1 to change, 0 to destroy` — only `auto_install = true -> false`. Applied; post-apply
API read-back:

```
caisson.sh auto_install=false
```

The edge no longer injects the beacon `<script>` into `<body>` — the `/login` React #418
hydration mismatch and the CSP-blocked cloudflareinsights load die at the root. Remaining
close-out: rerun the prod-routes live harness and remove the `KNOWN_NOISE` beacon filter
(the tf comment documents this).

**Act 2 — 5-service Railway redeploy from `main`@`72e5cb7a` (the fix wave, PRs #178–#184).**
Why: license mint-deadline + claw-lock (#182), docs boot hardening (#181), admin resend
throttle (#178), site hydration/content/gallery wave (#184), shared migration chain (#180).
All five `railway up --detach` → SUCCESS. No Worker republish (registry/index.json untouched
by the wave — license health confirms the same 46-entry digest). Live probes (pasted):

```
license: {"ok":true,"indexDigest":"864c83b1a203","indexEntries":46}
site: 302        (CF-Access pre-launch gate ON — correct)
www: 302
admin: 200
docs: {"ok":false,"warming":true}    <- the NEW #181 warmup response, live during boot
docs (~90s later): {"ok":true,"chunks":255}
```

The docs warmup evidence is the #181 fix working in production: the service now binds
immediately and serves a warming 503 while embedding (previously: connection-refused 502s for
up to ~10 minutes). Pre-launch gates stay ON (CF-Access site_gate, PADDLE_ENV=sandbox).

---

## 2026-07-08 — EXECUTED: full-fleet redeploy — the eleventh-sitting wave (26 commits, PRs #161–#177)

**Operator authorization:** "want you to do full deploy sequence with the new code", 2026-07-08
session (the whole merged buyer-lifecycle wave plus #161–#164 was undeployed).

**Services/SHAs:** `main@2ff49b04`. Five Railway services redeployed via `railway up` (all
deployments SUCCESS): `caisson-license`, `caisson-site`, `caisson-admin`, `caisson-docs`,
`caisson-support-bot`. `caisson-intel` NOT redeployed (its only delta since `55b3d486` is a
test file). Registry Worker republished (version `1a9cb273-b7d9-41ef-8861-a3b11add0341`) — the
repo index had gained `@caisson/analytics` (PR #159 driver batch) since the Worker's last
publish; add-only, so no same-act admin rebuild required (and admin already baked the 46-entry
index). Anon floor 15→16 modules (`@caisson/analytics` is Apache-2.0 — verified in its
package.json before accepting the count). Pre-launch posture UNCHANGED: CF-Access `site_gate`
ON, `PADDLE_ENV=sandbox`.

**F5 ordering pre-check:** claims schema unchanged — `packages/license-verify/src/claims.ts`
0-line diff `55b3d486..HEAD`, `license-verify` + `registry/index.json` byte-identical over the
wave — so no verifier-first ordering applied.

**Live-verify evidence (pasted):**

- `caisson-license` `/health` → `{"ok":true,"indexDigest":"864c83b1a203","indexEntries":46}`
- `caisson.sh` → `302` to `gridworkdev.cloudflareaccess.com/cdn-cgi/access/login/caisson.sh?…`
  (pre-launch gate ON); `www.caisson.sh` → `302`
- `caisson-admin` `/healthz` → `{"ok":true,"indexDigest":"864c83b1a203","indexEntries":46} [200]`
  (fail-closed gate: 200 proves the boot migration ran)
- `caisson-docs` `/health` → `{"ok":true,"chunks":255} [200]` — after a **~10-minute 502
  warmup window** (boot-time corpus embed over OpenRouter; the corpus has grown past the
  railway.toml comment's "60–90s cold boot" expectation). Boot hardening (bounded embedder
  retry so the FTS-degrade path can fire + boot progress logging) queued in the same-day fix
  wave.
- `caisson-support-bot`: Railway healthcheck-gated SUCCESS (`healthcheckPath = "/health"`,
  30s timeout) — the deploy cannot go SUCCESS without the probe passing.
- Worker anon `index.json` → `{"schemaVersion":1,"count":16}` modules.

**Incident (operator action needed):** while listing domains, `railway domain --service
caisson-support-bot` — which CREATES a domain when none exists (the no-subcommand legacy
behavior) — minted `caisson-support-bot-production.up.railway.app`. The deletion
(`railway domain delete …`) was classifier-blocked in auto mode. The domain serves nothing
(the bot's `/health` answers Railway's internal probe; no routes are meant to be public), but
it is an unsanctioned published surface until deleted.

**Local note:** the Worker bundle build required a fresh `bun install` on the main checkout
first (`tooling/testing`'s new jsdom/react-dom deps from the merged wave; the stale
`node_modules` failed `@caisson/registry-schema`'s dependency build).

---

## 2026-07-07 — EXECUTED: bug-fix redeploy — intel (soc2 tight-loop) + admin (migration-in-instrumentation)

**Operator authorization:** picker "Both now (recommended)", 2026-07-07 session (redeploy of the two
services affected by the CAISSON-49/48 fixes merged in PR #160).

**Services/SHAs:** `main@55b3d486` (PR #160). `caisson-intel` rebuilt on gw-ms-a2 (`docker compose
up -d --build` from `services/intel`); `caisson-admin` redeployed on Railway (`railway up --service
caisson-admin`, deployment `f156b4c0`, Online). Pre-launch posture UNCHANGED: CF-Access `site_gate`
ON, `PADDLE_ENV=sandbox`.

**WHY:** two bugs found during the ninth-sitting intel deploy. **CAISSON-49 (Urgent)** — `setInterval`
clamps any delay over the signed-32-bit ms ceiling (~24.8d) to 1ms, so soc2's 30-day cadence
tight-looped (170× in 75s, hammering AICPA). `longInterval` chains ceiling-bounded `setTimeout`s.
**CAISSON-48** — the admin better-auth migration ran via a `preDeployCommand` that is a no-op on the
Next standalone image (strips `src/`); moved into `instrumentation.register()` (ships in standalone,
awaited before serving), with `/healthz` failing closed on a boot-migration failure.

**Live-verify evidence:**

- `caisson-intel`: `Up (healthy)`, `/healthz` → `{"ok":true}`; **soc2 ran 1× on boot (was 170×)**,
  all six watchers fire once. The `INTEL_CADENCE_SOC2_MS<24d` env workaround was removed — the
  30-day default now works with the fix.
- `caisson-admin`: deployment `f156b4c0` **Online**, `/healthz` → `200 {"ok":true}` (with the new
  fail-closed gate a 200 proves the boot migration succeeded via the instrumentation path), `/` →
  `307` (→ `/login`).

---

## 2026-07-07 — EXECUTED: ninth-sitting seven-PR wave deploy + admin OAuth flip (site + license + admin; no Worker republish)

**Services/SHAs:** `main@a0aa9a3c` (PRs #153–159 merged serially, all in-session SHIP-audited).
Redeployed `caisson-site`, `caisson-license`, `caisson-admin` via `railway up --service <s> --ci`.
`caisson-docs`/`caisson-support-bot` unchanged this wave — not redeployed.

**WHY:** site = marketplace one-surface rework + email consolidation (#154/#153); license = E2 eval
scoring + the F-1 `/health` indexDigest parity leg (#156); admin = the ADR-0283 CF-Access→GitHub-OAuth
flip + the unified component catalog (#155/#153).

**Live-verify (pasted):**

- `curl https://license.caisson.sh/health` → `{"ok":true,"indexDigest":"42817dcc9a2e","indexEntries":45}`
- `curl -so/dev/null -w %{http_code} https://caisson.sh/marketplace` → `302` (CF-Access `site_gate`, expected — pre-launch).
- `curl https://admin.caisson.sh` → `307 -> https://admin.caisson.sh/login?next=%2F` (better-auth own login — **CF-Access gone**); `/login` → `200`.

**Admin OAuth flip — completed end to end (operator-gated, sign-in operator-verified):**

1. GitHub OAuth app "Caisson Admin" created (client id `Ov23li2yV6PG6Ll3oepd`; callback
   `https://admin.caisson.sh/api/auth/callback/github`).
2. **Dedicated `admin_auth` database** created on the Railway Postgres (`CREATE DATABASE admin_auth`) —
   better-auth's own tables (`user`/`session`/`account`/`verification`) live isolated from commerce
   (the config forbids `CAISSON_ADMIN_DB_URL` / the site auth DB to avoid the org-`account` collision).
3. Six `ADMIN_*` vars set on `caisson-admin`: `ADMIN_AUTH_DATABASE_URL` (internal host, `admin_auth`
   db, postgres role — better-auth needs table-DDL rights to migrate), `ADMIN_GITHUB_CLIENT_ID/SECRET`,
   `ADMIN_GITHUB_ALLOWED_USER_IDS=265439716` (GridWork-dev numeric id), `ADMIN_BETTER_AUTH_SECRET`
   (32-byte), `ADMIN_BETTER_AUTH_URL=https://admin.caisson.sh`.
4. **Migration gotcha (CAISSON-48):** the `preDeployCommand = bun apps/admin/src/lib/admin-deploy-migrate.ts`
   is a **no-op on the Next standalone image** (runtime stage copies `.next/standalone`, not `src/`) —
   first deploy served with no tables (`relation "verification" does not exist`). Mitigated by running
   the migration manually from the box against the `admin_auth` PUBLIC url (`cd apps/admin && bun
src/lib/admin-deploy-migrate.ts`) → `account`/`session`/`user`/`verification` created. Filed
   CAISSON-48 for the proper standalone-compatible fix.
5. Operator verified GitHub sign-in works.
6. **`terraform apply` removed the CF-Access `admin_gate`** — `Plan: 0 to add, 0 to change, 2 to
destroy` (the admin_gate access application + policy); `site_gate` refreshed, **untouched**.
   admin.caisson.sh is now gated solely by the GitHub-numeric-id allowlist.

**No Worker republish:** `registry/index.json` byte-unchanged by the wave; the driver batch's
`@caisson/analytics@0.1.0` ledger/index entry is manifest-only (npm tarball stays behind the manual
`confirm=publish` dispatch).

**Still pending (this session's final act):** the intel container (ADR-0286) box-deploy on gw-ms-a2 +
the gridwork-core `identity/security-surfaces.md` rows.

---

## 2026-07-07 — EXECUTED: triage-window wave deploy (site + license + admin; no Worker republish)

**Why:** PRs #147–#152 merged to `main` (head at deploy time: site from `11cb4c30`, license/admin
from `11cb4c30`/`1bc677a4` — #152 touched packages only). Consumed diffs: caisson-site ← #150
site Tier-1 (incl. the credits-advertised-as-free fix); caisson-license ← #151 comp-grant
allowlist (`assertGrantableEntitlementIds`); caisson-admin ← #151 durable Dockerfile fixes
(`ENV HOSTNAME=0.0.0.0` + `CAISSON_REGISTRY_INDEX_PATH=/app/registry/index.json` — the 502
class + the standalone-chdir index-path class both closed at the image layer).
`registry/index.json` byte-unchanged vs the deployed `51be4302` Worker — **no Worker republish**.

**Operator authorization:** deploys of license + admin explicitly approved this sitting ("approved
on the 2 deploys"); site rode the earlier merge-and-clean-state authorization.

**Live-verify (pasted):**

- caisson-site: `railway up` → `Deploy complete`; gate probe →
  `302 https://gridworkdev.cloudflareaccess.com/cdn-cgi/access/login/caisson.sh?kid=a999e511…`
  (pre-launch `site_gate` ON, expected)
- caisson-license: `railway up --ci` → `Deploy complete`; `curl https://license.caisson.sh/health`
  → `{"ok":true}`
- caisson-admin: `railway up --ci` → `Deploy complete`; boot log →
  `▲ Next.js 16.2.9` · `- Network: http://0.0.0.0:8080` · `[observability] OTel SDK started
(service=admin)`; edge probe → `302` (CF-Access `admin_gate` still ON pending ADR-0283)

**Context:** earlier the same day admin.caisson.sh 502'd — root cause: the `HOSTNAME=0.0.0.0`
Railway variable was lost (suspect: env-sync prune, Linear CAISSON-38), Next standalone bound to
the container hostname and Railway's proxy got refused, masked at the edge by the CF-Access 302.
Fixed live (`railway variables --set` + redeploy) before this wave; the Dockerfile ENV makes the
fix survive future env drift.

## 2026-07-07 — EXECUTED: research-response wave deploy (Worker republish + 4-service fleet redeploy)

**Operator authorization:** "approved on the full deploy sequence of the new code once clean state"
(fifth sitting) — executed after the merge queue drained clean at `main` @ `09ed1c89`.

**Services/SHAs:** registry Worker version `51be4302-9caa-452c-9ae5-ff152e68b2d4` (via
`registry/worker/deploy.sh`) + `caisson-license` · `caisson-site` · `caisson-docs` ·
`caisson-support-bot` redeployed via `railway up -y --service <name> --ci` (launch-runbook §2.6),
all from `main` @ `09ed1c89`. `caisson-admin` intentionally skipped — untouched by this wave.

**WHY (consumed-package diff — the five research-response wave PRs):**

- `4d85f28b` — #142 ui-pro first publish @0.1.0 (index 44 → **45 entries**, RESERVED graduation,
  `everything@0.2.2` repin) → Worker republish required.
- `15c50bd6` — #143 E1 demo mode incl. the dep-confusion fix (tokenless
  `@caisson:registry=https://registry.caisson.sh` scope mapping in the generated `.npmrc`).
- `6d0a5c56` — #144 Track S site wave (`/stack-fit`, MODULE_DB_POSTURE, mobile-nav fix,
  pre-launch wording softened) → `caisson-site`.
- `fb72fdd5` — #145 Track K price-agnostic support-SKU plumbing (structurally unpurchasable;
  `NULL_AMOUNT_IS_INTENTIONAL` docs-corpus filter) → `caisson-license` + `caisson-docs`.
- `09ed1c89` — #146 Track C named-regime crosswalks (ADR-0279 proof-level claim posture; CC7.2
  corrected to maps-to) → docs corpus consumers.

**Live-verify (pasted):**

```
$ curl -s https://registry.caisson.sh/index.json | python3 …
anon modules served: 15
ui-pro present: False
metas present: []
kernel present: True

$ curl -s https://license.caisson.sh/health
{"ok":true}

$ curl -s -o /dev/null -w "site: %{http_code} -> %{redirect_url}\n" https://caisson.sh
site: 302 -> https://gridworkdev.cloudflareaccess.com/cdn-cgi/access/login/caisson.sh?…
```

- `caisson-docs` boot log: `[service-docs] serving 246 chunks on :8080` (semantic index rebuilt on
  boot, OpenRouter qwen3-embedding-8b).
- `caisson-support-bot` boot log: container started, OTLP telemetry up — **no Discord CF-1015
  recurrence** this wave.
- All four `railway up` runs ended `Deploy complete`. Pre-launch gates stay ON (CF-Access
  `site_gate` verified live above; `PADDLE_ENV=sandbox` unchanged).
- Note: the anon index serves no per-entry `license` field; the floor proof is the id set itself
  (exactly the 15 Apache base modules — commercial ui-pro and the three dissolved metas absent).

---

## 2026-07-07 — EXECUTED: registry Worker republish for PR #138 (ADR-0271 bundle-only index)

**Operator authorization:** picker lock "Republish bundle-only now (Recommended)", 2026-07-07 third
sitting. Single service: the registry Worker only (no fleet diff — the change is index data + build
scripts; the license service reads entitlements, not the index shape).

**Service/SHA:** registry Worker version `aa27cb94-8fef-4c78-a35f-d0d7f2e257c0`, deployed via
`registry/worker/deploy.sh` from `main` @ `3d23da70` (PR #138). Index 47 → 44 entries: the three
dissolved edition meta-packages (`@caisson/ai-kit` · `@caisson/local-ai` · `@caisson/agent-dev`)
delisted via append-only ledger `delist` lines per ADR-0271.

**Gate evidence:** CI ALLGREEN on the PR head incl. `registry-index` byte-identity against the
44-entry rebuild; SHIP audits both PASS with zero P0/P1 (code review: under-grant computationally
disproven — every bundle loses exactly its meta id, base floor byte-identical; security: all catch
paths degrade to a FRESH base floor, signed-ids-not-expansion contract intact).

**Live-verify (pasted):**

```
$ curl -s https://registry.caisson.sh/index.json | python3 …
modules: 15
@caisson/ai-kit absent
@caisson/local-ai absent
@caisson/agent-dev absent
kernel present: True
```

Anonymous view = the 15-module free base floor, unchanged. The licensed view is a pure function of
the inlined CI-built index (deploy-entry esbuild-inlines `registry/index.json`) — byte-identity on
the merge commit is the proof the deployed bundle serves the 44-entry index.

---

## 2026-07-07 — EXECUTED: post-merge redeploy for PR #133–#136 + ADR-0270 legacy-grant drain

**Operator authorization:** picker answers "Run it now" (fleet redeploy) + "Run with the redeploy"
(drain), 2026-07-07 session. Pre-launch posture UNCHANGED: CF-Access `site_gate` ON (302 verified
below), `PADDLE_ENV=sandbox` on `caisson-license`.

**Services/SHAs:** registry Worker (version `4c6c61fa-d6ca-45b8-9c63-24ccd85ae2b3`) +
`caisson-license` + `caisson-site` deployed from `main` @ `c27a0a27` (covers PR #133 `70607f6f` ·
#134 `3ae944af` · #135 `b7e58a8d` · #136 `9a81dd7a`). `apps/admin` had no diff across the wave —
no admin redeploy. Order executed (verifier-first per the standing constraint): **Worker → drain →
license → site**.

**WHY (consumed-package diff):** #136 — emptied `LEGACY_ENTITLEMENT_ALIASES` + decoupled
`EDITION_BUNDLE_ID` fold (ADR-0270), entitledSince-filtered `resolveGate`, subscription-cycle
receipt split, renewal-refund un-extend (migration `0017_renewal_extension`); #133/#134 —
dual-door hero, honest-artifact bento, `/affiliates`, 20-page `/compare`, AEO robots/schema,
members-gate purge fix (`apps/site`); #135 ui-pro is in-repo only (publish HELD, ADR-0259 reserved
slug — nothing to serve).

**Drain (ADR-0270 §4):** read-only enumerate returned **zero** legacy edition grant rows (no real
buyers, as gated); the DO block in `services/license/scripts/drain-legacy-edition-grants.sql` then
ran as the superuser deploy role for the formal proof — NOTICE `drain complete: zero legacy
edition grant rows remain` (0 migrated, 0 duplicates across all four legacy→canonical pairs).

**Live-verify evidence (pasted):**

- Worker: `bunx wrangler deploy` → version `4c6c61fa-d6ca-45b8-9c63-24ccd85ae2b3`; `GET
/index.json` → `200`; `GET /modules/@caisson%2Fcompliance` → `404` anon (fail-closed); anon base
  set = 15 oss modules.
- `caisson-license`: `railway up --ci` → `Deploy complete`; `curl https://license.caisson.sh/health`
  → `{"ok":true}`; preDeployCommand applied `0017_renewal_extension` — `schema_version` row
  `17 | t` (checksum ok); RLS policy `renewal_extension_tenant_isolation | {public}` present.
- `caisson-site`: `railway up --ci` → `Deploy complete` (image
  `sha256:9f77c7e834b543c1512b3e6f08323f67110cc410accf24b6b5d088d89bcc847e`); `https://caisson.sh/`
  → `302 → gridworkdev.cloudflareaccess.com/.../login/caisson.sh` (pre-launch gate ON).

**Not done (by design, this act):** R2 tarball publish stays behind `confirm=publish` dispatch;
ui-pro first-publish HELD for the hardening + gallery wave (operator picker); CF-Access flip and
Paddle production remain launch-gate acts per `docs/state/launch-runbook.md`.

## 2026-07-07 — staged #131+#132 redeploy EXECUTED: Worker + license + site + admin, expiry scheduler armed, admin re-provision

**Operator authorization:** "full deploy sequence approved run all" (2026-07-07 session resume).
Pre-launch posture UNCHANGED: CF-Access `site_gate` ON (302 verified below), `PADDLE_ENV=sandbox`
on `caisson-license` (checked via `railway variables` pre-deploy).

**Services/SHAs:** registry Worker (version `55475850-b76e-4b5a-b566-bd062109a57e`) + `caisson-license`

- `caisson-site` + `caisson-admin` redeployed from `main` @ `e2966348` (covers PR #131 `15ff1f32` +
  PR #132 `b8fe8731`). Deploy order honored the standing constraint: **Worker first** (the #131
  ADR-0269 claims widening), license re-mint after; site/admin unordered.

**WHY (consumed-package diff):** #131 — registry index 29-entry version-cut ledger incl.
`@caisson/compliance@0.5.0` `kind:"bundle"` at 104900 + ADR-0269 Developer-plan coverage in
`services/license`; #132 — commerce lifecycle emails + alias-folded renewal read-back
(`services/license`), six-bundle homepage/nav/modal + `/updates` + dashboard renewal display
(`apps/site`), pg-pool idle-error 502 guard (`apps/admin`).

**Also in this act (the "Next DEPLOY" tracker row):** migrations `0014`–`0016` were found ALREADY
applied (the 07-06/07 triple-merge preDeploy ran them) — a read-only CAISSON-16 drift audit
pre-deploy showed **v1–v16 all checksum-ok, zero drift, nothing pending**. The two real gaps were
closed: `CREDIT_EXPIRY_SCHEDULE="0 6 * * *"` set on `caisson-license` (pre-`railway up`, so one
deploy armed it) and the admin mutation surface re-provisioned with the explicit `admin_app`
grantee (the CAISSON-17 footgun avoided).

**Live-verify evidence (pasted):**

- Worker: `GET /modules/@caisson%2Fcompliance` → `404` anon (fail-closed) · `GET /index.json` →
  `200` · anon base set serves the #131 bumped versions (`@caisson/auth 0.3.1`, `@caisson/billing
0.5.0`, `@caisson/kernel 0.4.2`, …).
- `caisson-license`: `railway up --ci` → `Deploy complete`; `curl https://license.caisson.sh/health`
  → `{"ok":true}`.
- `caisson-site`: `Deploy complete`; `https://caisson.sh` → `302 →
gridworkdev.cloudflareaccess.com/.../login/caisson.sh` (pre-launch gate ON).
- `caisson-admin`: `Deploy complete`; `302 → .../login/admin.caisson.sh` (permanent operator gate).
- Post-provision DB check: `grant_consumption` policies =
  `[grant_consumption_admin_write {admin_write}, grant_consumption_tenant_isolation {public}]`;
  `pgboss.schedule` = `[{"name":"credits.expiry_tick","cron":"0 6 * * *"}]` — the expiry
  scheduler is live-armed.
- Provision script output: `applied: admin mutation provision` · `applied: role grants to
admin_app` · `roles: admin, admin_write, app`.

**Not done (by design, this act):** R2 tarball upload for the 29 new sidecar rows stays behind its
own gated `confirm=publish` dispatch; CF-Access flip, Paddle production — all remain operator-gated
launch acts per `docs/state/launch-runbook.md`.

## 2026-07-06/07 — triple-merge deploy: six-bundle catalog live (gated), Worker-first claims rollout

**Operator authorization:** "once like on clean state want to deploy all new code to prod but still
gated not go live sequence" (2026-07-06 session). Pre-launch posture UNCHANGED: CF-Access
`site_gate` stays ON, `PADDLE_ENV=sandbox` stays on `caisson-license` (verified below), no go-live
step executed.

**Services/SHAs:** registry Worker + all 5 Railway services redeployed from `main` @ `08ee90dd`
(= PR #128 Kickoff E + PR #129 Kickoff F + PR #130 Kickoff D catalog program + the post-merge
reconcile). Deploy ORDER honored the standing constraint above: **Worker first** (version
`1630b709-a8af-4126-b3fc-5c57ac489b7c`), license service after — no token re-mint can now meet an
old verifier.

**WHY (consumed-package diff):** the catalog program rewired the whole commerce surface
(six-bundle pricebook + purchased-id token claims + alias-group renewals + the reworked site
display), E added the updates-window edge filter + credit expiry, F added CLI/emitters/WORM
drivers; `services/docs` regenerates its pricing corpus from the new bundle SOT.

**Live-verify evidence (pasted):**

- Registry Worker anon surface (the six-bundle index at the edge):
  `GET https://registry.caisson.sh/` → **15 anon modules** (ai-config, auth, billing, cli, email,
  jobs, kernel, license-verify, mcp-server, migrate, observability, rate-limit, registry-schema,
  tenancy-rls, ui) — **`credits` correctly ABSENT** (commercial per ADR-0258 §2);
  `GET /modules/@caisson%2Fcompliance` → `404` · `GET /modules/@caisson%2Feverything` → `404`
  (fail-closed, invisible) · `GET /index.json` → `200`.
- `caisson-license` → `curl https://license.caisson.sh/health` → `{"ok":true}` HTTP 200;
  deployment `0022d863` SUCCESS; `railway variables` → `PADDLE_ENV=sandbox`.
- `caisson-site` → `https://caisson.sh` → HTTP 302 →
  `https://gridworkdev.cloudflareaccess.com/cdn-cgi/access/login/caisson.sh?...` (pre-launch gate
  ON); deployment `eb173a16` SUCCESS.
- `caisson-admin` → HTTP 302 → `.../access/login/admin.caisson.sh?...` (permanent operator gate);
  deployment `c4893708` SUCCESS.
- `caisson-docs` → `/health` 502 during the ~40s boot-time corpus rebuild, then **HTTP 200**; logs:
  `[service-docs] semantic index built (OpenRouter qwen3-embedding-8b, 1024-dim)` ·
  `[service-docs] serving 227 chunks on :8080` (the regenerated bundle-pricing corpus); deployment
  `453f812c` SUCCESS.
- `caisson-support-bot` → deployment `2e296b8c` SUCCESS, Railway Online (no public hostname).

**Not done (by design, this act):** CF-Access flip, Paddle production credentials/catalog, Worker
npm-delivery R2 activation (`CAISSON_PUBLISH_DRY_RUN` untouched) — all remain operator-gated
launch acts per `docs/state/launch-runbook.md`.

---

## 2026-07-05 — site-design-2 close-out: issuer-key rotation ×2, edge deny-set live, fleet redeploy

**Services:** `caisson-license`, registry Worker (rotation, both live-verified), `caisson-site`,
`caisson-docs` (redeployed 2026-07-05, current with `main`).

**SHAs (PR merges on `main`):**

- `f178f9a` — #117 `fix(license): rotate the production issuer keypair (ADR-0226 P0)`
- `90b6dc1` — #118 `fix(registry): dev-key worker fixtures and second key rotation`
- `8ab8ccc` — #120 `fix(site): re-audit visual findings — scroll fades, overflow root causes, contrast`
- `9ca1282` — #121 `feat(site): glossary batches 2-3 — all 32 ADR-0235 terms live`
- `a551702` — #122 `chore(tooling): visual-audit ledger reconcile, 82 findings closed`

**WHY (consumed-package diff):** `packages/license-issue` + `packages/license-verify` + the
registry-Worker baked verify key all changed twice in one sitting — PR #117's rotation shipped a
worker fixture that was ITSELF a live prod-signed token (caught in review), forcing a second
rotation (#118) before either could go live. Separately, `apps/site` shipped its glossary batch 2-3
content + visual-audit fixes (#120/#121), requiring a site+docs redeploy to serve them; and
`launch-runbook.md` §8's edge revocation deny-set (R2 bucket + `REVOCATIONS` Worker binding + the
authed PUT shim on `caisson-admin` + the `license_revocation` DDL) went from `edgePublish: "skipped"`
to armed.

**Live-verify evidence (as recorded in source docs — no raw transcript preserved):**

- Active issuer fingerprint **`a170f7a0ab89bab0`** confirmed baked into `caisson-license` +
  the registry Worker post-redeploy; old fingerprints `0ae7d2abb886ca3d` / `c0bfb8277a840d2e` retired
  (`infra/license-issuer/ISSUER_PUBLIC_KEY.md` retired-keys table, cited by
  `docs/state/launch-runbook.md` §0).
- Edge deny-set: "a revoke now republishes to the edge and `edgePublish` reports `ok`/`failed`, no
  longer `skipped`" (`docs/state/launch-runbook.md` §7, "Operator-gated DEPLOY — EXECUTED
  2026-07-05" paragraph).
- Visual-audit ledger reconciled against **fresh 48-route × 4-variant captures**: 82 closed · 125
  open · 14 accepted, 221/221 findings re-verified (`docs/state/decisions-and-forks.md`, "State
  addendum — 2026-07-04/05 execution" section, PR #122).
- Glossary: all 32 ADR-0235 terms live, llms.txt parity confirmed (same addendum section, PR #121).

**Not yet done (flagged, not silently dropped):** `OPENROUTER_API_KEY` / `DISCORD_TOKEN` /
`MIRROR_PUSH_TOKEN` rotations remain operator-owed and block the `caisson-oss` public flip
(`docs/state/launch-runbook.md` §1.1 sequencing gate; `docs/state/opportunity-backlog.md` residue
item 3).

---

## 2026-07-03/04 — deploy-closeout: fleet redeploy, registry npm install-proof, first live consume

**Services:** `caisson-site`, `caisson-license`, `caisson-docs`, `caisson-support-bot` (4 of the 5
Railway services redeployed), registry Worker (redeployed with new custom domain + R2 bindings).

**SHAs (PR merges on `main`, publish-pipeline fixes en route):**

- `9d02ef5` — #105 `fix(registry): bun pm pack rejects --filename with --destination, pass full path`
- `cea5dca` — #106 `fix(registry): stage all workspace bumps in the publish commit step`

**WHY (consumed-package diff):** the registry Worker gained the `registry.caisson.sh` custom domain
plus new `TARBALLS` + `REVOCATIONS` R2 bindings (self-hosted npm delivery, ADR-0223) — a redeploy
was required to activate them. `apps/site` needed the ask-AI widget + Turnstile env and PostHog
purchase-capture wiring; `services/docs` needed the expanded docs corpus re-embedded; the ADR-0203
Discord role-push path needed its grant token minted and both push sides' env set. The registry's
first live `changeset` publish/consume cycle then surfaced two pipeline bugs (`bun pm pack` rejecting
`--filename` alongside `--destination`, and the publish commit step missing some workspace version
bumps) — fixed in the same window (#105/#106) before the install-proof could go green.

**Live-verify evidence (as recorded in source docs):**

- "4 Railway services redeployed (site/license/docs/support-bot — ask-AI + Turnstile env, PostHog
  purchase capture, expanded docs corpus re-embedded)" (`docs/state/opportunity-backlog.md`, snapshot
  paragraph, lines 17–19).
- "the registry Worker redeployed with `registry.caisson.sh` custom domain + TARBALLS + REVOCATIONS
  R2 bindings, the Paddle SANDBOX catalog verified reconciled (4 dropped products archived, 19 prices
  match), and the first live changeset consume run" (same doc, lines 20–23).
- Residue item (1) marked **DONE 2026-07-03/04** — "live `bun install` proof + first live consume
  ran (two pipeline bugs fixed en route, PRs #105/#106)" (`docs/state/opportunity-backlog.md` line
  26).
- Mac-mini CI runner (org-transfer orphan) resolved same window — "scale set re-registered,
  `native-ext (macos)` green" (`docs/state/opportunity-backlog.md` line 36, residue item 6).

---

## 2026-07-02/03 — launch-runbook §7 DEPLOY block: migrations 0006–0009, admin mutation surface, WORM, CF rate-limit, Paddle SANDBOX reprice

**Services:** `caisson-license`, `caisson-admin` (both redeployed from merged `main`); live Railway
Postgres (migrated); `caisson-worm` S3 bucket (WORM anchors written); Cloudflare edge (Terraform
applied).

**SHAs (the 4 PRs whose merge triggered this DEPLOY block, per `launch-runbook.md` §7):**

- `9485463` — #66 `feat/paddle-partial-refund` (ADR-0218)
- `0fb6398` — #67 `feat/live-seams-kms-onnx` (ADR-0221)
- `3ed9c8d` — #68 `feat/cf-front-rate-limit` (ADR-0219)
- `9011cb8` — #69 `feat/admin-mutation-surface` (ADR-0220)

**WHY (consumed-package diff):** ADR-0218 (Paddle per-line refund) added nullable `line_item_id`
columns to `entitlement_grant` + `credit_event`; ADR-0220 (admin mutation surface v1) added its own
schema — both shipped as new numbered migrations `0008`/`0009` that had to land on the live Postgres
**before** `caisson-license` booted the new code reading them. ADR-0219 (CF front rate-limit) needed
a Terraform apply against the live Cloudflare zone. ADR-0221 (live-seams KMS/ONNX proof) needed the
WORM store pointed at the real `caisson-worm` S3 Object-Lock bucket.

**Live-verify evidence:**

- **CAISSON-16** — "migration checksum drift at v3 (PR #69 edited a pinned `*_SCHEMA_SQL` in place)
  reconciled read-only, blessed as the sole drift, then migrations `0006`–`0009` applied to the live
  Railway PG (the ledger was at v1–v5 — `0006 account_member` had never reached prod)"
  (`docs/state/launch-runbook.md` §7 executed-banner).
- **CAISSON-17** — admin mutation surface provisioned; "grantee gotcha — the first run granted
  `admin/admin_write/app` to `postgres` (CURRENT_USER default), not `admin_app`; fixed with an
  explicit grant, then a live grant→revoke round-trip PASSED (dual log rows + WORM anchors, typo'd
  account → 404)" (same banner).
- **CAISSON-18** — env-gated S3 store (PR #79) proven: "anchors in `caisson-worm` with Object-Lock
  retention to 2033. Flagged residual: the bucket's default lock mode is GOVERNANCE, this section
  said COMPLIANCE — operator to confirm posture" (same banner; posture later resolved GOVERNANCE
  pre-launch / COMPLIANCE-at-flip by ADR-0230).
- **CAISSON-15** — Terraform imported + applied (rate-limit + WAF rulesets, docs-api proxied);
  **"429s proven on `/query` with cf-ray"**; `license.caisson.sh` confirmed untouched grey-cloud
  (same banner).
- Both `caisson-license` + `caisson-admin` redeployed from merged `main` — "SUCCESS; license
  `/health` 200" (same banner).
- All four Linear issues (CAISSON-15/16/17/18) marked Done.
- Paddle SANDBOX edition prices re-pointed: "the 4 Paddle SANDBOX edition prices re-pointed
  (compliance 79900 per ADR-0227)" (`CLAUDE.md` cadence section, "execution wave + DEPLOY block"
  paragraph).

---

## 2026-07-02 — five-service Railway redeploy, registry Worker → 0.2.0, env activations, SigNoz volume cleanup

**Services:** all 5 Railway services (`caisson-site`, `caisson-license`, `caisson-admin`,
`caisson-docs`, `caisson-support-bot`) — 4/5 verified live at first pass; registry Worker.

**SHAs (the 2 PRs whose merge preceded this wave):**

- `2dc44cc` — #45 `fix/security-billing-hardening` (Strix pentest remediation, ADR-0204)
- `8e5eb4d` — #46 `chore/edition-tails-ops` (ADR-0205–0209)

**WHY (consumed-package diff):** PR #45 shipped the shared SSRF resolve-and-recheck guard, the
`X-Real-IP`-keyed rate-limiter, the fail-closed `apps/admin` CF-Access-JWT middleware (needs
`CF_ACCESS_TEAM_DOMAIN`/`CF_ACCESS_AUD` set to activate), and the `lineItems`-carrying Paddle
fulfillment path. PR #46 shipped the Azure/Bedrock RentedTransport drivers, the `compliance` runtime
composition of `alerting`+`retention-runner`, the support-bot Linear Triage sink (needs
`LINEAR_API_KEY`/`LINEAR_TEAM_ID`/`LINEAR_TRIAGE_STATE_ID`), the `apps/admin` `/ops` Grafana Tempo
rebuild (needs `GRAFANA_URL`/`GRAFANA_QUERY_TOKEN`/`GRAFANA_TEMPO_DATASOURCE_UID`), and the
members-fold republish to registry index **0.2.0** (ledger 64 lines, 32 entries). None of this is
live until the fleet redeploys on the merged code and the new env vars are set.

**Live-verify evidence (as recorded — no raw transcript preserved):**

- "the 5 Railway services redeployed from merged `main` (4/5 verified live; `caisson-support-bot`
  recovering from a transient Discord CF-1015 egress-IP ban at first boot)" — the Discord bot's first
  boot after redeploy hit a transient Cloudflare error 1015 (rate-limited) egress ban from Discord's
  side; recovered on retry (`CLAUDE.md` cadence section, "Go-live tail merge + deploy wave" paragraph).
- "the registry Worker redeployed (0.2.0 index verified, zero drift)" — the public index matched the
  repo's 32-module manifest with zero drift (same paragraph; also `docs/build-state.md`'s
  edition-tails-ops section: "public base view: 15 Apache-2.0 modules @ 0.2.0, zero drift vs the
  repo's 32-module index — verified live").
- "`caisson-admin`'s CF-Access + Grafana env and `caisson-support-bot`'s Linear env set" (same
  paragraph) — admin gate verified live: "the admin gate is live (edge 302s to the Access login,
  verified)" (`docs/build-state.md`, Strix section).
- "the 3 orphaned SigNoz volumes deleted (Railway soft-delete, purge 2026-07-04)" — cleanup of the
  volumes left behind by the earlier ADR-0177 SigNoz→Grafana-Cloud provider switch (same paragraph).

---

## 2026-07-01 — Stage-2 Railway fleet cutover + DNS off Cloudflare Pages

**Services:** `caisson-site` (unified marketing + docs + buyer dashboard), `caisson-license`,
`caisson-admin`, `caisson-docs`, `caisson-support-bot`, 5-service self-hosted SigNoz stack (later
removed same day by the ADR-0177 provider-picker lock — see below). DNS cut over apex/www from
Cloudflare Pages to Railway.

**SHAs:**

- `747ea25..c6dbaa5` — merge range cited in `docs/build-state.md`'s "DEPLOY EXECUTED (2026-07-01)"
  banner (PR #33 `feat/dashboard-unified-and-p6-tail` folding Streams A–D, plus the immediately
  following `admin.caisson.sh` DNS + permanent CF-Access-gate commit).
- `747ea25` — Merge PR #33 `feat/dashboard-unified-and-p6-tail`.
- `c6dbaa5` — `feat(infra): admin.caisson.sh DNS + permanent operator CF-Access gate (ADR-0138/0140)`.

**WHY (consumed-package diff):** the four parallel Stage-2 streams (A obs-admin, B harvest-modules,
C edition-hardening, D base-adapters+org-accounts) all merged into one integration branch and then
`main` — this was the first deploy of `apps/admin`, the 6 new Stage-2 packages, and the dashboard
host/DB switch off Cloudflare Pages (ADR-0114/0115) onto one dynamic Next 16 `standalone` app on
Railway with Railway-managed Postgres. Nothing in this diff could go live without provisioning the
Railway services, the DB, and the DNS cutover in one act — hence a first-of-its-kind fleet-wide
DEPLOY rather than a single-service redeploy.

**Live-verify evidence (as recorded in `docs/build-state.md`'s "DEPLOY EXECUTED (2026-07-01)"
banner — no raw transcript preserved):**

- `caisson-site` → caisson.sh + www: **"200, CF-Access pre-launch gate on"**.
- `caisson-license` → license.caisson.sh: **"service `/health` 200; custom-domain cert
  auto-issuing"**.
- `caisson-admin` → admin.caisson.sh: **"200, PERMANENT operator CF-Access gate"**.
- `caisson-docs`, `caisson-support-bot` deployed; SigNoz 5-service stack provisioned
  (`railway deploy -t signoz`) — this stack was itself removed later the same day when the
  provider-picker locked Grafana Cloud as the sole OTLP sink (ADR-0177) and all 5 SigNoz Railway
  services were deleted.
- DNS cutover applied via Terraform: "apex/www Pages→Railway, license + admin added, Pages
  custom-domains detached."
- "admin PG role provisioned (`admin` NOLOGIN + `admin_app` non-super login)."
- Registry Worker redeployed: "serves rebuilt 27→32 index; anon base-set gated."
- D4 org accounts activated same session.
- Live DB verified: "migrated + verified (app role NOSUPERUSER/NOBYPASSRLS, 5 tenant tables
  FORCE-RLS, 4 better-auth tables, idempotent)" (`docs/build-state.md`, "STAGE-2 INTEGRATION +
  DEPLOY (2026-07-01)" paragraph — two live-fixed bugs on this branch: the Next-standalone
  `HOSTNAME=0.0.0.0` bind fix for a boot 502, and the Paddle-origin CSP fix).
