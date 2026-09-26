// @caisson/cli — the create-caisson generator (ADR-0004/0048). The registry catalog gate, the
// templated engine, the path-safe writer, and the `caisson` companion commands.
export {
  type Selection,
  type GeneratedFile,
  type GeneratedFileSet,
  type GeneratorEngine,
  type RawSelection,
  DEPLOY_TARGETS,
  Selection as SelectionSchema,
  validateSelection,
  generate,
} from "./generate.ts";

export { templatesEngine } from "./engine-templates.ts";

export { parseArgs, runCli } from "./cli.ts";

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

// `caisson run start|approve|deny|status` (ADR-0360 U-2/U-3, S5) — direct DB service (approve/
// deny/status) + the thin MCP client (start) the second bin's `run` subcommand calls into.
export {
  RUN_HELP,
  approveRun,
  denyRun,
  readRunStatus,
  runRunCli,
  runStartClient,
  type DecisionOutcome,
  type RunServiceDeps,
  type RunStartClientInput,
  type RunStatusView,
  type TrajectoryProjectionView,
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
