// @caisson-sh/migrate — the base migration assembler + runner (ADR-0070/0090). One assembler, one
// runner, one file-emit primitive; `@caisson-sh/cli` and `@caisson-sh/compliance` import from here.
export type { EmittedFile, EmittedFileSet } from "./emit.ts";
export {
  type SelectedPackage,
  readPackageMigrations,
  assembleSelected,
  emitMigrationFileSet,
} from "./assemble.ts";
export {
  type AppliedMigration,
  type MigrationApplier,
  type MigrationRunResult,
  runMigrations,
} from "./runner.ts";
