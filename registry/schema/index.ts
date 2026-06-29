// Re-export shim (ADR-0097). The registry CONTRACT moved to the open @caisson/registry-schema
// (Apache-2.0); this commercial @caisson/registry package keeps the SERVICE (worker + index-builder
// + publish) and re-exports the schema so every existing relative importer resolves unchanged.
export * from "@caisson/registry-schema";
