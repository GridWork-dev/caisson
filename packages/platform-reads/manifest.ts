// Registry manifest (ADR-0020/0021). Loaded by @caisson/standards-gate; must agree with package.json
// on id/version/license/dependencies. `kind: "base"` — @caisson/platform-reads is the shared typed
// read layer over the services/license cross-service tables (entitlement_grant / license_grant),
// composed by apps/site's dashboard reads; not an edition, a compliance primitive, or a per-app
// template.
//
// Commercial under open-core (ADR-0094/0097): platform-reads is NOT among the enumerated open Base
// packages (kernel·auth·tenancy-rls·ui·billing·credits·jobs·email·ai-config·mcp-server·registry-schema·
// observability) — it reads COMMERCIAL services/license table shapes, so it ships
// LicenseRef-Caisson-Commercial and the license<->tier rule forces `paid`. `priceCents` mirrors the
// pre-launch placeholder anchor (4900) the other commercial base packages carry; FINAL pricing is the
// still-open Pricing fork (SD-6/ADR-0012), out of scope here — it need only be a positive integer
// (ADR-0007). Deps are DOWN-ONLY (ADR-0003): @caisson/tenancy-rls (the TenantExecutor type) and
// nothing "up". `golden: null` — the package emits no golden-able artifact (typed reads, not a
// transform); its teeth are the columns-contract test, not a fixture.
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/platform-reads",
  version: pkg.version,
  kind: "base",
  tier: "paid",
  priceCents: 4900,
  license: pkg.license,
  dependencies: ["@caisson/tenancy-rls"],
  golden: null,
  description:
    "Shared typed read-only queries over the services/license cross-service tables (entitlement_grant / license_grant). One typed reader both apps/site and other surfaces import instead of hand-copying raw SQL, so a column rename is a compile/test failure (the columns-contract test) not a silent runtime desync.",
});
