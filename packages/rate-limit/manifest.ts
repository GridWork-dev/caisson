// Registry manifest. Loaded by @caisson/standards-gate; must agree with package.json on
// id/version/license/dependencies. `kind: "base"` — this is shared abuse-throttle infrastructure any
// composition may wire in, not an edition or a compliance primitive.
//
// Open Base ships free: tier `oss`, no priceCents. Dependencies are DOWN-ONLY and open-only: this
// package depends on @caisson/kernel (the RateLimitError type) and @caisson/tenancy-rls (the
// fail-closed RLS transaction wrapper the per-account store runs inside), both open Base — never on
// an edition or a commercial service.
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/rate-limit",
  version: pkg.version,
  kind: "base",
  tier: "oss",
  priceCents: null,
  license: pkg.license,
  dependencies: ["@caisson/kernel", "@caisson/tenancy-rls"],
  description:
    "Shared abuse-throttle primitives: an in-memory per-IP token-bucket limiter for unauthenticated surfaces, and a Postgres-backed per-account token-bucket store for authenticated ones.",
});
