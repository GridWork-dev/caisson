# ADR-0117 — Observability: vendor-neutral OpenTelemetry → self-hosted SigNoz

Status: accepted · 2026-06-30 (operator lock — closes the **observability fork**; the operator asked
for observability explicitly "not Sentry, the best alternative", then chose self-host on the backend
pick.) Append-only; supersede with a later ADR, never edit.

Caisson's platform (the unified Next app, ADR-0114, plus `services/docs`, `services/license`, and the
`support-bot`) is instrumented with **vendor-neutral OpenTelemetry** and exports OTLP to a
**self-hosted SigNoz** instance co-located on Railway (`caisson-prod`). The **instrumentation is the
asset**; the backend is a config swap behind `OTEL_EXPORTER_OTLP_ENDPOINT` — SigNoz can be replaced
(Axiom, HyperDX, Grafana) without re-instrumenting a single service.

## Why

- **OTel-first is the 2026 consensus** (instrument once, point at any backend → backend becomes a
  config change, not a migration) and it **mirrors Caisson's own DNA** — the whole product is
  swappable drivers behind ports. Observability is just one more port.
- **SigNoz** is the OSS all-in-one (traces + logs + metrics + error tracking in one OTLP-native UI,
  Apache-2.0). **Self-host = full data ownership** — no telemetry egress to a third party, which is
  the right posture for a product that _sells compliance_ (the same argument that drove
  Railway-Postgres co-location, ADR-0115). Co-located on Railway = one vendor, one bill, low latency.
- **Not Sentry:** the operator rejected the error-tracking-only framing; this is full-stack
  observability. **Axiom** (managed, huge free tier, native Cloudflare/Next) and **HyperDX/ClickStack**
  (adds session replay) were the managed runners-up — the operator chose self-hosted ownership over a
  managed SaaS sink.

## Scope — what changes, what does NOT

**Build now (autonomous, in-repo):**

- A vendor-neutral OTel bootstrap for the Node surfaces (`@opentelemetry/sdk-node` + auto-instr, or
  `@vercel/otel` for the Next app's `instrumentation.ts`) that **no-ops when `OTEL_EXPORTER_OTLP_*`
  is unset** — identical env-gated-driver pattern to every other provider port (Resend, Paddle, the
  registry Worker). HTTP, fetch, and Postgres spans auto-instrumented; the existing
  `fetchWithTimeout` discipline (ADR-0002) is untouched (OTel wraps `fetch`, does not replace it).
- The Python `support-bot` gets `opentelemetry-instrumentation` over discord.py + httpx, same
  env-gating.
- No secret, no `console.log`, no PII in spans — span attributes are scrubbed on the same allowlist
  the redaction path already enforces.

**Unchanged:** the `cost_events`/event-sink internal telemetry (`@caisson/kernel`,
`@caisson/compliance` `observe.ts`) is product-internal and stays; OTel is _operational_ telemetry for
the operator's own platform, a separate concern.

## Relations

- **New.** Supports ADR-0114 (the Node runtime that can run an OTel SDK) and ADR-0115 (Postgres spans
  over the TCP driver). Complemented by **ADR-0118** (Plausible) — analytics (product usage) and
  observability (system health) are deliberately separate sinks.

## Build-now vs DEPLOY-class

**Buildable now:** all instrumentation, env-gated and inert until an endpoint is set; CI typechecks it.

**DEPLOY-class (operator-gated):** provision the SigNoz service in `caisson-prod` (SigNoz ships a
docker-compose/Railway template — ClickHouse + collector + UI); set `OTEL_EXPORTER_OTLP_ENDPOINT`
(+ any ingestion key) on the app + services; lock the SigNoz UI behind Cloudflare Access (tailnet/
operator-only, like cockpit). Runbook: `docs/state/p6-deploy-runbook.md`.

## Binding

Observability is vendor-neutral OpenTelemetry instrumentation across the platform, exported via OTLP
to a self-hosted SigNoz; the instrumentation is backend-agnostic and the SigNoz endpoint is the only
swap point. Changing the **instrumentation standard** (away from OTel) requires a superseding ADR;
changing the **backend** (SigNoz → Axiom/HyperDX/Grafana) is a config change, not an ADR.
