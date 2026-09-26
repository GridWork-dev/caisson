// Registry manifest: must agree with package.json on id, version, license and the @caisson-sh/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "../registry-schema/src/module-manifest.ts";

export default defineModule({
  id: "@caisson-sh/observability",
  version: pkg.version,
  license: pkg.license,
  dependencies: ["@caisson-sh/kernel"],
  description:
    "Vendor-neutral OpenTelemetry bootstrap: env-gated NodeSDK + OTLP/HTTP exporter, HTTP/fetch/pg auto-instrumentation, and conservative span-attribute scrubbing.",
});
