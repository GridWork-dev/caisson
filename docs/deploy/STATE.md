---
updated: 2026-07-17
status: live
grounds:
  - docs/build-state.md
  - docs/ops/launch-runbook.md
---

# Deploy log

## 2026-07-17 (late PM) — Parallel-wave deploy: v2026.07.17.4 ride + Worker + caisson-site (`03b07b33`)

Operator-approved ("Ride + site redeploy") closing the ADR-0357 PM parallel wave
(PRs 257-260 + version PR 261 consume: agent-kernel/agent-dev 0.6.0 · mcp-server 0.5.0 ·
site 0.2.6 · registry 0.0.12). Pre-launch gate stays ON.

- **caisson-site redeployed** (`railway up`): the four ADR-0357 copy locks live — verified
  serving on `/compliance` (proof-scope block) and `/build-vs-buy` (DIY objection). No
  migrations in the wave (no license predeploy needed).
- **Registry publish ride `v2026.07.17.4`:** the first attempt (tag `v2026.07.17.3`) FAILED
  CLOSED at the byte gate — the 261 consume churned `@caisson/cli@0.6.2` packed bytes at an
  unchanged version (third occurrence of the pack-embeds-devDep-versions class). The new
  sibling-churn gate (PR 257) could not catch it: it runs only on release-branch synchronize,
  and a single-shot version PR never fires one — filed CAISSON-124 (run the check inside the
  dispatch `--mode version` step). Row re-recorded from a pristine no-build worktree at the
  tag (hash matched the byte-gate computation exactly, `03b07b33`), re-tagged, ride green —
  53 tarballs staged/uploaded byte-verified.
- **Worker redeployed** bundling the corrected sidecar + the 261 index: live `/index.json`
  advertises cli 0.6.2 + mcp-server 0.5.0 on the public floor (commercial entries correctly
  absent unauthenticated; agent-dev's "delisted — skipped" is pre-existing catalog state).
- **R2 parity probe first production run (auto-fired by the green publish; correctly SKIPPED
  after the failed one): DRIFT — 1 hash-mismatch + 93 missing.** The mismatch was tonight's
  own re-record meeting the ride's upload-never-overwrites rule (R2 kept the morning
  cli-0.6.2 bytes while the sidecar advertised the tag-tree bytes) — REPAIRED in-session per
  the morning's operator-locked overwrite procedure (`wrangler r2 object put` from a pristine
  tag pack, round-trip sha1 `c8d22311`/24602B verified). The **93 MISSING are the historical
  backlog**: superseded versions recorded in the sidecar that no ride ever uploaded (rides
  stage only rows current at ride time — the morning "43 byte-verified" and tonight's 53 were
  the current sets). The index/packument advertises full version history, so a buyer pinning
  an old version would 404 — pre-launch severity low, but it needs an operator fork
  (backfill from historical checkouts vs prune historical rows vs accept-advisory). The
  probe stays red on its daily cron until that fork is decided — by design, it is advisory
  and gates nothing.

## 2026-07-17 (PM) — Kickoff-U reconcile wave: fleet redeploy + v2026.07.17.2 ride + R2 repair + Worker + PostHog activation (`331e971e`)

