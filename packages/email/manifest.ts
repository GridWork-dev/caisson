// Registry manifest (ADR-0020). Loaded by @caisson/standards-gate; must agree with package.json on
// id/version/license/dependencies. `kind: "base"` — transactional email is a shared base service;
// all editions that send emails route through this port. Open Base: Apache-2.0, oss tier (ADR-0094 open-core).
//
// Open Base ships free: tier `oss`, no priceCents (ADR-0094 open-core). Dependencies are DOWN-ONLY (ADR-0003).
import { defineModule } from "../../registry/schema/module-manifest.ts";

export default defineModule({
  id: "@caisson/email",
  version: "0.0.0",
  kind: "base",
  tier: "oss",
  priceCents: null,
  license: "Apache-2.0",
  dependencies: ["@caisson/kernel"],
  description:
    "Transactional email port: provider-agnostic Emailer interface + capture (test) + Resend (prod) drivers (ADR-0018).",
});
