# AGENTS — @caisson-sh/agent-runner

Agent-facing authoring/usage contract (ADR-0020 `agents`). What a generation agent or a governed
composition must know to spawn agent runs safely.

## Invariants (do not violate)

- **The child env is built from scratch, always.** `buildEngineEnv()` never spreads `process.env`.
  It forwards ONLY the fixed non-secret passthrough allowlist (`PATH LANG LC_ALL LC_CTYPE TERM TZ
TMPDIR`), an isolated `HOME`/config dir, and the ONE target provider's routing vars + key. Any
  change to this function must keep `leak-guard.test.ts` green — that test is a ship-blocking gate
  (ADR-0186 §4).
- **Credentials are injected, never resolved.** The caller supplies `authKey`/`baseUrl` per spawn;
  this package never reads a dotenv, keychain, or `process.env` for a secret.
- **Provider-agnostic config only (ADR-0186 F2).** `{ binary, baseUrlEnv, authEnv, model }` plus an
  argv template. Never hard-code a vendor endpoint or CLI flag into the runner itself — extend the
  profile, not the core.
- **Whole-token argv templating.** `{task}`/`{model}` substitute only when they are the ENTIRE
  array element; embedded occurrences stay literal, and there is no shell anywhere (`spawn` with an
  argv array).
- **Disk is a boundary.** Every `*.meta.json` read is `.strict()`-validated; a tampered or foreign
  meta fails `status()` closed (`list()` skips it — survey vs. gate).
- **No MCP, no side-effect tools in the sandbox.** The worked `CLAUDE_CLI_PROFILE` passes
  `--strict-mcp-config` with no MCP config and points the CLI at an isolated config dir, so no
  operator-level tool credential can be picked up.

## Composing a run

`createAgentRunner({ runsRoot })` — the registry root is caller-supplied (no home-dir default).
`spawn({ provider, task, worktree, authKey, baseUrl })` launches a detached child whose transcript
streams to `<runsRoot>/<runId>.jsonl` and SURVIVES launcher exit. Then `tail`/`status` to observe,
`kill` to stop, `finalReport` for the structured summary (tool calls, files touched, final result)
parsed from the stream-json transcript. The run's diff lives in the worktree; the CALLER owns all
git/PR side-effects — the child holds none.

## Testing a caller

Point `provider.binary` at a stub CLI (a tiny bun script that prints stream-json lines to stdout —
see `src/__fixtures__/stub-agent.ts`) so a caller's suite exercises the real spawn/registry path
with no network and no real agent. Have the stub dump `process.env` into its transcript to inherit
the leak-guard pattern.

## Out of scope (ADR-0186)

Multi-agent orchestration, hosted run UI, SDK (non-CLI) backends, and cost metering
(`@caisson-sh/ai-meter` wiring) are deferred. Transcript parsing expects the stream-json shape (one
JSON object per line, `assistant`/`result` events); a provider CLI must emit that contract.

## Entry points

Two: `.` is the full node-capable surface; `./browser` is the browser-safe subset (`ProviderConfig`,
`CLAUDE_CLI_PROFILE`, `PASSTHROUGH_KEYS`, `buildEngineEnv` — `src/engine-env.ts`, which is also the
ONE implementation the runner itself imports). A client bundle imports `./browser`, never `.`; a
module joins `./browser` only if its whole graph passes the package's static source-graph walk
(`src/browser-safety.test.ts`), and every `./browser` name must also exist on `.`.
