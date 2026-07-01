---
slug: stage2-stream-a-obs-admin
stream: A (Observability + Admin control-plane)
charter: ADR-0138 (executes ADR-0117, builds on ADR-0114/0115, reuses ADR-0107)
reserved_adrs: 0140–0149
branch: stream/obs-admin
tags: [infra, observability, auth, security, frontend, ui, external-system]
status: LOCKED (2026-06-30) — forks resolved as ADR-0140..0143; execution started at A1
date: 2026-06-30
---

# SPEC — Stream A: `admin.caisson.sh` control-plane + self-hosted SigNoz observability

## Goal (WHAT + WHY)

Build the operator control-plane app (`apps/admin`, deploys to `admin.caisson.sh`, CF-Access-gated)
and the self-hosted SigNoz observability backend that feeds it, executing the ADR-0138 charter. One
Access-gated cockpit replaces four surfaces the operator toggles between today (SigNoz UI · the
Railway PG · `apps/studio` · the `railway` CLI): it renders fleet ops/telemetry, business admin
(tenants/purchases/entitlements/credits), the absorbed design-system studio, a live architecture
diagram, and the decisions/SOT board. **Local build only — nothing deploys** (Railway provisioning +
DNS cutover is the separate integration/deploy session; every new surface is env-gated inert exactly
like `apps/site` today).

**Why now:** ADR-0117 shipped the OTel instrumentation but it has no destination; ADR-0114/0115 stood
up the Railway app + PG but the operator has no cross-tenant cockpit; `apps/studio` is a naked
standalone app with no gate. This stream lands the missing backend + the one surface that consumes it.

## Scope

**In:** `apps/admin` (new Next-on-Railway app) · absorb `apps/studio` → `apps/admin/app/design/*` +
remove `apps/studio` · the SigNoz Railway stack **as checked-in `infra/` config** · support-bot Python
OTLP + the registry-Worker tail→OTLP bridge · business-admin **read** views · SigNoz-backed ops
widgets · the hybrid architecture diagram · the decisions/SOT + ADR-trail render.

**Out (explicitly DEPLOY-class / other streams):** standing up the live SigNoz stack, setting
`OTEL_EXPORTER_OTLP_ENDPOINT`, the `admin.caisson.sh` DNS + CF-Access application apply, the Railway
service creation (all → integration/deploy session). Business-admin **mutations** are out unless
Fork 2 locks otherwise. The `apps/site` buyer surface, packages, and services logic are other streams'
trees.

**Ground truth (from recon `wf_a3f97716-bff`):**

- `services/docs` (`server.ts:60`) and `services/license` (`server.ts:44`) **already** call
  `initObservability` at the correct boot position — A3's Node leg is done; only support-bot (Python,
  zero OTel today) + the Worker bridge remain.
- There is **no cross-tenant read path** in the repo: `withTenant` (`packages/tenancy-rls/src/rls.ts`)
  scopes to one `account_id` and drops to the FORCE-RLS `app` role. No `tenants`/`purchases`/`accounts`
  table exists — tenant identity lives in better-auth's own `user`/`session`/`account` tables (no typed
  reader today); "purchases" = `entitlement_grant` rows with `source_kind='one_time'`.
- `apps/site` is the exact scaffold template: `output:'standalone'` + Bun multi-stage Dockerfile
  (build context = repo root, `--filter`) + `railway.toml` + `instrumentation.ts` + the
  `readScoped`/`withTenant` DB seam + better-auth wiring (role model is `owner|seat`, **no operator
  role**).
