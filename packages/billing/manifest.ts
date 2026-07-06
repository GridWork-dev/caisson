// Registry manifest (ADR-0020). Loaded by @caisson/standards-gate; must agree with package.json on
// id/version/license/dependencies. `kind: "base"` — billing is the OPEN base seam: raw-body signature
// verifiers + the BillingProvider port/config contracts + the DomainBillingEvent schema, not an edition.
// The commercial drivers/parsers/idempotency carved to @caisson/billing-orchestration (ADR-0249 G3),
// which dropped this package's only tenancy-rls consumer (idempotency.ts) — deps narrow to kernel.
// Open Base: Apache-2.0, oss tier (ADR-0094 open-core).
//
// Open Base ships free: tier `oss`, no priceCents (ADR-0094 open-core). Dependencies are DOWN-ONLY (ADR-0003).
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest.ts";

export default defineModule({
  id: "@caisson/billing",
  version: pkg.version,
  kind: "base",
  tier: "oss",
  priceCents: null,
  license: pkg.license,
  dependencies: ["@caisson/kernel"],
  description:
    "Open billing seam: raw-body HMAC webhook signature verify (Stripe/Paddle/LemonSqueezy/Polar) + the BillingProvider port/config contracts + the DomainBillingEvent schema (ADR-0017/0108/0249 G3).",
});
