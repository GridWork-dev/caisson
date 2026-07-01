---
"@caisson/platform-reads": patch
"@caisson/observability": patch
---

Add `@caisson/platform-reads` (new): shared typed read-only queries over the
services/license cross-service tables (`entitlement_grant` / `license_grant`), so the
buyer dashboard (apps/site) and any other surface reading those tables imports the typed
reader instead of hand-copying raw SQL — a column rename now fails the columns-contract
test instead of silently desyncing at runtime.

Update `@caisson/observability` (ADR-0117): the vendor-neutral OpenTelemetry bootstrap
(env-gated NodeSDK + OTLP/HTTP exporter, HTTP/fetch/pg auto-instrumentation, and
span-attribute scrubbing).
