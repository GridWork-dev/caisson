# ADR-0185 — Bun OTel request-span instrumentation: manual spans

**Status:** accepted · 2026-07-01 (edition seam-completion, operator-locked) · relates **ADR-0117** /
**ADR-0140–0143** (observability, OTel → backend), **ADR-0177** (Grafana sole-OTLP cutover), the repo
Bun-runtime invariant (ADR-0002). Append-only; supersede with a later ADR, never edit. **Tags:**
`observability`, `infra`.

## Context

Observability exports OTLP to the sole sink (Grafana Cloud per ADR-0177, over the ADR-0117 OTLP-export seam).
OpenTelemetry's zero-code auto-instrumentation (`@opentelemetry/auto-instrumentations-node`) hooks Node's
`node:http` / `undici` / `pg` internals — but Caisson services run on **Bun**, whose `Bun.serve` / Bun-`fetch`
/ Bun-SQL bypass those hooks, so auto-instrumentation emits **no request spans** on Bun handlers. This gap
surfaced during the 2026-07-01 Grafana cutover: the OTLP pipeline is live, but per-request server spans (the
backbone of latency/error traces) aren't emitted from the Bun HTTP surfaces without a decision.

## Decision

**Manual request spans at the handler boundary.** A small (~30-LOC) `withSpan(name, fn)` wrapper / single
middleware around the Bun route handlers, using the OTel SDK's tracer API directly — works on Bun today,
zero new dependency, exports server spans to the existing OTLP sink.

**Named ceiling:** spans exist only where we wrap; no automatic child-spans for DB / fetch. Add child spans
explicitly where a given trace needs them. Bun-native auto-instrumentation, if/when a maintained one lands,
is the future upgrade path (revisit then) — running the traced tier on Node for free auto-tracing is rejected
(forks the runtime, violates ADR-0002).

## Consequences

- Adds a `withSpan` / middleware helper in the shared server surface; server spans cover the deliberately
  wrapped HTTP entrypoints (the small set of handlers), emitted to the ADR-0177 Grafana OTLP sink.
- Closes the Bun request-span gap found at the Grafana cutover — `node:http`/`undici`/`pg`
  auto-instrumentation is bypassed by Bun, so only manual spans export.
- No new dependency, no runtime fork. Upgrade path (Option: Bun auto-instrumentation) is named for when
  Bun's OTel story matures.

<!-- ponytail: manual spans at handler boundary; swap to Bun auto-instrumentation if/when it exists. -->
