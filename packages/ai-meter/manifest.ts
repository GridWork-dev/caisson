// Registry manifest (ADR-0020). Loaded by @caisson/standards-gate; must agree with package.json on
// id/version/license/dependencies. `kind: "primitive"` — a shared AI-production primitive (the
// metered-inference money path the AI Production Kit gateway reserves/reconciles through), not a base
// service or an edition. Paid + LicenseRef-Caisson-Commercial (ADR-0050). Standalone pricing is
// locked at $199 by ADR-0129 and enforced through PRICE_AUTHORITY.
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/ai-meter",
  version: pkg.version,
  kind: "primitive",
  tier: "paid",
  priceCents: 19900,
  license: pkg.license,
  dependencies: [
    "@caisson/kernel",
    "@caisson/credits",
    "@caisson/tenancy-rls",
    "@caisson/ui",
  ],
  golden: "src/__golden__",
  description:
    "Metered-inference money path: estimate→reserve→reconcile over the credit ledger + versioned price book + atomic spend window + soft/hard caps + circuit breaker (ADR-0060).",
});
