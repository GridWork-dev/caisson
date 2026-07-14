// @caisson/ds-manifest — component-manifest schema, typed reader, and pure static-check library
// (contrast, usage validation) shared by the CLI, MCP tools, and build-time generator that make a
// design-system kit agent-readable. Public exports land here as each piece is built.
export {
  componentManifestSchema,
  parseComponentManifest,
  type Component,
  type ComponentManifest,
  type ComponentProp,
} from "./schema.ts";
export {
  checkContrast,
  type ContrastFunctional,
  type ContrastTheme,
  type ContrastThemeKey,
  type ContrastViolation,
  type FunctionalKey,
} from "./contrast.ts";
export { loadBaseManifest } from "./read.ts";
