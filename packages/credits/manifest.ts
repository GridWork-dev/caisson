// Registry manifest: must agree with package.json on id, version, license and the @caisson-sh/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "../registry-schema/src/module-manifest.ts";

export default defineModule({
  id: "@caisson-sh/credits",
  version: pkg.version,
  license: pkg.license,
  dependencies: [
    "@caisson-sh/jobs",
    "@caisson-sh/kernel",
    "@caisson-sh/registry-schema",
    "@caisson-sh/tenancy-rls",
  ],
  description:
    "Integer credit wallet + append-only ledger + debit-before-spend gate (402, idempotent) — the metering floor for metered features (ADR-0007/0020).",
});
