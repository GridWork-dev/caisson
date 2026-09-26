// Registry manifest: must agree with package.json on id, version, license and the @caisson-sh/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "../registry-schema/src/module-manifest.ts";

export default defineModule({
  id: "@caisson-sh/auth",
  version: pkg.version,
  license: pkg.license,
  dependencies: ["@caisson-sh/kernel", "@caisson-sh/tenancy-rls"],
  description:
    "EdDSA-JWT account tokens (the RLS seam) + session contract backed by better-auth — the auth boundary every kit depends on (ADR-0015).",
});
