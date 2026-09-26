// Registry manifest: must agree with package.json on id, version, license and the @caisson/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/ds-manifest",
  version: pkg.version,
  license: pkg.license,
  dependencies: [],
  description:
    "Component-manifest schema, reader, and pure static-check library (contrast, usage validation) shared by the CLI, MCP tools, and build-time generator that make a design-system kit agent-readable.",
});