- ADR ceiling is 0138; 0139–0149 free (0139 reserved for the deploy's own topology ADR).

## Tasks

| #   | Task                                                                                                                                                     | Depends     | ADR       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | --------- |
| A1  | `apps/admin` scaffold (clone `apps/site` shape, port 3020) + `git mv apps/studio/src/app/design → apps/admin/app/design/*` + `git rm -r apps/studio`     | —           | exec 0138 |
| A2  | SigNoz self-host stack as checked-in Railway/compose config under `infra/signoz/` (ClickHouse + Keeper + collector + UI + migrator), CF-Access on the UI | —           | **0142**  |
| A3  | support-bot Python OTLP (`opentelemetry-*` deps + `__main__.py` bootstrap, env-gated) + registry-Worker tail→OTLP bridge                                 | A2 (verify) | 0142      |
| A4  | Business-admin **read** views (tenants/purchases/entitlements/credits) over Railway PG — cross-tenant read mechanism per Fork 2                          | A1          | **0141**  |
| A5  | Ops/observability dashboard section — SigNoz `query_range` API client (env-gated, graceful-empty)                                                        | A1, A2      | 0142      |
| A6  | Hybrid live architecture diagram (auto-topology + hand annotations)                                                                                      | A1          | **0143**  |
| A7  | Decisions/SOT board + ADR-trail render (reads `docs/state/decisions-and-forks.md` + `knowledge/decisions/*`)                                             | A1          | exec 0138 |
| —   | admin auth model                                                                                                                                         | gates A1    | **0140**  |

**Build order:** A1 → A2 → A3 → {A4, A5, A6, A7}. A1 gates every view; A2 gates A3-verify + A5.

### A1 — `apps/admin` scaffold + studio absorption

- Clone the `apps/site` deploy/config shape, trimmed: `Dockerfile` (swap `--filter=@caisson/admin`,
  `apps/site`→`apps/admin`, port 3020), `railway.toml` (new `dockerfilePath`, `/healthz`),
  `next.config.ts` (keep `output:'standalone'` + `turbopack.root` + `transpilePackages:["@caisson/ui"]`;
  **drop** fumadocs/MDX), `instrumentation.ts` verbatim (`serviceName:"admin"`), `tsconfig`/`eslint`
  boilerplate, `package.json` (`@caisson/admin`, trimmed deps — `kernel`/`observability`/`tenancy-rls`/
  `auth`/`ui`/`platform-reads` + `culori` for the absorbed studio), `app/healthz/route.ts` verbatim.
- `git mv apps/studio/src/app/design apps/admin/app/design` (foundations/typography/wordmark/signature
  verbatim); `apps/studio/src/app/components/page.tsx` → `apps/admin/app/design/components/page.tsx`;
  `contrast.ts`+test → `apps/admin/lib/`. **Merge** (not copy) studio's `globals.css` (namespace its 51
  chrome classes under a `.design` scope) + `topbar.tsx` (becomes the `/design` sub-nav under admin's
  own shell). Discard studio's root `layout.tsx`/`page.tsx`/`icon.svg`.
- `git rm -r apps/studio`; `bun install` regenerates `bun.lock` (root `apps/*` glob → zero workspace
  edit; turbo/eslint/depcruise all glob → zero CI edit). Docs-sweep of the ~8 stale `apps/studio`
  status refs is a SWEEP-act follow-up, not a blocker.
- **Accept:** `bunx turbo run build lint test --filter=@caisson/admin` green; `apps/studio` gone;
  `bun run gate` green; `/design/*` routes render the kit gallery + design surfaces.

### A2 — SigNoz stack as checked-in Railway config

- Author `infra/signoz/` from the official **Foundry-generated** SigNoz Railway template (current
  v0.130.x; the legacy compose is deprecated) — 5 services: `clickhouse` (+volume), `clickhouse-keeper`
  (+volume), `signoz-otel-collector` (OTLP 4317/4318, TCP proxy), `signoz` UI+query (8080, +volume,
  behind CF Access), one-shot `telemetrystore-migrator`. Collector config (OTLP receiver →
  `clickhousetraces`/`clickhouselogsexporter`), the ClickHouse TTL knob, and the Railway gotchas
  (`<svc>.railway.internal` FQDN DNS, IPv6 `::` bind, per-service volumes) captured as config +
  README. **No live provisioning** — this is IaC the deploy session applies.
- **Accept:** `infra/signoz/` is internally consistent + documented; retention/sampling per Fork 3;
  no live call. (Nothing to run locally — the acceptance is config review + the deploy runbook delta.)

### A3 — support-bot OTLP + Worker bridge

- **support-bot:** add `opentelemetry-sdk` + `opentelemetry-exporter-otlp-proto-http` +
  `opentelemetry-instrumentation-httpx` + `-asyncpg` to `services/support-bot/pyproject.toml`; a
  `telemetry.py` bootstrap initialized at the top of `__main__.py` **before** the httpx/asyncpg clients
  construct, env-gated on `OTEL_EXPORTER_OTLP_ENDPOINT` (dormant no-op when unset, `serviceName:
"service-support-bot"`) — mirrors the Node port's contract (ADR-0117). One `test_telemetry.py`
  self-check: dormant when endpoint unset.
