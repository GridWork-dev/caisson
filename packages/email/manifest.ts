// Registry manifest: must agree with package.json on id, version, license and the @caisson/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "../registry-schema/src/module-manifest.ts";

export default defineModule({
  id: "@caisson/email",
  version: pkg.version,
  license: pkg.license,
  dependencies: ["@caisson/kernel"],
  description:
    "Transactional email port: provider-agnostic Emailer interface with a capture driver for tests and Resend, Postmark, SMTP, and SES drivers for production (ADR-0018).",
});
