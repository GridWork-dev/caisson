// Registry manifest (ADR-0020). Loaded by @caisson/standards-gate; must agree with package.json on
// id/version/license/dependencies. `kind: "base"` — billing is a base package providing the Stripe
// provider port, not an edition. Open Base: Apache-2.0, oss tier (ADR-0094 open-core).
//
// Open Base ships free: tier `oss`, no priceCents (ADR-0094 open-core). Dependencies are DOWN-ONLY (ADR-0003).
import { defineModule } from "../../registry/schema/module-manifest.ts";

export default defineModule({
  id: "@caisson/billing",
  version: "0.0.0",
  kind: "base",
  tier: "oss",
  priceCents: null,
  license: "Apache-2.0",
  dependencies: ["@caisson/kernel"],
  description:
    "Stripe billing behind a BillingProvider port: HMAC-raw-body webhook verify + DomainBillingEvent dispatch (ADR-0017).",
});
