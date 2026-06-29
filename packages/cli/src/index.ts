// @caisson/cli — the create-caisson generator (ADR-0004/0048/0049). Wave 0 ships the registry
// allowlist gate + the codegen debit-before-spend seam + the idempotency contract; the full P5
// generation drive (disk write + buyer MCP) plugs in behind these seams.
export {
  type Selection,
  type GeneratedFile,
  type GeneratedFileSet,
  type GeneratorEngine,
  Selection as SelectionSchema,
  validateSelection,
  defaultEngine,
  generate,
} from "./generate.ts";

export { templatesEngine } from "./engine-templates.ts";

export {
  type MeterInput,
  type GenerationDeps,
  type GenerationOutcome,
  meterGeneration,
  runGeneration,
} from "./meter.ts";

export {
  type RecordGenerationInput,
  type GenerationRecordResult,
  GENERATION_SCHEMA_SQL,
  hashFileSet,
  recordGeneration,
} from "./generation-record.ts";

export { parseArgs, runCli } from "./cli.ts";

export {
  type WriterOptions,
  type FileSetWriter,
  WriterOptionsSchema,
  createFileSetWriter,
} from "./writer.ts";

// The migration assembler + runner are owned by the base @caisson/migrate (ADR-0090); the cli imports
// them, never copies them. Re-exported here so the cli's existing public API is unchanged.
export {
  type SelectedPackage,
  type AppliedMigration,
  type MigrationApplier,
  type MigrationRunResult,
  readPackageMigrations,
  assembleSelected,
  emitMigrationFileSet,
  runMigrations,
} from "@caisson/migrate";