- **Worker bridge:** per Fork 3's observability sub-decision — default = CF-native
  `[observability.traces]`/`[observability.logs]` `destinations` block in `registry/worker/wrangler.toml`
  pointed at a dashboard-registered SigNoz OTLP endpoint (**zero new code**), vs. a hand-rolled
  `tail_consumers` + `tail()` bridge worker (ADR-0138's literal wording, more code). Both need Workers
  Paid + a live endpoint → the wiring is config, inert until deploy.
- **Accept:** `uv run pytest` green in support-bot; `ruff`/`pyright` clean; `wrangler.toml` change
  typed-inert; both legs no-op without an endpoint.

### A4 — business-admin read views

- New typed cross-tenant readers (extend the `@caisson/platform-reads` columns-contract pattern):
  tenants (better-auth `user` table — new reader), purchases + entitlements (`entitlement_grant`),
  credits (`credit_wallet`/`credit_event`), licenses (`license_grant`) — **all cross-tenant** (operator
  view), read-only, mechanism per Fork 2. Views under `apps/admin/app/business/*`, gated by the admin
  auth model (Fork 1). PGlite-double / empty-state when `DATABASE_URL` unset (the `apps/site` pattern).
- **Accept:** views render tenant-scoped rows from a seeded PGlite double in test; cross-tenant read
  path is the Fork-2-locked mechanism; a fail-closed test proves the buyer `app` role still can't read
  cross-tenant.

### A5 — ops widgets · A6 — architecture diagram · A7 — SOT board

- **A5:** a typed SigNoz `POST /api/v5/query_range` client (`SIGNOZ-API-KEY` service-account header),
  env-gated (`SIGNOZ_QUERY_URL`/key), graceful-empty widgets + deep-links to the SigNoz UI. Inert
  without config.
- **A6:** hybrid per Fork 4 — auto-topology (parse `*/railway.toml` + health-probe liveness + optional
  `graphify` structure) rendered as SVG (rec: server-rendered dagre/Mermaid, regenerated at build) +
  a versioned in-repo annotations layer.
- **A7:** render `docs/state/decisions-and-forks.md` (board) + the `knowledge/decisions/ADR-*.md` trail
  (locked/open status) as a read-only admin section — the control-plane is itself an SOT surface.
- **Accept:** each section renders with real inputs where available and a clean empty-state where not;
  all env-gated inert; `bun run gate` + typecheck green.

## Verify (goal-backward)

- `bunx turbo run build lint test --filter=@caisson/admin --concurrency=50%` green; `apps/studio`
  removed with no dangling ref (`grep -rn 'apps/studio\|@caisson/studio' --include='*.ts*' --include='*.json' --include='*.yml'` → docs-only).
- `bun run gate` (standards-gate: license split, no-depend-up, contrast gates) green.
- support-bot `uv run pytest && uv run ruff check && uv run pyright` green.
- Every new surface no-ops without its env (`DATABASE_URL`, `OTEL_EXPORTER_OTLP_ENDPOINT`,
  `SIGNOZ_QUERY_URL`) — CI/local build stays green with nothing provisioned.
- **Security floor (this SPEC is `auth`+`security`-tagged):** the cross-tenant read mechanism (Fork 2)
  ships with a FORCE-RLS fail-closed test; no secret/PII in spans (existing scrub allowlist covers
  `email`/`phone`/tokens); admin surface is operator-only (Fork 1). A security audit fires at SHIP.

## Forks — LOCKED 2026-06-30 (operator picker)

| Fork               | Lock                                                                                                                                                       | ADR      | Note                                      |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------- |
| 1 — admin auth     | **CF-Access alone** — one new Access app for `admin.caisson.sh`, no app-side auth code                                                                     | ADR-0140 | as recommended                            |
| 2 — business-admin | **Read-only cockpit first** — cross-tenant via a read-only `admin` Postgres role (`buildAdminReadPolicySql` + `withAdminRead`), mutation deferred          | ADR-0141 | as recommended                            |
| 3 — SigNoz         | **Single-node Foundry template (5 svcs incl. Keeper), 14-day retention, 100% head sampling**; Worker→SigNoz via CF-native `[observability.*]` destinations | ADR-0142 | **14d chosen over 7d rec**                |
| 4 — diagram        | **Client-side interactive React Flow** — hybrid auto-topology + versioned annotation layer                                                                 | ADR-0143 | **React Flow chosen over server-SVG rec** |

Both divergences from the SPEC recommendation (14d retention · React Flow) are the operator's calls and
are recorded verbatim in the ADRs.

## ADR plan

0140 admin auth · 0141 business-admin read/mutate + cross-tenant mechanism · 0142 SigNoz sizing/
retention/sampling + Worker bridge · 0143 diagram render tech. 0144–0149 reserved (studio-removal
record, support-bot OTLP, spillover). A1/A7 execute the 0138 charter directly (no new ADR).
