# @caisson/observability

Vendor-neutral OpenTelemetry bootstrap (instrumentation only) + a self-hosted SigNoz backend.

- **Layer:** base
- **Seeds (rebuild-clean):** new for the P6-tail
- **Key ADR:** ADR-0117

> **Built (thin)** — real src + tests (env-gated NodeSDK boot + span scrubbing; minimal surface,
> verify before extending). Live per-package status: ../../docs/build-state.md
> Build per `/plan.md`. Pro-private `media-pipeline` contributes patterns only, never code.
