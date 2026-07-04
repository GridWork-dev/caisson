// Registry manifest (ADR-0020). Loaded by the monorepo's build-standards check; must agree with package.json on
// id/version/license/dependencies. `kind: "base"` — transactional email is a shared base service;
// all editions that send emails route through this port. Open Base: Apache-2.0, oss tier (ADR-0094 open-core).
//
// Open Base ships free: tier `oss`, no priceCents (ADR-0094 open-core). Dependencies are DOWN-ONLY (ADR-0003).
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest.ts";

export default defineModule({
  id: "@caisson/email",
  version: pkg.version,
  kind: "base",
  tier: "oss",
  priceCents: null,
  license: pkg.license,
  dependencies: ["@caisson/kernel"],
  description:
    "Transactional email port: provider-agnostic Emailer interface with a capture driver for tests and Resend, Postmark, SMTP, and SES drivers for production (ADR-0018).",
});
