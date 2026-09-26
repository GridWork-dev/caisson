# @caisson-sh/observability — agent usage note

Vendor-neutral OpenTelemetry bootstrap for a service's Node surfaces. The instrumentation is
the asset; the backend is a config swap behind `OTEL_EXPORTER_OTLP_ENDPOINT` — any
OTLP-compatible sink works.

## Key surface

- `initObservability(opts?)` — boots a `NodeSDK` with an OTLP/HTTP trace exporter, auto-instrumenting
  HTTP + `fetch` + `pg`. **No-ops** (returns `{ active: false }`, starts nothing) when neither
  `opts.endpoint` nor `OTEL_EXPORTER_OTLP_ENDPOINT` is set — the identical env-gated-driver pattern
  every Caisson provider port follows.
- `shutdownObservability()` — flushes + tears down the active SDK; a no-op when dormant.
- Call `initObservability()` at the very TOP of a service's boot entrypoint, before anything else
  (`Bun.serve`, route construction) — instrumentation must be wired before the modules it patches
  (`node:http`, `pg`) are first required.
- `withRequestSpan(handler, routeTemplate?)` — wraps a Bun `(req) => Promise<Response>` handler so
  every call emits one server span (method/route/status attributes, exceptions recorded). Use this
  for Bun-native handlers (`Bun.serve`, `Bun.fetch`), which bypass the `node:http` auto-instrumentation
  above and would otherwise emit zero spans. `scrubPath(path)` low-cardinality-scrubs a raw request
  path (UUIDs/emails/numeric ids/long tokens → `:id`) when no `routeTemplate` is supplied.
- Span attributes are scrubbed on a conservative deny-list (secrets, `Authorization`, cookies,
  tokens, `*-key` headers, and a small PII key set) before they ever leave the process —
  `scrubAttributes` / `isSensitiveAttributeKey` (the raw `SENSITIVE_ATTRIBUTE_KEY` regex is deprecated for direct use) / the `ScrubbingSpanProcessor` decorator in
  `src/scrub.ts`. An exact OTel semconv attribute name (read from `@opentelemetry/semantic-conventions/incubating`, never hand-copied) skips the credential terms only — `gen_ai.usage.*_tokens`, `session.id` survive; `user.email` / `user.full_name` still redact. This is independent of, and narrower-scoped than, `@caisson-sh/kernel`'s
  `redactEvent` (that one redacts the operational-telemetry `OpsEvent` envelope; this one redacts
  OTel span attributes — two different telemetry paths that never share a write path).

## Scope

Bootstrap + side-effect wiring only — no business logic. Do not add product-level span helpers,
metrics, or logging APIs here; that is a future seam if/when the platform needs custom spans beyond
auto-instrumentation. `fetchWithTimeout` discipline is untouched: the OTLP exporter manages its own
HTTP transport (a vendor SDK concern), not a `fetch` call this package authors directly.
