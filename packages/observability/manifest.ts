// Registry manifest (ADR-0020). Loaded by @caisson/standards-gate; must agree with package.json on
// id/version/license/dependencies. `kind: "base"` — vendor-neutral observability bootstrap is a base
// primitive every package/service may boot, never an edition (ADR-0003). Open Base: Apache-2.0, oss
// tier (ADR-0094 open-core; @caisson/observability is registered in OPEN_BASE_NAMES, ADR-0117).
//
// Open Base ships free: tier `oss`, no priceCents (ADR-0094 open-core). Dependencies are DOWN-ONLY (ADR-0003).
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest.ts";

export default defineModule({
  id: "@caisson/observability",
  version: pkg.version,
  kind: "base",
  tier: "oss",
  priceCents: null,
  license: pkg.license,
  dependencies: ["@caisson/kernel"],
  description:
    "Vendor-neutral OpenTelemetry bootstrap: env-gated NodeSDK + OTLP/HTTP exporter, HTTP/fetch/pg auto-instrumentation, and conservative span-attribute scrubbing (ADR-0117).",
});
