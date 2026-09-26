# @caisson-sh/observability

Vendor-neutral OpenTelemetry bootstrap: instrumentation only, pointed at any OTLP-compatible
backend via one endpoint config.

- **Layer:** base

## Install

```bash
bun add @caisson-sh/observability
```

## Use

```ts
import {
  initObservability,
  shutdownObservability,
} from "@caisson-sh/observability";

// Boots a NodeSDK + OTLP/HTTP exporter when OTEL_EXPORTER_OTLP_ENDPOINT is set; a no-op otherwise.
initObservability();
```
