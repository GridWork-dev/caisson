# ADR-0138 — admin.caisson.sh operator control-plane + full-fleet observability (base-level charter)

Status: accepted · 2026-06-30 (operator picker, base-level forks) · **executes ADR-0117** (OTel →
self-hosted SigNoz) and **builds on ADR-0114/0115** (unified Next-on-Railway + Railway Postgres) ·
relates ADR-0099–0104 (the design-system studio this absorbs) and ADR-0107 (CF-Access gate, the
operator-only access model it reuses). **This is a base-level architecture lock, not a build** — the
implementation is **post-Stage-1** and spec-gated (a dedicated kickoff opens the detail forks). Append-only;
supersede with a later ADR, never edit.

## Context

Caisson's runtime is now a fleet: the unified `caisson-site` app, `services/docs`, `services/support-bot`,
`services/license`, and the `caisson-registry` Cloudflare Worker. Telemetry is emitted (the
`@caisson/observability` OTel package is wired into the app via `apps/site/instrumentation.ts`) but has
**no destination** — ADR-0117 decided self-host SigNoz, and nothing is stood up. Separately, the operator
has no single cockpit: business state lives in the Railway Postgres (ADR-0115), design lives in
`apps/studio`, and there is no live view of what is deployed where. The operator locked a base-level
shape for a dedicated operator control-plane at **`admin.caisson.sh`** that unifies these.

Four base-level forks were resolved in an operator picker (`AskUserQuestion`, 2026-06-30).

## Decision

1. **`admin.caisson.sh` is its own Railway app.** A **new `apps/admin`** is scaffolded fresh; the
   design-system **studio is moved into it** as a section and the **old `apps/studio` is removed** (not
   left as a second app). It deploys as its own Railway service in `caisson-prod`, on `admin.caisson.sh`,
   **CF-Access-gated operator-only** (reuses the ADR-0107 access model, hostname-bound — no public surface).

2. **Scope = full internal control-plane.** `admin.caisson.sh` is the one operator cockpit and is itself a
   SOT surface. It covers: (a) **ops/observability** — fleet health + telemetry dashboards; (b) **business
   admin** — tenants / purchases / entitlements / credits over the Railway PG; (c) **design-system** — the
   absorbed studio; (d) a **live architecture diagram**; (e) a **decisions/SOT surface** (the board + ADR
   trail rendered). Business mutations run under the ADR-0005 fail-closed RLS contract.

3. **Observability backend = self-host SigNoz on Railway** (executes ADR-0117). **Every service reports to
   it** — `caisson-site` (app), `services/docs`, `services/support-bot`, `services/license` via OTLP
   (the `@caisson/observability` port), and the `caisson-registry` Worker via CF-native Workers Logs
   (enabled 2026-06-30) with a tail-worker → OTLP bridge as build detail. The SigNoz stack (ClickHouse +
   otel-collector + UI, UI behind CF Access) plus the **Railway Postgres (ADR-0115)** are the **data
   substrate** for `admin.caisson.sh`: it queries SigNoz's API for summary widgets + deep-links the SigNoz
   UI for full traces, and reads the PG for business state.

4. **Live architecture diagram = hybrid.** Auto-derived service/deploy topology (Railway service graph,
   deploy manifests, health-probe liveness, and `graphify` code structure) **plus** hand-authored
   annotations/legend for intent the topology cannot express. Regenerated on deploy so the "live" half
   stays accurate; the annotation half is versioned in-repo.

## Why

- **One cockpit beats four surfaces.** A single operator toggling between SigNoz, the PG, studio, and
  `railway` CLI is slow; `admin.caisson.sh` collapses ops + business + design + topology into one
  Access-gated app that is also the SOT it describes.
- **Its own app, not a `/admin` route on `caisson-site`.** The operator surface must not share a bundle or
  a blast radius with the public buyer site; a separate Railway service keeps the trust boundary clean and
  lets studio move without dragging buyer code.
- **Self-host SigNoz honors the locked doctrine + the self-host ethos** (ADR-0117; the operator owns the
  telemetry, no vendor egress) — accepted cost: ClickHouse RAM as extra Railway services, mitigated by
  sampling + retention tuning in the build spec.
- **Hybrid diagram is the only honest "live" option** — pure auto-topology is accurate but meaningless
  without intent labels; pure hand-drawn drifts. Auto-topology + annotations stays both current and legible.

## Still open (locked at the initiative SPEC, post-Stage-1 — do NOT pre-bind)

Only the base level is locked here. The dedicated kickoff opens: admin auth detail (CF Access alone vs a
`better-auth` operator role behind it); per-service OTel instrumentation specifics + the Worker tail→OTLP
bridge; the business-admin mutation surface + its RLS/audit posture; SigNoz sizing / retention / sampling;
the diagram render tech; and the studio-removal migration steps (routes, CI, links).

## Confidence + revisit

**MEDIUM-HIGH** — the four base-level picks are operator-locked and consistent with the locked stack
(ADR-0114/0115/0117), but the cost/sizing of self-hosted SigNoz and the business-admin blast radius are
un-validated until the SPEC. Revisit the SigNoz-vs-managed choice with a superseding ADR if the ClickHouse
footprint proves disproportionate for a single-operator box.

## Rejected

- **`/admin` route inside `caisson-site`** — rejected: mixes operator + buyer surfaces and blast radius.
- **Managed OTel cloud (Grafana Cloud / Axiom)** — rejected for now: lower ops burden but egresses telemetry
  to a vendor, against the self-host ethos + ADR-0117. Held as the fallback if SigNoz self-host proves too heavy.
- **Keep `apps/studio` as a separate app** — rejected: the operator chose to fold it into `admin` and remove
  the standalone, so there is one internal surface, not two.
- **Pure auto-generated or pure hand-drawn architecture diagram** — rejected in favor of the hybrid.

## Downstream (build is post-Stage-1 — this ADR is the charter, no code yet)

- Post-Stage-1 kickoff: `apps/admin` scaffold + studio migration + `apps/studio` removal; the SigNoz Railway
  stack (ClickHouse + collector + UI); per-service OTLP wiring; the business-admin views over the Railway PG;
  the hybrid architecture-diagram generator; the SOT/board render.
- The Worker's CF-native Workers Logs are already enabled (`registry/worker/wrangler.toml`, 2026-06-30).
- Sequenced **after** the Stage-1 PR + the Railway/DNS cutover; ordered against the ADR-0133 harvest at kickoff.

Evidence: the operator's base-level picker (2026-06-30: self-host SigNoz · fresh `apps/admin` absorbing +
removing studio · full internal control-plane · hybrid arch diagram); ADR-0117 (observability backend),
ADR-0114/0115 (Railway app + PG substrate), ADR-0107 (CF-Access operator gate).
