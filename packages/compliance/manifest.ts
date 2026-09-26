// Registry manifest: must agree with package.json on id, version, license and the @caisson/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/compliance",
  version: pkg.version,
  license: pkg.license,
  dependencies: [
    "@caisson/audit-worm",
    "@caisson/compliance-core",
    "@caisson/field-crypto",
    "@caisson/frameworks-pack",
    "@caisson/kernel",
    "@caisson/migrate",
    "@caisson/signing-primitive",
    "@caisson/tenancy-rls",
  ],
  description:
    "Compliance evidence kit: seeds a tenant, writes encrypted SEC/HIPAA fields under a tenant-scoped crypto boundary, locks an append-only artifact into WORM with a SHA-256 audit-chain anchor, and emits a deterministic, signed control→evidence pack — own-authored SOC2-TSC + HIPAA control packs, flag-never-guess generation.",
});
