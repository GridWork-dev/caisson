// Registry manifest: must agree with package.json on id, version, license and the @caisson-sh/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "../registry-schema/src/module-manifest";

export default defineModule({
  id: "@caisson-sh/compliance",
  version: pkg.version,
  license: pkg.license,
  dependencies: [
    "@caisson-sh/audit-worm",
    "@caisson-sh/compliance-core",
    "@caisson-sh/field-crypto",
    "@caisson-sh/frameworks-pack",
    "@caisson-sh/kernel",
    "@caisson-sh/migrate",
    "@caisson-sh/signing-primitive",
    "@caisson-sh/tenancy-rls",
  ],
  description:
    "Compliance evidence kit: seeds a tenant, writes encrypted SEC/HIPAA fields under a tenant-scoped crypto boundary, locks an append-only artifact into WORM with a SHA-256 audit-chain anchor, and emits a deterministic, signed control→evidence pack — own-authored SOC2-TSC + HIPAA control packs, flag-never-guess generation.",
});
