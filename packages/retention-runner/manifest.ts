// Registry manifest: must agree with package.json on id, version, license and the @caisson/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "../registry-schema/src/module-manifest";

export default defineModule({
  id: "@caisson/retention-runner",
  version: pkg.version,
  license: pkg.license,
  dependencies: ["@caisson/jobs", "@caisson/kernel"],
  description:
    "CCPA/GDPR right-to-erasure runner: pluggable multi-store erasure (object-storage purge -> cascade DB delete -> orphan sweep) with per-target error isolation + a reason-tagged audit row (auto_90d/ccpa_request/operator_manual), the recurring sweep scheduled via @caisson/jobs.",
});
