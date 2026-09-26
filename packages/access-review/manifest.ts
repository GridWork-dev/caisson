// Registry manifest: must agree with package.json on id, version, license and the @caisson/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/access-review",
  version: pkg.version,
  license: pkg.license,
  dependencies: ["@caisson/jobs", "@caisson/kernel", "@caisson/tenancy-rls"],
  description:
    "Audit-prep access-review campaigns: a WORM-logged, per-reviewee attested approve/revoke decision record over an imported membership snapshot, opened on a jobs-riding cadence and closed on completion or deadline with any undecided reviewee flagged unresolved, never auto-approved.",
});
