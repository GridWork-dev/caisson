// Registry manifest (ADR-0020). Loaded by @caisson/standards-gate; must agree with package.json on
// id/version/license/dependencies. `kind: "primitive"` — a shared commercial primitive (like
// field-crypto/audit-worm), not a base package and not an edition. Paid + LicenseRef-Caisson-Commercial
// at $249 (priceCents 24900, ADR-0257). This is the org-module carve (ADR-0257 lock §1.3): WorkOS SSO
// + the narrow owner-gated membership surface + the full 6-export admin-write RLS layer moved out of
// the open @caisson/auth + @caisson/tenancy-rls, which keep buyer session-resolution + tenant
// isolation at their now-narrower open surfaces.
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/org-controls",
  version: pkg.version,
  kind: "primitive",
  tier: "paid",
  priceCents: 24900,
  license: pkg.license,
  dependencies: ["@caisson/auth", "@caisson/kernel", "@caisson/tenancy-rls"],
  description:
    "Org & operator controls: WorkOS SSO sign-in, the owner-gated multi-user membership surface (list/add/manage), and the cross-tenant admin-write RLS layer the operator control plane mutates through.",
});
