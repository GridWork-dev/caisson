# @caisson/observability — agent usage note

Vendor-neutral OpenTelemetry bootstrap for the platform's Node surfaces (ADR-0117). The
instrumentation is the asset; the backend (self-hosted SigNoz, swappable to Axiom/HyperDX/Grafana)
is a config swap behind `OTEL_EXPORTER_OTLP_ENDPOINT`.

## Key surface

- `initObservability(opts?)` — boots a `NodeSDK` with an OTLP/HTTP trace exporter, auto-instrumenting
  HTTP + `fetch` + `pg`. **No-ops** (returns `{ active: false }`, starts nothing) when neither
  `opts.endpoint` nor `OTEL_EXPORTER_OTLP_ENDPOINT` is set — the identical env-gated-driver pattern
  every Caisson provider port follows (Resend, the registry Worker, the docs-service embedder).
- `shutdownObservability()` — flushes + tears down the active SDK; a no-op when dormant.
- Call `initObservability()` at the very TOP of a service's boot entrypoint, before anything else
  (`Bun.serve`, route construction) — instrumentation must be wired before the modules it patches
  (`node:http`, `pg`) are first required.
- Span attributes are scrubbed on a conservative deny-list (secrets, `Authorization`, cookies,
  tokens, `*-key` headers, and a small PII key set) before they ever leave the process — see
  `scrubAttributes` in `src/scrub.ts`. This is independent of, and narrower-scoped than,
  `@caisson/kernel`'s `redactEvent` (that one redacts the `cost_events`/ops-event envelope; this one
  redacts OTel span attributes — two different telemetry paths, ADR-0117 Relations).

## Scope

Bootstrap + side-effect wiring only — no business logic. Do not add product-level span helpers,
metrics, or logging APIs here; that is a future seam if/when the platform needs custom spans beyond
auto-instrumentation. `fetchWithTimeout` discipline is untouched: the OTLP exporter manages its own
HTTP transport (a vendor SDK concern), not a `fetch` call this package authors directly.
