# Kickoff N — admin cockpit buildout + security-scan triage + affiliate flip

**Status: STAGED (operator split 2026-07-10, S1 size-balanced / S4 stage-now-build-next-sittings).**
Branch `kickoff/n-platform-cockpit` · worktree `~/lab/worktrees/caisson/n-platform-cockpit` ·
**merges FIRST** (S3: Kickoff M's version cut waits on this track landing).

**Owns:** the ADR-0316 admin buildout
(`outputs/specs/close-out-triage/SPEC-admin-dashboard-buildout.md`) · security-scan findings
triage (`outputs/specs/close-out-triage/SPEC-security-scan-findings-triage.md` — **fixes the one
red CI leg**, the `deterministic` job) · affiliate production flip
(`outputs/specs/close-out-triage/SPEC-affiliate-production-flip.md`).

## Scope (ordered)

1. **Security-scan triage** — the 8 semgrep JSON-LD findings via the ADR-0315 shared
   `jsonLdScript()` helper refactor, trivy/osv dep CVEs (bump or documented-accept), the SARIF
   artifact-upload defect, Docker digest pins (Renovate app is installed — land the pin config
   per ADR-0315). Exit: `deterministic` green on the branch.
2. **Admin cockpit six waves** (ADR-0316) — W-LOGS + W-COMMERCE first (locked rec), then
   W-PRODUCT (PostHog federation with honest empty states), W-FLEET, W-SUPPORT,
   W-INTEL-TRIAGE (reviewed/dismissed migration + two dual-logged POST routes).
3. **ADR-0316 riders** — `@caisson/platform-reads` adoption in `business-reads.ts`; support-bot
   OTLP log export in the Python telemetry module (closes the Loki gap); `EmptyState` on every
   new view.
4. **Affiliate production flip** — `discount_id` capture in `parsePaddleEvent`→`order_record`,
   per-affiliate code minting, commission/clawback report (money seam — fable on review).

## Tree boundary (vs Kickoff M — binding)

N owns: `apps/admin`, `packages/observability`, `packages/platform-reads`,
`services/support-bot` telemetry module, `services/license`, `packages/billing`,
`.github/workflows/security-scan.yml`, service Dockerfiles, dependency bumps, and the
`apps/site` JSON-LD helper + its call sites. N must NOT touch: `scripts/`,
`.github/workflows/{mirror-sync,publish}.yml`, `.changeset/` consume, `services/docs`
retrieval/eval suites, `apps/site` perf surfaces (`next.config`, middleware/cookie) — all
Kickoff-M ground. New changesets for N's own packages are fine (M's cut folds them in).

## Binding rules

- Admin reads stay read-only server-side (Loki/PostHog/Railway/CF GraphQL); the only new
  mutations are the two intel-triage routes, dual-logged per convention.
- Money paths: integer units, `timingSafeEqual`, never `.strict()` a provider webhook envelope.
- Every dispatch sets `model` explicitly; fable on the affiliate/billing seams only.
- Deploy of the built cockpit/services stays a separate operator DEPLOY act.

## Exit criteria

`deterministic` job green · six cockpit waves + riders built with empty-state safety ·
support-bot lands in Loki (proven post-deploy or via local OTLP check) · affiliate flip proven
against a sandbox sim end-to-end · gates green · sot green · merged to main FIRST.

## DEPLOY block (pending — operator-gated, written at SHIP 2026-07-10)

Everything below is the separate DEPLOY act for the merged Kickoff-N diff. Nothing here runs
autonomously. Ordered; each step idempotent/re-runnable.

### 1. Env (Railway, before redeploy)

- `caisson-admin`: `GRAFANA_LOKI_DATASOURCE_UID=grafanacloud-logs` — uid LIVE-VERIFIED this
  session via the Grafana datasource proxy (a `query_range` through it returned the
  `service-license` stream with the existing `GRAFANA_QUERY_TOKEN`, so the glsa_ token's scope
  already covers Loki — no token change needed).