Operator-approved deploy wave closing the Kickoff-U reconcile (PRs #246/#247/#250/#251 + version
PR #256, ADR-0353–0356). Pre-launch gate stays ON (Paddle sandbox); Rekor anchoring set stays
UNARMED.

- **Fleet redeploy (touched four, `railway up`):** caisson-license (predeploy
  `applied 0, skipped 29` — no new migrations, swap confirmed), caisson-site (Ask-AI
  `$ai_generation` capture + version bumps), caisson-support-bot (M4 telemetry observer + clears
  audit M1 stale-code debt; fresh container confirmed), caisson-admin. services/docs skipped
  (unchanged). Probes all 200: site `/healthz` + `/demo`, license `/health`, support-bot
  `/health`, admin.
- **PostHog LLM-obs ACTIVATED (ADR-0356):** `POSTHOG_CAPTURE_KEY` set on caisson-site +
  caisson-support-bot from caisson.env (host defaults US). Events flow on the next real model
  call; no prompt/completion text by design.
- **Registry publish ride `v2026.07.17.2`** (second ride of the day): the first attempt (tag
  `v2026.07.17.1`) FAILED CLOSED at the byte gate — the #256 consume bumped workspace deps
  embedded in `@caisson/cli@0.6.2` + `@caisson/platform-reads@0.2.1` packed package.json at
  unchanged versions (the #249/#253 churn class), staling both append-only rows. Re-recorded
  from a pristine NO-BUILD worktree at the tag (`331e971e`; published tarballs are SOURCE packs —
  a built worktree poisons `bun pm pack` with dist/.turbo/test artifacts, 2-6x fat and can never
  match CI). Ride 2 green: **6 tarballs uploaded, 42 already present, byte-verified at the tag**.
- **R2 repair (operator-locked exception to never-overwrite):** the two re-recorded keys held the
  morning's bytes while the sidecar (and any future Worker packument) carries the tag-verified
  hashes — a Worker redeploy would have broken installs of exactly those two versions. Both
  objects overwritten with byte-exact tag repacks (sha1 `6269e79e` cli / `dc21caee`
  platform-reads), round-trip-verified from R2. Caveat: any pre-existing lockfile pinning the OLD
  integrity of these two versions fails — pre-launch that is only our own test installs.
  CAISSON-119's R2-parity probe covers recurrence.
- **registry Worker redeployed:** version `a52b98f1` from the pristine tag worktree (pricebook +
  license-verify dists built first; deploy.sh builds registry-schema). `registry.caisson.sh/health`
  200; packuments now advertise the v2026.07.17.2 rows consistent with R2.

## 2026-07-17 — runtime+sandbox wave: R2 publish ride + Worker + site/support-bot/license redeploys (`12182a52`)

Operator-approved close-out of the CAISSON-109/110 wave (PRs #244/#249/#253/#254/#255 + consumes
#245/#248/#252). Pre-launch gate stays ON (Paddle sandbox).

- **Registry publish ride `v2026.07.17`** (the sandbox audit's failing-install finding was a real
  prod registry gap): tag at `96645936` after 3 consumes + 2 stale-row re-records → publish.yml
  `dry_run=false` SUCCESS — **43 tarballs uploaded to R2, 5 already present, byte-verified at the
  tag**. Recurrence guards on CAISSON-119 (R2-parity probe; pack-embeds-devDep-versions churn).
- **registry Worker redeployed** (operator-approved): version `0a9e722d` via wrangler on a fresh
  worktree (built the missing pricebook + license-verify dists first — deploy.sh only builds
  registry-schema). `registry.caisson.sh/health` 200; scaffold install/build/test proof green
  against the live registry after rebuilding the stale bundled CLI index snapshot.
- **caisson-site redeployed** (`railway up`, SUCCESS): PR #254 `/demo` surface — prebuilt preview
  pane with a REAL passing transcript, demo-run with F5 atomic caps, bounded-body reads on
  demo-run + ask-ai. Probes: `/demo` 200 · bare POST 403 (Turnstile fail-closed) · `/healthz` 200.
- **caisson-support-bot redeployed** (`railway up`, SUCCESS) — carries the docs-RAG excerpt
  updates from the wave.
- **caisson-license redeployed twice** — the first run FAILED CLOSED on
  `checksum drift at version 24 (0024_rate_limit.sql)`: the three PR #254 site-local migrations
  (0023-0025) landed mid-chain because the shared platform chain had itself grown 0023-0026 and
  the assembly renumbers positionally. Fix PR #255 (merged `12182a52`) renamed them 0027-0029 +
  added an append-only assembled-ledger golden test. Second run SUCCESS:
  `[deploy-migrate] platform: applied 3, skipped 26` (`rate_limit`, `demo_run_budget`,
  `demo_run_leads` created), better-auth ensured. Post-migrate probe:
  `GET /api/demo/run` → `{"enabled":true}` 200 (was 500 on the missing tables).
- **Migration lesson (locked into tests):** site DB migrations apply ONLY via caisson-license's
  `preDeployCommand` — redeploying caisson-site alone never migrates; and a new migration's
  numeric prefix must sort past the merged chain's highest (claimed-prefix registry in
  `@caisson/platform-migrations`; next free `0030`).

## 2026-07-15 (PM) — trust-page site redeploy + intel container rebuild + Better Stack public status page (`0a58f8ee`)

Same-day follow-on to the reconcile redeploy below, carrying the two post-picker build PRs:

- `caisson-site` → redeployed with PR #242 (`/trust` page + subprocessor module + footer route);
  live probe `https://caisson.sh/trust` 200 with subprocessor table, betteruptime link,
  `security@caisson.sh`, and zero `certif|compliant` hits (ADR-0080 gate).
- **Better Stack public status page LIVE**: `https://caisson.betteruptime.com` (id 255425),
  monitors site 4656433 · license 4656434 · docs-RAG 4676344. Created WITHOUT the custom domain
  (the SPEC's own fallback) — `status.caisson.sh` attach + terraform CNAME stays operator-gated.
- **intel container** rebuilt from PR #243 (`docker compose up -d --build`, healthy) — hash-mode
  watchers now persist snapshots, so the CAISSON-101 eval lane arms at the next genuine
  EUR-Lex/AICPA page change.
- **registry Worker DEPLOYED (operator-directed follow-up, same sitting):** version
  `71bff3c8` via `registry/worker/deploy.sh` — `registry.caisson.sh/health` 200
  `{"status":"ok","version":1}` (3× consistent). 4th Better Stack monitor created
  (id 4677314, "Module registry") and attached to page 255425 (resource 8964977).
- **`status.caisson.sh` CUSTOM DOMAIN LIVE (operator-directed):** free-tier support
  re-verified, `custom_domain` set on page 255425, `infra/terraform/status-page.tf` CNAME →
  `statuspage.betteruptime.com` applied **targeted only** (`-target=cloudflare_dns_record.status_page`;
  the email.tf records exist in Cloudflare but NOT in this tfstate — a blanket apply would
  create duplicates; their import runbook remains an open operator act). Probe:
  https://status.caisson.sh 200, all 4 monitors rendered.

## 2026-07-15 — reconcile-wave fleet redeploy: site · admin · license · docs on clean main (`ca44db58`)

Operator-approved at the 07-15 reconcile picker. WHY: put the merged six-PR wave (#235–#240,
kickoffs S+T + the four SPEC exec lanes) plus the #241 close-out (anchoring-scheduler wiring,
release-age fix, state sweep) onto the fleet. Pre-launch gate stays ON (Paddle sandbox).
Scope by diff vs pre-wave main: site (49 files, motion v2), admin (6), license (6, scheduler
wired INERT), docs (kernel dep changed). Skipped: registry Worker (test-only change),
support-bot + intel (zero changes).

Evidence (`railway up -s <svc> --ci` from the main checkout, sequential):

- `caisson-site` → SUCCESS 12:09Z · probe `https://caisson.sh` 200
- `caisson-admin` → SUCCESS 12:11Z · probe `https://admin.caisson.sh` 307 (OAuth gate, expected)
- `caisson-docs` → SUCCESS 12:14Z · probe `https://docs-api.caisson.sh/health` 200
- `caisson-license` → first attempt FAILED at boot (`EACCES reading /app/packages/auth/src/jwt.ts`):
  the file was mode 600 locally (git tracks only the executable bit, so invisible to status) and
  `railway up` ships local perms; license runs from source so the runtime user hit it — site/admin
  build as root at build time and survived. Fixed by chmod'ing 73 non-world-readable local files
  (git status unchanged), redeploy `a3c19b45` → SUCCESS 12:18Z · probe
  `https://license.caisson.sh/health` 200 · boot log clean, issuer serving, no scheduler line
  (`ANCHOR_CHECKPOINT_SCHEDULE` unset → inert by design, arming is a separate operator act).

## 2026-07-12 — FIRST RELEASE-TRAIN RIDE: v2026.07.12 (ADR-0325/0328 D2) — R2 catalog upload + mirror sync

Operator-approved (session 4 kickoff step 4b). WHY: the version PR (#222, 153 changesets →
`d4a32ecc`) put the whole catalog's new versions in ledger/index/tarballs.json, but the R2
objects only arrive via the train's leg 1 — the CAISSON-85/86 gap (rows exist, bytes 404).
Tag `v2026.07.12` targets `3a03390c` (the version-PR merge's attestation/train-fix successor
per the operator tag-anchoring lock — see `docs/releases/v2026.07.12-checklist.md`).

Three tag attempts; the train's gates stopped each defective ride BEFORE any external write:

1. `efe43438` — readiness NOT READY 6/8: job token lacked `checks: read`/`pull-requests: read`,
   and sot's branch-hygiene counted the detached-HEAD pseudo-entry as drift. Fixed in `39d19bad`.
2. `39d19bad` — readiness 8/8, but leg 1's byte gate killed publish: 5 tarballs.json rows stale
   (PR #222's in-branch fixes edited packed files AFTER version-pr.yml recorded the rows;
   append-only rows are never re-packed). Repaired in `3a03390c` — rows re-recorded from a
   pristine checkout, 46/46 re-verified byte-identical locally. Follow-up: CAISSON-103.
3. `3a03390c` — **train green end-to-end** (run 29213161110): readiness 8/8 → propagate.

Pasted live-verify evidence:

- **leg 1 — registry publish (run 29213178982):** verified 46/46 tarballs byte-identical at the
  tag, then `[publish-and-index] R2 upload complete: 46 uploaded, 0 already present (tag
v2026.07.12)` — **CAISSON-85/86 closed.**
- **leg 2 — mirror sync (run 29213249786):** caisson-sh/caisson-oss HEAD → `d5a37a51 chore:
mirror sync from 3a03390` (history appended, never rewritten).
- **leg 3 — npm mirror publish: SKIPPED** (`RELEASE_NPM_MIRROR_ARMED` unset pre-launch,
  ADR-0329). **leg 4 — site redeploy (run 29213272549):** green inert no-op (Railway leg unarmed).
- **Live probe through the Worker (pre-redeploy):** `kernel-0.4.3.tgz -> 200` (R2 bytes live);
  packument `@caisson/kernel` still advertises `latest: 0.4.2` from the old inlined sidecar —
  by design (advertise-follows-upload).

**Deploy act (b) EXECUTED (operator-approved, same day): registry Worker redeploy** —
`registry/worker/deploy.sh` from post-train `main`, version `c941f5d2-d546-4c68-b680-71c22cd83f4b`,
live at registry.caisson.sh. Pasted verify: packument `@caisson/kernel` → `latest: 0.4.3 |
versions: 0.4.0, 0.4.1, 0.4.2, 0.4.3` · `kernel-0.4.3.tgz -> 200` · clean-env
`bun add @caisson/kernel@latest` → `installed @caisson/kernel@0.4.3 with binaries: caisson-gate`
· two REPAIRED-row packages install integrity-verified: `bun add @caisson/ui@latest
@caisson/cli@latest` → `ui: 0.6.0 cli: 0.5.0` (102 packages, bun verifies packument integrity
against served bytes — the 3a03390c row repair proven at the buyer seam).

## 2026-07-12 — wave-1 reconcile deploy act (a): registry Worker + site + docs from merged main

Operator-approved (session 4, ADR-0328). WHY: the P/Q/R wave merges — the Worker had never
deployed PR 213's `Retry-After` emitters (CAISSON-87) and gained P's tarball-backed
`dist-tags.latest` recompute + the 3 reconciled sidecar rows; caisson-site gained the
CAISSON-84 docs content (licensing.mdx + six per-bundle Install sections); caisson-docs gained
the CAISSON-83 retrieval levers (`ftsWeight`, per-source cap 2) + the new corpus.

- **registry Worker** — `registry/worker/deploy.sh`, version `0d85f715-42bc-4864-a324-71c401112d51`,
  live at registry.caisson.sh. Verify pasted: sustained 8-way load tripped the tarball limiter —
  `429 after ~160 requests` / `HTTP/2 429` / `retry-after: 10` (**CAISSON-87 Retry-After PROVEN
  live**); `kernel-0.4.1.tgz` range-GET `200`; packument `@caisson/kernel` latest `0.4.2` per the
  sidecar. Known pre-train state: grandfathered advertised versions (e.g. `kernel-0.4.2.tgz`,
  `analytics-0.1.0.tgz`) still 404 at the bytes — R2 objects arrive with the first train ride
  (rows exist, objects don't; the recompute guards NEW advertisements).
- **caisson-site** — `railway up -s caisson-site` from main@`d4c8a287`, "Deploy complete". Verify
  pasted: `site /docs/licensing -> 200` · `site /docs/compliance -> 200` · `site / -> 200`.
- **caisson-docs** — `railway up -s caisson-docs` from main@`d4c8a287`, "Deploy complete";
  re-embed on boot. Verify pasted: `{"ok":true,"chunks":506}` (489 → 506 with the new
  licensing/install corpus).

Reverse-chronological. One entry per operator-executed DEPLOY act (never autonomous —
`identity/doctrine.md` DEPLOY line). Each entry: date · services/SHAs · WHY (the consumed-package
diff that forced the redeploy) · live-verify evidence.

**Going-forward convention:** every future DEPLOY act appends a NEW entry at the top of this file
with **pasted** live-verify output (curl/health-check stdout), not a paraphrase. Do not edit a past
entry except to fix a factual error — new truth is a new entry, per the frontmatter-freshness
convention (`outputs/archive/specs/sot-expansion/SPEC.md` §1.4).

**Seed note:** the entries below (2026-07-01 through 2026-07-05) are seeded RETROACTIVELY from
`docs/build-state.md` banners, `docs/state/decisions-and-forks.md`, `docs/ops/launch-runbook.md`,
and `docs/archive/opportunity-backlog.md`. None of the seed entries carry raw pasted terminal output —
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

## 2026-07-11 — EXECUTED: Kickoff-O email wave (ADR-0324) — site + license + admin redeploy from post-#209 `main`

**What deployed:** `caisson-site`, `caisson-license`, `caisson-admin` from `main`@`4036574e`
(`railway up --service <name> --detach` per service from repo root; all three deployments
reached SUCCESS). Operator approval: the Kickoff-O deploy gate — "full redeploy approved"
(one ask, per the kickoff's binding rule).

**WHY:** PR #209 (email wave, CAISSON-92 / ADR-0324) — `reply_to: support@caisson.sh` on all
three Resend call-sites via the new `@caisson/email` `ResendConfig.replyTo` field, plus the
support@ copy pass (refunds/procurement/partners/affiliates/ask-AI; legal pages keep admin@) —
AND the staged `RESEND_FROM="Caisson <no-reply@caisson.sh>"` env flip set `--skip-deploys` on
the same three services (this redeploy is what carried it live; hello@ sender retired). PR #208
(the Playwright-graduation e2e suite, CAISSON-93) rode the same `main` but is test-only — no
runtime diff. Pre-merge operator acts in the same wave: CF Email Routing catch-all on caisson.sh
NEUTRALIZED via API (undeletable singleton → `enabled: false` + action `drop`); the
`admin@gridwork.dev` destination address KEPT (ADR-0324 D3 deviation — shared plumbing for 4
other live zones); `~/.gridwork/caisson.env` flipped (backup `caisson.env.bak-adr0324`). No
Worker republish, no schema widening, no migrations in the diff.

**Live verify (pasted):**

```
RESEND_FROM=Caisson <no-reply@caisson.sh>   (caisson-site)
RESEND_FROM=Caisson <no-reply@caisson.sh>   (caisson-license)
RESEND_FROM=Caisson <no-reply@caisson.sh>   (caisson-admin)
{"ok":true,"indexDigest":"864c83b1a203","indexEntries":46}
site:200 docs:200 marketplace:200 login:200

bun test apps/site/live/prod-routes.live.test.ts
 13 pass
 0 fail
 52 expect() calls
```

**Residuals:** 1Password vault `RESEND_FROM` item value update (op session stale at close —
next authed pass) · Proton send-as alias for support@ (operator act, tracker §1).

## 2026-07-11 — EXECUTED: browser-audit remediation wave — caisson-site redeploy from post-#207 `main`

**What deployed:** `caisson-site` only, from `main`@`bae8ae7b` (`railway up -y --service
caisson-site --ci` from repo root; build + image push + "Deploy complete"). Operator approval:
the ADR-0323 picker pre-approved the redeploy riding this session; re-confirmed in the split-flow
picker ("This session").

**WHY:** PRs #205–#207 merged serially — #205 the full 7-finding browser-audit remediation
(homepage codecard `:global()` id-scope fix, docs `<main id="main-content">` landmark, marketplace
compare 44px target, docs-search focus return, systemic 44px hit areas, GitHub icon aria-label,
WebGL probe-first poster fallback + the review-P2 probe-attrs low-power fix) · #206 the Cookiy
trust/copy wave + architecture-fit diagram · #207 docs-only spec draft (no runtime change). Only
the site app consumed the diff — no other service, no Worker, no schema widening.

**Live verify (pasted):**

```
/ 200 /docs 200 /marketplace 200
```

(`curl -s -o /dev/null -w "/$p %{http_code}" -L https://caisson.sh/...` right after "Deploy
complete"; `/plans` 404 in the same probe was a wrong probe path — the route is
`/marketplace/plans`.) Deterministic replay of the four P1 fixes graduates to Playwright in
Kickoff O (ADR-0323 D2) rather than ad-hoc re-probing here.

## 2026-07-11 — EXECUTED: Kickoff-N cockpit + affiliate + Kickoff-M OSS-launch — full fleet redeploy from post-M `main`

**What deployed:** the 4 Railway app/service deploys from `main`@`cbffbadc` (every deploy SUCCESS) —
`caisson-license`, `caisson-site`, `caisson-admin`, `caisson-support-bot` (`railway up -y --service
<name> --ci` per service from repo root). The registry Worker was **not** redeployed — the index/
ledger republish rides the ADR-0318 W4 gated release train (ADR-0321), and an index-only republish
now widens the CAISSON-85/86 drift. Consumed diff: Kickoff-N (PR #202) admin cockpit six waves +
PostHog federation + affiliate `discount_id` capture (ADR-0316/0320); Kickoff-M (PR #204) OSS-launch
program — append-only mirror history, W4 dormant release train, entity restamp to Caisson Software
LLC (ADR-0321). **No in-branch version cut** — the ~132 changesets stay UNCONSUMED for the
operator-gated CI publish run (ADR-0069/0223/0321).

**Order (locked):** license (its `preDeployCommand` migrates the platform DB) → site + admin +
support-bot in parallel → verify.

**Database (platform Postgres):** `caisson-license` `preDeployCommand`
(`bun apps/site/lib/deploy-migrate.ts`) applied the shared `@caisson/platform-migrations` chain incl.
`0025_order_record_discount` + `0026_affiliate_code`. Verified live: `order_record.discount_id`
PRESENT, `affiliate_code` table PRESENT. Admin mutation surface re-provisioned idempotently
(`provision-admin-mutation-surface.ts admin_app` — new read policies + grants + widened action CHECK).

**Live-verify (pasted `curl -w "%{http_code}"` from the repo box, 2026-07-11):**

```
https://caisson.sh/                          200
https://caisson.sh/docs                       200
https://caisson.sh/llms.txt                   200   # public for AI-indexing (ADR-0303)
https://caisson.sh/dashboard                  302 -> gridworkdev.cloudflareaccess.com/.../login/caisson.sh   # commerce CF-Access gated
https://admin.caisson.sh/ops                  307 -> admin.caisson.sh/login?next=%2Fops   # in-app GitHub OAuth (ADR-0283)
https://admin.caisson.sh/product              307
https://admin.caisson.sh/support              307
https://admin.caisson.sh/architecture         307
https://admin.caisson.sh/intel                307
https://license.caisson.sh/health             200
https://registry.caisson.sh/                  200   # Worker untouched, still live
https://registry.caisson.sh/index.json        200
https://registry.caisson.sh/@caisson/kernel   200
POST https://license.caisson.sh/webhook  (unsigned)       -> 401   # affiliate webhook handler live + fail-closed
POST https://license.caisson.sh/webhook  (bad Paddle-Sig) -> 401
```

**Deferred to Gate 2 (commerce readiness — pre-flip sequence item 8):** the full end-to-end
affiliate sandbox sim (fire a Paddle sandbox `transaction.completed` with `discount_id` + a real
`account_id` → assert `order_record.discount_id` stamped) and minting the REAL affiliate codes both
write production rows and are operator-gated commerce acts — NOT deploy-time smoke. Proven at deploy
time instead: the mint leg is live (prior session, `dsc_01kx6z3yd4bqdhdbbmv5btkf0c`), the webhook
handler is live + signature-gated (401 above), the stamping code is deployed + unit-tested, the DB
column exists.

**Follow-up (not the Railway fleet):** `services/intel/migrations/0002_findings_triage.sql` applies
on the LOCAL intel daemon's next boot (`INTEL_MIGRATE_ON_BOOT`), separate from this redeploy.

---

## 2026-07-10 — EXECUTED: Kickoff-J verification fleet redeploy — OTLP logs live fleet-wide, docs retrieval stack armed + warm

**What deployed:** all 5 Railway services redeployed from `main`@`50910bbb` via `railway up`
(every deploy SUCCESS). The consumed diff: `@caisson/observability` OTLP logs pipeline +
stdout/stderr bridge (minor), the `@caisson/local-store` FTS5 per-token sanitization fix
(`329150a8` — multi-word queries matched zero rows before this), the docs-service embed knobs
(`DOCS_EMBED_PHASE_DEADLINE_MS=1200000`, `healthcheckTimeout` 300→1500), support-bot per-answer
confidence telemetry (`546d5b9f`), and the two main-red fixes that rode along (`4930368d`
support-bot ruff format, `50910bbb` nav-account import cycle).

**Live-verify evidence (session-captured):** site 200 · license 200 · docs health
`{"ok":true,"chunks":489}`. Docs boot log: all 489 chunks embedded, semantic index built
(1024-dim) — the first full-corpus embed (previously ~77/489 under the 3-min deadline). The
embed-cache persistence question RESOLVED: this boot reported **244 hits / 245 misses**
(previously `1 hits/84 misses` every boot) — the `/data` volume cache persists and the next boot
warms near-instantly. Loki now carries per-service streams for `admin`, `service-docs`,
`service-license`, `site` (the `caisson-log-error-burst` rule armed itself, NoData=OK).
Support-bot booted clean with `[telemetry] OTLP export enabled` and the `#ask-ai` listener active.

**Residual (spec-parked):** live hybrid ranking quality is UNVERIFIED — the golden suite runs on
the FTS floor only, and the first live probe ("how do I install a bundle", k=3) ranked
bundle pages above `getting-started.mdx`. The battery-v2 re-run owns the verdict:
`outputs/archive/specs/close-out-triage/SPEC-retrieval-quality-battery-v2.md`.

---

## 2026-07-10 — EXECUTED: Kickoff-I perf/mobile wave deployed — `/` perf 0.57→0.95, all lighthouse floors green

**What deployed:** `caisson-site` redeployed from `main`@`418b26f7` (`railway up -y --service
caisson-site --ci` → `Deploy complete`, image `sha256:635fa583dca8…`). The three merged waves:
ADR-0310 hydration diet (RepoArtifact→CSS, StackBuilder/waitlist defer, shared Reveal observer,
NavAccount idle-mount) · ADR-0311 config (compress:false for CF brotli, theme-init inlined,
header cleanup, NFT excludes) · ADR-0312 mobile-nav accordion (pinned account/cart/CTA block,
three `<details>` sections derived from the desktop panel spec, authored slide-down, the
dead-mobile-search P0 fixed). SHIP-audit fixes rode in `11396d6b` (owned-items fetch restored —
the HttpOnly gate was a double-pay vector; the invalid `::details-content > *` selector that
500'd dev and killed the prod section-slide).

**Live-verify (pasted):** homepage HTML after deploy —

```
$ curl -s https://caisson.sh/ -w "%{http_code}"   → 200
grep -c "theme-init.js"        → 0   (inlined, blocking request gone)
grep -c "challenge-platform"   → 0   (ADR-0313 jsd kill holding)
grep -c "cs-nav-toggle"        → 1   (drawer shell present)
$ curl -sI -H "Accept-Encoding: br" https://caisson.sh/_next/static/chunks/0ghtei8evo-qs.js
content-encoding: br            (CF brotli live — origin no longer pre-gzips)
cache-control: public, max-age=31536000, immutable
```

**Lighthouse evidence (run `29106799203`, dispatch vs the live origin, error-level assertions):
conclusion SUCCESS.** Median desktop scores:

```
https://caisson.sh/            performance=0.95 accessibility=1.00 best-practices=0.96 seo=1.00  TBT 70ms  LCP 1.4s
https://caisson.sh/marketplace performance=0.90 accessibility=0.96 best-practices=0.96 seo=1.00  TBT 30ms  LCP 2.0s
```

The homepage residual red is CLOSED: `/` perf 0.57 → 0.95 (TBT ~1.36s → 70ms; the ADR-0313 jsd
kill + the ADR-0310 diet in combination), best-practices 0.78 → 0.96 with the floor restored to
0.9 and passing. Follow-ups filed: CAISSON-81 (session-hint cookie to land the slice-b signed-out
skip), CAISSON-82 (NFT trace diagnostic in services/license).

## 2026-07-10 — EXECUTED: support-bot listener armed + affiliate delivery proof + Loki rule (Kickoff-J later sitting)

**Support-bot `#ask-ai` listener armed.** The operator toggled the privileged intents in the
Developer Portal (verified over the Discord API: app flags carry MESSAGE_CONTENT-limited +
GUILD_MEMBERS-limited — the enabled form for an unverified bot) and the token was confirmed
rotated-and-consistent (railway `DISCORD_TOKEN` sha12 `ef2344d8e9c3` == local env; `users/@me`
→ HTTP 200). The missing wiring was env: `SUPPORT_CHANNEL_ID` was UNSET, so the channel
listener + the reply-`escalate` handler were dormant (code only requests message_content when
the channel is configured). Set `SUPPORT_CHANNEL_ID=1521528418930524270` (`#ask-ai`) +
`railway redeploy` — fresh container up clean:

```
SUPPORT_CHANNEL_ID=1521528418930524270
Starting Container
[telemetry] OTLP export enabled (service=service-support-bot)
```

Global slash commands verified over the API: `['ask', 'kick', 'ban', 'timeout', 'role-add',
'role-remove', 'grant-role', 'post-roles']`.

**Affiliate attribution delivery proof (sandbox):** pricing-preview with `CAISSONAFF1` on
`pri_01kwwqa266p6smw4yaanxg1n5j` → `subtotal=9900 discount=990 total=8910` (exactly 10%);
`transaction.completed` sim `ntfsim_01kx6822kdnaxzzxma3m8mf1q2` with `discount_id` delivered
to `https://license.caisson.sh/webhook`:

```
event: transaction.completed | status: success
  delivered discount_id: dsc_01kx5b0f9majy4wbgq5cjgdm7y
  delivered subscription_id: None
  delivered txn id: txn_01simaffproof0710aaaaaaaaa
  endpoint response code: 200
  endpoint response body: {"ok":true}
```

**OTLP logs fix landed on main (`0dd715ae`), fleet redeploy PENDING (operator-gated):**
`@caisson/observability` now ships the logs pipeline + stdout/stderr bridge; the
`caisson-log-error-burst` Loki rule is provisioned via the API (201, NoData=OK) and arms
itself when site/admin/license/docs redeploy. The pipeline itself is LIVE-PROVEN against the
real Grafana Cloud gateway — a local probe process booted the new package with the fleet's
OTLP endpoint/headers and its lines landed in Loki:

```
streams: 2
labels: {'detected_level': 'warn', 'service_name': 'caisson-logs-probe'}
  line: [observability] OTel SDK started (service=caisson-logs-probe)
  line: caisson-logs-probe: OTLP logs pipeline live proof 2026-07-10T14:58:40.719Z
```

Loki is no longer zero-streams; per-service streams appear at the fleet redeploy.

---

## 2026-07-10 — EXECUTED: ADR-0313 zone bot-management kill (terraform apply, operator-run)

**Operator-locked at the perf/mobile picker, applied via `terraform apply bm.plan`.** One
in-place update on `cloudflare_bot_management.caisson` (resource imported first):
`fight_mode true→false` · `enable_js true→false` · `ai_bots_protection block→"disabled"`
(the block value was a FOUND misalignment — the zone was blocking AI crawlers against the
ADR-0303 public-for-AI-indexing posture). Live-verify pasted: API readback
`fight_mode=False enable_js=False ai_bots_protection=disabled`; fresh fetches of `/`,
`/marketplace`, `/compare` each `grep -c challenge-platform` → `0` (first probe seconds after
apply still showed 1 — propagation lag, gone on re-fetch). Lighthouse best-practices floor
returned 0.75→0.9 (`db8a3ba4`). Re-arm trigger: real bot pressure at launch (ADR-0313).

## 2026-07-10 — EXECUTED: Kickoff-J tail wave — migration 0024 + abandoned-checkout arm + EULA clause live + alerting floor

**Operator-ordered ("want you to do the full deploy sequence").** Ships the `5ece1d43` wave
(EULA continuity clause · abandoned-checkout email build · CAISSON-71 harness stub) plus the
same-sitting operational floor.

- **Migration 0024** (`checkout_abandonment` + notice tables, RLS): read-only bless first —
  pasted: `bless: 23 already applied, 1 pending: 0024_checkout_abandonment.sql` → apply
  `[deploy-migrate] platform: applied 1, skipped 23` → re-bless `bless: 24 already applied,
0 pending: (none)`. Zero drift.
- **Admin provision re-run** (`provision-admin-mutation-surface.ts admin_app`) — pasted tail:
  `applied: admin mutation provision · applied: role grants to admin_app · roles: admin,
admin_write, app`. Policy verified live: `checkout_abandonment_admin_select|{admin_write}`
  (the review's P2 deploy gate — provision BEFORE arming — honored in order).
- **Paddle SANDBOX discount** `CAISSONCART10` (10%, `dsc_01kx5aw8mgvmxwmdym80tmzyq4`) created
  over the API; `ABANDONED_CHECKOUT_SCHEDULE=30 6 * * *` + `ABANDONED_CHECKOUT_DISCOUNT_CODE/
_LABEL` set on caisson-license (`--skip-deploys`, then redeploy).
- **Railway ×2** from `main@665e7311`: `caisson-site` (EULA clause serves — pasted:
  `Last updated: 10 July 2026` / `Section 365(n)` / `Vendor continuity and self-maintenance`
  all present on https://caisson.sh/legal/eula, 200) + `caisson-license` (`/health` 200,
  preDeploy `[deploy-migrate] platform: applied 0, skipped 24`, issuer on :8080). Scheduler
  ARMED — pasted: `pgboss.schedule` row `checkout.abandonment_tick|30 6 * * *`.
- **Grafana alerting floor over the provisioning API** (glsa_ token): contact point
  `caisson-ops` → Discord #ops-alerts (delivery proven, webhook 204) + root policy + folder +
  3 rules on metrics that EXIST (`caisson-heartbeat-lost` target_info<2 NoData=Alerting ·
  `caisson-5xx-spike` http_server 5xx rate · `caisson-p95-latency` >2s) — all `inactive`
  (evaluating). Four pre-existing console rules DELETED as provably dead (`up`/spanmetrics
  don't exist in this stack; Loki has ZERO streams — see residual).
- **Support-bot public HTTP leg CLOSED**: public domain already existed
  (`caisson-support-bot-production.up.railway.app`, `/health` 200 `{"ok": true}`); the skipped
  TS live leg run — pasted: `1 pass, 0 fail, 7 expect() calls` — the ADR-0224 all-seams matrix
  is now fully closed.
- **RESIDUAL (new finding):** the OTLP **logs** pipeline is dead — Loki label query over 24h
  returns zero streams for every service, so log-based alerting is impossible until the log
  pipeline is fixed; the dead Loki rules were pruned with the rest — re-add a log-error rule
  once streams actually land.

## 2026-07-10 — EXECUTED: Kickoff-I design wave — caisson-site redeploy (ADR-0306–0309 live)

**Operator-ordered ("push to branch and then also deploy the code").** The Kickoff-I merge
(`f620ab15` + J-copy-wave reconcile `a33eeeb9` + changeset-prose fix `5c710fd0`, all CI-green)
landed the design wave on main; this act shipped it to the one service the wave touches.

- **`caisson-site`**: `railway up -y --service caisson-site --ci` from `main@5c710fd0` →
  clean image build (36/36 turbo tasks, 197 static pages, digest `2d788ee0…`) → `Deploy complete`.
  Live probes: `/` 200 with the `hero-field-module__` poster markup served, `/marketplace` 200.
- **Scope**: apps/site + packages/ui only (ui bundles into the site build). No Worker republish
  (registry/index.json untouched), no license/docs/admin/support-bot changes in the wave.
- **ADR-0309 evidence run**: `lighthouse-ci` dispatched post-deploy against `https://caisson.sh`
  (run 29071930623, GitHub-hosted — the fleet image ships no Chrome) — first error-level run,
  and it correctly ran RED. Triage: page load itself excellent (FCP 0.8s · LCP 1.5s · SI 2.6s);
  the perf/TTI/TBT miss was the field's rAF loop rendering on the runner's SwiftShader software
  GL (43s CPU in one chunk) — fixed with a software-renderer bail to the poster in
  `hero-field-scene.ts`; a11y 0.92 was 12 color-alone footnote links (→ `.cs-link` sweep) + a
  prohibited `aria-label` on the Turnstile mount div (→ dropped); best-practices 0.78 is capped
  by Cloudflare's injected `challenge-platform/jsd` script (third-party deprecations + CSP
  issues) — floor set to 0.75 with the cause documented in `lighthouse.yml`. Fixes merged to
  main; the green evidence run rides the next site redeploy. The prod visual-harness delta
  remains the second evidence leg.
- **Second redeploy + rerun (same day, image `c39dd56a…`, run 29072745113):** the fixes
  verified live — TBT 33s→710ms (`/`) / 90ms (`/marketplace`), `/` a11y 0.92→**1.0**,
  `/marketplace` 0.96, TTI/TBT/best-practices/SEO assertions ALL green. ONE residual red:
  `categories:performance` on `/` = 0.57 desktop (marketplace 0.9 passes). Named causes, both
  out-of-wave: Cloudflare's `challenge-platform/jsd` script (676ms bootup — half the TBT; the
  operator lever is killing zone JS-detections, same terraform class as the CAISSON-50 beacon
  kill, at the cost of the bot-management signal) and homepage hydration (684ms — a
  server-componentization diet, a future design-track item). The gate stays error-level and
  red on purpose (ADR-0309: a red run, not a shrug) until one of those levers is pulled.

## 2026-07-10 — EXECUTED: G+H close-out fleet deploy (PR #198 merge → full DEPLOY sequence)

**Operator-ordered ("once all on clean main full dpeloy sequence").** The Kickoff-H merge
(PR #198 squash `2b65cf3d`, ADRs renumbered 0300–0302) + the close-out sweep (PR #199
`6ebb6b3e`) landed both kickoffs on single-branch main; this act activated H's code live.

- **Migration 0023** (`order_record_subscription_link`, ADR-0302): read-only bless first —
  pasted: `bless: 22 already applied, 1 pending: 0023_order_record_subscription_link.sql` →
  apply `[deploy-migrate] platform: applied 1, skipped 22` → re-bless
  `bless: 23 already applied, 0 pending: (none)`. Zero checksum drift (the runner is
  drift-fail-closed; bless ran the real code path with a no-op applier).
- **Admin provision** (`provision-admin-mutation-surface.ts`, incl. H's action-CHECK widening):
  pasted tail — `applied: admin_action_log action CHECK widening · applied: admin mutation
provision · applied: role grants · roles: admin, admin_write, app`.
- **Railway fleet ×5** redeployed from `main@2b65cf3d` (`railway up -y --service <s> --ci
--detach`): probes — `caisson.sh → 200`, `license.caisson.sh/health → 200`,
  `admin.caisson.sh → 200`, docs service healthy per boot log (`serving 489 chunks on :8080`;
  no public domain by design), support-bot proven by the pytest live legs below.
- **Registry Worker** redeployed (version `aed690f2`) with the CAISSON-55 rate-limit bindings —
  dry-run binding table confirms `RATE_LIMIT_CATALOG (300/60s) · RATE_LIMIT_NPM_PACKUMENT
(120/60s) · RATE_LIMIT_TARBALL (60/60s)` live. **Residual:** a 320-request curl burst did NOT
  reproduce a live 429 (CF's `simple` limiter is per-server approximate; escalating the burst
  was declined as prod load-testing). The limiter is fail-open abuse-throttling by design
  (ADR-0112 posture), unit-tested; the live 429 repro stays an open verification item.
- **Ops-alert env armed:** `DISCORD_OPS_WEBHOOK_URL` set on `caisson-license` (verified via
  `railway variables`) + appended to `services/intel/.env`, `caisson-intel` container recreated
  — `Up 5 seconds (healthy)`.
- **Post-deploy live proofs (pasted):** license seam-1 webhook→grant-row PASS with the PUBLIC
  DB URL (the env's `DATABASE_URL` is the Railway-internal hostname — ENOTFOUND from the box;
  export `DATABASE_URL=$DATABASE_PUBLIC_URL` for box-side live runs); support-bot
  `uv run pytest -m live` → `2 passed`. **Known-red leg:** license→bot Discord grant-push
  (`discord-grant.live.test.ts`) fails because `SUPPORT_BOT_URL` still points at H's expired
  Tailscale funnel — resolves with the "expose it" fork (public Railway domain), not a deploy
  regression.
- **Docs-service warm-up residual:** first boot after G's docs expansion hit the 180s embed
  deadline (77/489 chunks semantically embedded, rest FTS-only; cache 1 hit / 84 misses) —
  self-heals over subsequent boots as `/data/embed-cache.json` fills.

## 2026-07-09 — EXECUTED: Better Stack → Discord ops-alerting floor live (Kickoff-H W2 activation)

**Operator-approved in-session ("can you create monitor and like configure etc with this?").**
First deploy of the `caisson-betterstack-adapter` Worker + the external-uptime half of the
alerting floor wired end-to-end via the Better Stack API — then the WHOLE chain proven with a
real incident and torn down.

- **Worker:** `caisson-betterstack-adapter` →
  `https://caisson-betterstack-adapter.broken-wood-97a9.workers.dev` (version `09329f10`), both
  secrets set. First live delivery exposed a launch-blocking workerd incompatibility —
  `redirect: "error"` throws under workerd (only follow/manual supported), so every delivery
  502'd; fixed as `redirect: "manual"` (identical fail-closed semantics), commit `eed1949c`,
  redeployed.
- **Live-verify (pasted):** no-secret POST → `401` (fail-closed); with-secret e2e POST →
  `{"ok":true}` / `deployed-e2e: 200`; real-chain probe — temp 404 monitor → Better Stack
  incident `988503686` `"TEMP chain probe - will be deleted" Started` → embed delivered to
  `#ops-alerts` (operator confirmed visually) → `resolve: 200`, `delete temp monitor: 204`.
- **Better Stack objects:** monitors `4656433 https://caisson.sh up` ·
  `4656434 https://license.caisson.sh/health up`; outgoing webhook `84150`
  (`incident_change`, custom `X-Betterstack-Secret` header).
- **Env SOT:** `DISCORD_OPS_WEBHOOK_URL` + `BETTERSTACK_API_TOKEN` + minted
  `BETTERSTACK_WEBHOOK_SECRET` appended to `~/.gridwork/caisson.env`. Residual:
  `DISCORD_OPS_WEBHOOK_URL` still needs setting on the license/intel Railway services at the
  next fleet DEPLOY so the pg-boss/watcher alerts share the channel; Grafana contact point +
  4 rules (the (a) half of the alerting-floor row) still open.

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
Paddle production remain launch-gate acts per `docs/ops/launch-runbook.md`.

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
launch acts per `docs/ops/launch-runbook.md`.

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
launch acts per `docs/ops/launch-runbook.md`.

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
  `docs/ops/launch-runbook.md` §0).
- Edge deny-set: "a revoke now republishes to the edge and `edgePublish` reports `ok`/`failed`, no
  longer `skipped`" (`docs/ops/launch-runbook.md` §7, "Operator-gated DEPLOY — EXECUTED
  2026-07-05" paragraph).
- Visual-audit ledger reconciled against **fresh 48-route × 4-variant captures**: 82 closed · 125
  open · 14 accepted, 221/221 findings re-verified (`docs/state/decisions-and-forks.md`, "State
  addendum — 2026-07-04/05 execution" section, PR #122).
- Glossary: all 32 ADR-0235 terms live, llms.txt parity confirmed (same addendum section, PR #121).

**Not yet done (flagged, not silently dropped):** `OPENROUTER_API_KEY` / `DISCORD_TOKEN` /
`MIRROR_PUSH_TOKEN` rotations remain operator-owed and block the `caisson-oss` public flip
(`docs/ops/launch-runbook.md` §1.1 sequencing gate; `docs/archive/opportunity-backlog.md` residue
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
  purchase capture, expanded docs corpus re-embedded)" (`docs/archive/opportunity-backlog.md`, snapshot
  paragraph, lines 17–19).
- "the registry Worker redeployed with `registry.caisson.sh` custom domain + TARBALLS + REVOCATIONS
  R2 bindings, the Paddle SANDBOX catalog verified reconciled (4 dropped products archived, 19 prices
  match), and the first live changeset consume run" (same doc, lines 20–23).
- Residue item (1) marked **DONE 2026-07-03/04** — "live `bun install` proof + first live consume
  ran (two pipeline bugs fixed en route, PRs #105/#106)" (`docs/archive/opportunity-backlog.md` line
  26).
- Mac-mini CI runner (org-transfer orphan) resolved same window — "scale set re-registered,
  `native-ext (macos)` green" (`docs/archive/opportunity-backlog.md` line 36, residue item 6).

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
  (`docs/ops/launch-runbook.md` §7 executed-banner).
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
