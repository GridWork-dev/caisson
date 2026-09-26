// Registry manifest: must agree with package.json on id, version, license and the @caisson-sh/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "../registry-schema/src/module-manifest.ts";

export default defineModule({
  id: "@caisson-sh/mcp-server",
  version: pkg.version,
  license: pkg.license,
  dependencies: [
    "@caisson-sh/ai-config",
    "@caisson-sh/ds-manifest",
    "@caisson-sh/kernel",
    "@caisson-sh/registry-schema",
    "@caisson-sh/ui",
  ],
  description:
    "Bearer-authenticated MCP server: timing-safe Bearer verify, catalog reads, and a catalog-checked generate tool (ADR-0008/0004).",
});
