// Registry manifest (ADR-0020). Loaded by the monorepo's build-standards check; must agree with
// package.json on id/version/license/dependencies. `kind: "base"` — server-side analytics capture is
// a shared base port (the same shape as email/jobs); any surface that records events routes through it.
// Open Base: Apache-2.0, oss tier (ADR-0094 open-core) — a vendor-neutral port with $0-secret drivers,
// no commercial IP. Not sold à-la-carte, so it never enters the sellable registry index.
//
// Open Base ships free: tier `oss`, no priceCents (ADR-0094 open-core). Dependencies are DOWN-ONLY (ADR-0003).
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest.ts";

export default defineModule({
  id: "@caisson/analytics",
  version: pkg.version,
  kind: "base",
  tier: "oss",
  priceCents: null,
  license: pkg.license,
  dependencies: ["@caisson/kernel"],
  description:
    "Provider-agnostic server-side analytics port: a vendor-neutral AnalyticsProvider interface with a capture driver for tests and Plausible, PostHog, and GA4 drivers for production; fail-open by design.",
});
