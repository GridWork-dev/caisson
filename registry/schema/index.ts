// Re-export shim (ADR-0097). The registry CONTRACT lives in @caisson/registry-schema; this
// @caisson/registry package keeps the index builder and re-exports the schema so every existing
// relative importer resolves unchanged.
export * from "@caisson/registry-schema";
