// Registry manifest (ADR-0020). Loaded by @caisson/standards-gate; must agree with package.json on
// id/version/license/dependencies. The commercial billing-orchestration carve (ADR-0249 G3 / ADR-0258):
// the checkout drivers (createStripeBilling/createPaddleBilling/createLemonSqueezyBilling/
// createPolarBilling), the provider->DomainBillingEvent parsers, and the dual-layer webhook idempotency
// live here — the raw-body HMAC signature verifiers + the BillingProvider port/config types + the
// DomainBillingEvent contract stay OPEN in @caisson/billing. `kind: "base"` — a base-tower package
// (mirrors @caisson/local-store's commercial-base shape); DOWN-ONLY deps (ADR-0003). Commercial:
// LicenseRef-Caisson-Commercial, tier `paid`, priceCents 9900 ($99, ADR-0258).
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest.ts";

export default defineModule({
  id: "@caisson/billing-orchestration",
  version: pkg.version,
  kind: "base",
  tier: "paid",
  priceCents: 9900,
  license: pkg.license,
  dependencies: ["@caisson/billing", "@caisson/kernel", "@caisson/tenancy-rls"],
  description:
    "Commercial billing orchestration: Stripe/Paddle/LemonSqueezy/Polar checkout drivers + provider->DomainBillingEvent parsers + dual-layer webhook idempotency (ADR-0249 G3). Signature verification stays open in @caisson/billing.",
});