- `caisson-admin`: `POSTHOG_QUERY_KEY` + `POSTHOG_PROJECT_ID=493539` — STAGED with
  `skipDeploys` if the operator ran the prepared upsert script
  (`scratchpad/railway-posthog-upsert.sh`; the classifier blocks agent-side secret writes);
  otherwise set both by hand. Key LIVE-VERIFIED (HTTP 200 on the Query API, `query:read`
  scope). Vault item `POSTHOG_QUERY_KEY` (credential field) + `POSTHOG_PROJECT_ID`, both
  tagged `caisson-admin`; both appended to `~/.gridwork/caisson.env`.
- `caisson-admin` (fleet overlay, all optional — /architecture renders unchanged without
  them): `RAILWAY_API_TOKEN` (account token, exists in caisson.env — LIVE-VERIFIED against
  backboard GraphQL), `CLOUDFLARE_ANALYTICS_TOKEN` (the existing `CLOUDFLARE_API_TOKEN` value
  suffices — LIVE-VERIFIED: `workersInvocationsAdaptive` for `caisson-registry` returned
  8213 req / 0 err), `CLOUDFLARE_ACCOUNT_ID` (exists), optional
  `CLOUDFLARE_WORKER_SCRIPT_NAME` (defaults `caisson-registry`).
- `caisson-support-bot`: NO new env — OTLP log export reuses `OTEL_EXPORTER_OTLP_ENDPOINT` +
  `OTEL_EXPORTER_OTLP_HEADERS` already set; the Loki stream appears at its next deploy.

### 2. Database (platform Postgres)

- Migrations `0025_order_record_discount_id` + `0026_affiliate_code` apply automatically at
  the first site/admin boot from the new build (instrumentation runs the shared
  `@caisson/platform-migrations` chain). Verify:
  `SELECT column_name FROM information_schema.columns WHERE table_name='order_record' AND column_name='discount_id';`
- Re-run the idempotent provisioning script (now covers the new read tables + the widened
  action CHECK + the existence-guarded support_ticket grant):
  `DATABASE_URL=<public PG url> bun apps/admin/scripts/provision-admin-mutation-surface.ts admin_app`
- Intel: `services/intel/migrations/0002_findings_triage.sql` applies on daemon boot when
  `INTEL_MIGRATE_ON_BOOT` runs with the DDL role (migrate() now runs the 0001+0002 chain);
  if the intel DSN's DB lacks the `admin_write` role, re-apply 0002 against the platform DB
  so the role-guarded grant lands.

### 3. Redeploy + verify

- Redeploy `caisson-admin`, `caisson-site`, `caisson-license`, `caisson-support-bot` from
  merged main (`railway up` per service — merge does NOT deploy).
- /ops shows the Logs panel with live streams; /support shows escalations (or the honest
  42P01/42501 EmptyState until the bot's ensure_schema has run) + bot liveness going green
  after the support-bot redeploy; /product lights up (POSTHOG_QUERY_KEY set) or shows
  not-configured; /architecture nodes decorate with deploy status + Worker counts.
- Intel triage round-trip: mark one finding reviewed on /intel → row drops off the default
  open filter; `admin_action_log` shows `intel_review` + a WORM anchor under `intel`.

### 4. Affiliate end-to-end sim (sandbox)

- Mint leg ALREADY LIVE-PROVEN through the real driver: `dsc_01kx6z3yd4bqdhdbbmv5btkf0c`
  (code `CAISSONPROOF31447`) exists in the Paddle sandbox from this session.
- Post-deploy: fire a Paddle sandbox simulation `transaction.completed` carrying
  `discount_id=dsc_01kx6z3yd4bqdhdbbmv5btkf0c` + a real `custom_data.account_id` →
  verify `order_record.discount_id` stamped, the /business/ledger timeline shows it, and
  /business/affiliates reports the commission row (BigInt floor, flags only — no money moves).
- Then mint the REAL affiliate codes via the /business mint card (10%/3000bps stamped
  per-row at mint, ADR-0319).
