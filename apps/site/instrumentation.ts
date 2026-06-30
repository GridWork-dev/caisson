// Next instrumentation hook (ADR-0117): wires vendor-neutral OpenTelemetry for the unified app's
// Node runtime, exported via OTLP to a self-hosted SigNoz instance. Env-gated — a no-op when
// `OTEL_EXPORTER_OTLP_ENDPOINT` is unset (dev / CI / no SigNoz configured), the same pattern every
// other provider port in this repo follows (Resend, Paddle, the registry Worker). Next calls
// `register()` once, before any other module in the `nodejs` runtime is evaluated — instrumenting
// HTTP/fetch/Postgres spans requires that ordering, so this MUST stay the first thing the runtime
// does (no other import in this file may itself import `node:http`/`pg`/etc. ahead of `register()`
// running).
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { initObservability } = await import("@caisson/observability");
  initObservability({ serviceName: "site" });
}
