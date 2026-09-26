// Registry manifest: must agree with package.json on id, version, license and the @caisson-sh/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "../registry-schema/src/module-manifest.ts";

export default defineModule({
  id: "@caisson-sh/billing",
  version: pkg.version,
  license: pkg.license,
  dependencies: ["@caisson-sh/kernel"],
  description:
    "Open billing seam: raw-body HMAC webhook signature verify (Stripe/Paddle/LemonSqueezy/Polar) + the BillingProvider port/config contracts + the DomainBillingEvent schema (ADR-0017/0108/0249 G3).",
});
