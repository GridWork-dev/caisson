// Next instrumentation hook (ADR-0117/0138): wires vendor-neutral OpenTelemetry for the admin
// control-plane's Node runtime, exported via OTLP to the self-hosted SigNoz instance. Env-gated —
// a no-op when `OTEL_EXPORTER_OTLP_ENDPOINT` is unset (dev / CI / no SigNoz configured), the same
// pattern every provider port in this repo follows. Next calls `register()` once, before any other
// module in the `nodejs` runtime is evaluated — instrumenting HTTP/fetch/Postgres spans requires
// that ordering, so this MUST stay the first thing the runtime does.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { initObservability } = await import("@caisson/observability");
  initObservability({ serviceName: "admin" });
}
