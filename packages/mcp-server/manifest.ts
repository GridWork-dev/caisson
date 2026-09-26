// Registry manifest: must agree with package.json on id, version, license and the @caisson/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "../registry-schema/src/module-manifest.ts";

export default defineModule({
  id: "@caisson/mcp-server",
  version: pkg.version,
  license: pkg.license,
  dependencies: [
    "@caisson/ai-config",
    "@caisson/ds-manifest",
    "@caisson/kernel",
    "@caisson/registry-schema",
    "@caisson/ui",
  ],
  description:
    "Bearer-authenticated MCP server: timing-safe Bearer verify, catalog reads, and a catalog-checked generate tool (ADR-0008/0004).",
});
