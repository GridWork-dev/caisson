---
"@caisson/observability": minor
---

The OTel bootstrap now ships logs, not just traces: when an OTLP endpoint is configured,
`initObservability` boots an OTLP/HTTP logs pipeline alongside the trace exporter and bridges
`process.stdout`/`process.stderr` writes into it as log records (stdout=INFO, stderr=WARN), so
every existing log line reaches your logs backend with zero call-site changes. Log bodies pass
the same bearer-token scrub backstop as span attributes before export, `shutdownObservability`
flushes the pipeline and restores the raw stream writes, and a new `logExporter` option provides
the same injectable test seam the trace exporter already had. Dormant behavior is unchanged: no
endpoint configured means nothing starts.
