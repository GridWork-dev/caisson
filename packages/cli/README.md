# @caisson-sh/cli — create-caisson

The generator that composes a tailored repo from the versioned module catalog.

## Usage

```
bunx --package @caisson-sh/cli@latest create-caisson my-app --module @caisson-sh/kernel@<version>
```

Pass one `--module <id@version>` per module you want. Run it with no flags in a terminal and it
prompts for the project name and modules instead. Every module installs from the public npm
registry; the generated repo needs no token and no registry configuration.

Under Node, `npx --package @caisson-sh/cli@latest create-caisson ...` runs the same generator.

Run `bunx --package @caisson-sh/cli@latest create-caisson --help` for the full flag list (`--deploy`, `--framework`,
`--dry-run`, `--out`).

## What it ships

- **`generate(index, raw)`** — Zod-`.strict()` selection → validate **every** module id + version
  against the registry catalog (`assertKnownModule` / `assertKnownVersion`) **before any path or
  subprocess** → materialize a deterministic workspace skeleton (golden-fixtured). An unknown id or
  version throws before the engine runs.
- **`createFileSetWriter`** — writes the generated file set to disk atomically (temp dir + rename),
  rejecting any path that would escape the target directory.
- **`create-caisson` CLI** — `<name> [--module <id@version> …]` plus the optional `--deploy` and
  `--framework` overlays; arg-parse, the same catalog gate, then disk materialization via
  `createFileSetWriter`.

## Agent-facing commands (the `caisson` bin)

A second bin, `caisson`, ships alongside `create-caisson` for a coding agent adopting `@caisson-sh/ui`:

```
caisson describe --json           # the full component manifest — no account required
caisson describe <name> --json    # one component's props/variants/tokens (case-insensitive)
caisson doctor [dir] [--json]     # verify usage through your local MCP server
```

`describe` reads the committed base manifest directly (same data as the discovery MCP — see
`@caisson-sh/mcp-server`'s README for the no-auth stdio config). `doctor` is a **thin client**: it
collects your source and calls the MCP server's `check_usage` tool over stdio
(`CAISSON_MCP_COMMAND` / `CAISSON_MCP_ARGS`) — the doctor logic itself runs on your
already-credentialed `@caisson-sh/mcp-server`, not locally.

## Engine seam

The default engine is a deterministic in-repo template copy + typed token/JSON-merge (no network) —
the generated file SET for a fixed selection is the golden fixture. A ts-morph wiring pass can slot
in later behind the same `GeneratorEngine` interface.

## Tests

`bun test packages/cli/src` — `generate.test.ts` (the catalog gate throws before the engine; the
generated file set golden) plus the argv, wizard and writer suites.
