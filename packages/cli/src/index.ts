// @caisson/cli — the create-caisson generator (ADR-0004/0048/0049). This release ships the registry
// allowlist gate + the codegen debit-before-spend seam + the idempotency contract; the full
// generation drive (disk write + buyer MCP) plugs in behind these seams.
export {
  type Selection,
  type GeneratedFile,
  type GeneratedFileSet,
  type GeneratorEngine,
  type RawSelection,
  DEPLOY_TARGETS,
  Selection as SelectionSchema,
  validateSelection,
  defaultEngine,
  generate,
} from "./generate.ts";

export { templatesEngine } from "./engine-templates.ts";

// The free, Apache-2.0 evaluation-sample engine (ADR-0095 W3) — a SEPARATE allowlist + generation
// path from the paid `Selection`/registry-gated flow above (samples carry no module selection).
export {
  type SampleTemplateId,
  SAMPLE_TEMPLATES,
  assertKnownSample,
  materializeSample,
} from "./sample-templates.ts";

// Generator DEMO MODE (ADR-0274 §1 / Track E1) — the full catalog, commercial modules stubbed +
// watermarked from registry metadata only. Never touches commercial source, never license-gated.
export {
  type DemoModuleSummary,
  DEMO_WATERMARK,
  generateDemo,
} from "./demo.ts";

export {
  type DebitFn,
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

export { parseArgs, parseSampleArgs, runCli } from "./cli.ts";

// The second `caisson` bin's free describe command (ADR-0345) — same data layer as the MCP tools.
export { describeCommand } from "./describe.ts";
// The `caisson doctor` thin client of the buyer MCP check_usage tool (ADR-0345 Fork F).
export {
  collectFiles,
  runDoctorClient,
  runDoctorCli,
  type DoctorClientInput,
} from "./doctor.ts";

export {
  type WriterOptions,
  type FileSetWriter,
  WriterOptionsSchema,
  createFileSetWriter,
} from "./writer.ts";

// `caisson run approve|deny|status` (ADR-0360 U-2/U-3) — direct DB service the second bin's `run`
// subcommand calls into.
export {
  RUN_HELP,
  approveRun,
  denyRun,
  readRunStatus,
  runRunCli,
  type DecisionOutcome,
  type RunServiceDeps,
  type RunStatusView,
} from "./run.ts";

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
