// Registry manifest: must agree with package.json on id, version, license and the @caisson/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "../registry-schema/src/module-manifest.ts";

export default defineModule({
  id: "@caisson/billing-orchestration",
  version: pkg.version,
  license: pkg.license,
  dependencies: ["@caisson/billing", "@caisson/kernel", "@caisson/tenancy-rls"],
  description:
    "Billing orchestration: Stripe/Paddle/LemonSqueezy/Polar checkout drivers + provider->DomainBillingEvent parsers + dual-layer webhook idempotency (ADR-0249 G3). Signature verification stays open in @caisson/billing.",
});
