# AGENTS — @caisson-sh/tool-exec

Agent-facing authoring/usage contract (ADR-0020 `agents`). What a generation agent or a governed
agent run must know to wire tool execution correctly.

## Invariants (do not violate)

- **Default-deny, always.** A command name not present in `config.allowlist` throws `NotFoundError`
  — never falls through to a raw spawn. An empty/absent allowlist refuses every call.
- **`execFile` arg-arrays only.** Never build a command string, never pass it through a shell,
  never set `shell: true`. Every argument is a separate array element.
- **Validate before spawn.** `argsSchema` runs via `parseStrict` BEFORE `execFn` is called. A
  rejected schema never reaches the process boundary.
- **Output is bounded.** Captured `stdout`/`stderr` are truncated to 64KB each — do not rely on
  this primitive for large-output tooling; it exists for governed, provenance-bearing calls.
- **`reason` is caller intent, not a diagnostic.** It is carried through unmodified onto the
  provenance record; it never affects allowlist or schema decisions.

## Entry points

Two: `.` is the full node-capable surface; `./browser` is the browser-safe subset —
`createToolProposer` (`src/propose.ts`), the default-deny lookup + `parseStrict` validation with no
spawn seam. `createToolExec` delegates to that same module, so there is exactly one implementation
of the gate. A client bundle imports `./browser`, never `.`; a module joins `./browser` only if its
whole graph passes the package's static source-graph walk (`src/browser-safety.test.ts`), and every
`./browser` name must also exist on `.`.

## Choosing an allowlist entry

Each `CommandSpec` binds one logical `name` to exactly one real `command` (an absolute path or a
resolvable executable name) and one `argsSchema: ZodType<string[]>` — the schema's OUTPUT is the
literal argv array passed to `execFile`. Keep the schema as narrow as the command needs (e.g.
`z.tuple([z.literal("status")])` for a fixed subcommand) rather than a permissive `z.array(z.string())`
when the caller doesn't need arbitrary args.

## Testing a caller

Inject `execFn` (and `now`) — never let a caller's test suite spawn a real process. A fake `ExecFn`
records `(command, args)` so a test can assert the exact argv shape without touching the network or
filesystem.

## Out of scope (ADR-0153)

No sandboxing beyond `execFile`'s own process isolation (no container/VM boundary), no output
streaming, no interactive stdin. This package is the governed CALL gate; the agent RUN loop lives in
`@caisson-sh/agent-kernel`.
