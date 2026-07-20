// Registry manifest (ADR-0020/0021). Loaded by @caisson/standards-gate; must agree with package.json
// on id/version/license/dependencies. `kind: "primitive"` — a shared compliance primitive, not an
// edition or a bundle meta.
//
// SKU posture: PUBLISH-ARMED at the 2026-07-20 pricing round (price locked at $199, Compliance
// membership locked) — this cut publishes the package as `sellable: false` substrate so a real
// version exists on the served surface; the post-publish flip sets `sellable`/`priceCents` and
// the bundle members maps pin the version this cut publishes (a members pin must name an
// already-published version). The v2 GitHub-org connector is the named repricing trigger.
// Commercial under open-core (LicenseRef-Caisson-Commercial at `paid`).
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
