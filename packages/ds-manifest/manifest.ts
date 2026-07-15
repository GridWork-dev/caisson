// Registry manifest. Loaded by @caisson/standards-gate; must agree with package.json on
// id/version/license/dependencies. `kind: "base"` — this is a dependency-light data + analysis
// layer (schema, reader, pure static checks) that other packages import, not a standalone
// buyer-facing feature.
//
// Open Base ships free: tier `oss`, no priceCents. Zero @caisson workspace dependencies — the
// token objects and file contents it analyzes are always passed in by the caller, so this package
// never depends "up" on anything, open or commercial.
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/ds-manifest",
  version: pkg.version,
  kind: "base",
  tier: "oss",
  priceCents: null,
  license: pkg.license,
  dependencies: [],
  description:
    "Component-manifest schema, reader, and pure static-check library (contrast, usage validation) shared by the CLI, MCP tools, and build-time generator that make a design-system kit agent-readable.",
});
