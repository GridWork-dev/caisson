// Registry manifest: must agree with package.json on id, version, license and the @caisson/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "../registry-schema/src/module-manifest";

export default defineModule({
  id: "@caisson/guardrails",
  version: pkg.version,
  license: pkg.license,
  dependencies: ["@caisson/field-crypto", "@caisson/kernel"],
  description:
    "Content-safety layer: swappable Moderator port (local | provider | custom) + TS-native PII engine (mask / hash / reversible-tokenize via field-crypto) behind a fail-closed input/output guard that throws GuardrailError 422 and emits to the EventSink (ADR-0063).",
});
