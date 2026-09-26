// Registry manifest: must agree with package.json on id, version, license and the @caisson/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/rate-limit",
  version: pkg.version,
  license: pkg.license,
  dependencies: [
    "@caisson/kernel",
    "@caisson/mcp-server",
    "@caisson/tenancy-rls",
  ],
  description:
    "Shared abuse-throttle primitives: an in-memory per-IP token-bucket limiter for unauthenticated surfaces, and a Postgres-backed per-account token-bucket store for authenticated ones.",
});
