// Registry manifest: must agree with package.json on id, version, license and the @caisson-sh/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "../registry-schema/src/module-manifest";

export default defineModule({
  id: "@caisson-sh/rate-limit",
  version: pkg.version,
  license: pkg.license,
  dependencies: [
    "@caisson-sh/kernel",
    "@caisson-sh/mcp-server",
    "@caisson-sh/tenancy-rls",
  ],
  description:
    "Shared abuse-throttle primitives: an in-memory per-IP token-bucket limiter for unauthenticated surfaces, and a Postgres-backed per-account token-bucket store for authenticated ones.",
});
