// Registry manifest (ADR-0020). Loaded by @caisson/standards-gate; must agree with package.json on
// id/version/license/dependencies. `kind: "base"` — fail-closed multi-tenant RLS is a foundational
// base primitive that every data-touching edition builds on. Open Base: Apache-2.0, oss tier (ADR-0094 open-core).
//
// Open Base ships free: tier `oss`, no priceCents (ADR-0094 open-core). Dependencies are DOWN-ONLY (ADR-0003).
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest.ts";

export default defineModule({
  id: "@caisson/tenancy-rls",
  version: pkg.version,
  kind: "base",
  tier: "oss",
  priceCents: null,
  license: pkg.license,
  dependencies: ["@caisson/kernel"],
  description:
    "Fail-closed multi-tenant Postgres RLS: FORCE policies + withTenant transaction wrapper + a missing-filter proof (ADR-0005).",
});
