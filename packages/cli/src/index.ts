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

export {
  type MeterInput,
  type FileSetWriter,
  type GenerationDeps,
  type GenerationOutcome,
  meterGeneration,
  runGeneration,
} from "./meter.ts";

export { parseArgs, runCli } from "./cli.ts";

export {
  type WriterOptions,
  WriterOptionsSchema,
  createFileSetWriter,
} from "./writer.ts";

export {
  type SelectedPackage,
  type AppliedMigration,
  type MigrationApplier,
  type MigrationRunResult,
  readPackageMigrations,
  assembleSelected,
  emitMigrationFileSet,
  runMigrations,
} from "./migrate/assemble.ts";
