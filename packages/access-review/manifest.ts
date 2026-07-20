// Registry manifest (ADR-0020/0021). Loaded by @caisson/standards-gate; must agree with package.json
// on id/version/license/dependencies. `kind: "primitive"` — a shared compliance primitive, not an
// edition or a bundle meta.
//
// SKU posture: a RESERVED catalog id, sold-unpublished (the same posture @caisson/agent-usage and
// @caisson/agent-trajectory shipped at first index). `sellable: false` keeps it out of the
// price-coverage locked-price requirement and off every bundle's `members` pin map; the module is
// registered in the registry so its id exists, but no storefront surface (apps/site's MODULE_PRICES,
// a bundle members map, a docs depth page) may reference it until a later publish gate flips
// `sellable` and adds it to a bundle's composition. Commercial under open-core (this is not among
// the enumerated open Base packages), so it ships LicenseRef-Caisson-Commercial at `paid`;
// `priceCents` carries the same pre-launch placeholder anchor (4900) every not-yet-priced
// commercial primitive carries.
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/access-review",
  version: pkg.version,
  kind: "primitive",
  tier: "paid",
  priceCents: 4900,
  sellable: false,
  license: pkg.license,
  dependencies: ["@caisson/jobs", "@caisson/kernel", "@caisson/tenancy-rls"],
  golden: null,
  description:
    "Audit-prep access-review campaigns: a WORM-logged, per-reviewee attested approve/revoke decision record over an imported membership snapshot, opened on a jobs-riding cadence and closed on completion or deadline with any undecided reviewee flagged unresolved, never auto-approved.",
});
