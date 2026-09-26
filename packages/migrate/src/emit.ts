// The file-emit primitive (ADR-0090). A single declaration of "a file to materialize" —
// `{ path, content }` — lives HERE in the base so both the migration assembler (`emitMigrationFileSet`)
// and the `@caisson-sh/cli` generator can share it WITHOUT the base reaching "up" into the cli (ADR-0003).
// The cli re-exports these under its generator-contract names (`GeneratedFile`/`GeneratedFileSet`) so
// its existing importers are unchanged.

/** One file to materialize into a target tree. `path` is a fixed relative literal — never built from
 *  untrusted input (the assembler renumbers migration filenames deterministically). */
export interface EmittedFile {
  readonly path: string;
  readonly content: string;
}

/** An ordered, path-sorted set of files to materialize. */
export type EmittedFileSet = readonly EmittedFile[];
