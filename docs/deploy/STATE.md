---
updated: 2026-07-07
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
convention (`outputs/specs/sot-expansion/SPEC.md` §1.4).

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
