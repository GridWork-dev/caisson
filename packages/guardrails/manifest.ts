// Registry manifest (ADR-0020). Loaded by @caisson/standards-gate; must agree with package.json on
// id/version/license/dependencies. `kind: "primitive"` — a shared AI-production primitive (the
// fail-closed content-safety layer the AI Production Kit gateway enforces at its input/output
// points), not a base service or an edition. Paid + LicenseRef-Caisson-Commercial (ADR-0050).
// `priceCents` is a PLACEHOLDER pending the Pricing lock (a positive integer is required to
// validate; the number is not the locked price).
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/guardrails",
  version: pkg.version,
  kind: "primitive",
  tier: "paid",
  priceCents: 4900,
  license: pkg.license,
  dependencies: ["@caisson/field-crypto", "@caisson/kernel"],
  golden: "src/__golden__",
  description:
    "Content-safety layer: swappable Moderator port (local | provider | custom) + TS-native PII engine (mask / hash / reversible-tokenize via field-crypto) behind a fail-closed input/output guard that throws GuardrailError 422 and emits to the EventSink (ADR-0063).",
});
