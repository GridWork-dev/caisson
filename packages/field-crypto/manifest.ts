// Registry manifest: must agree with package.json on id, version, license and the @caisson/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "../registry-schema/src/module-manifest";

export default defineModule({
  id: "@caisson/field-crypto",
  version: pkg.version,
  license: pkg.license,
  dependencies: ["@caisson/kernel"],
  description:
    "Per-tenant authenticated field encryption (HKDF + AES-256-GCM + versioned envelope + Drizzle column + AWS/GCP/Azure KMS providers with deletion-state receipts).",
});
