// Registry manifest (ADR-0020). Loaded by @caisson/standards-gate; must agree with package.json on
// id/version/license/dependencies. `kind: "base"` — the background-job queue port is a shared base
// primitive; billing and credit side-effects are enqueued through it. Open Base: Apache-2.0, oss tier (ADR-0094 open-core).
//
// Open Base ships free: tier `oss`, no priceCents (ADR-0094 open-core). Dependencies are DOWN-ONLY (ADR-0003).
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest.ts";

export default defineModule({
  id: "@caisson/jobs",
  version: pkg.version,
  kind: "base",
  tier: "oss",
  priceCents: null,
  license: pkg.license,
  dependencies: ["@caisson/kernel", "@caisson/tenancy-rls"],
  description:
    "Provider-agnostic background-job queue port + in-memory test driver; Trigger.dev prod driver — billing and credit side-effects enqueued, never inline.",
});
