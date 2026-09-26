# @caisson/agent-runner

Sandboxed, governed agent runner (ADR-0186) — the Agentic-Dev primitive that turns "scaffolding
for agents" into "run agents safely": spawn a headless AI coding agent CLI as a detached
subprocess in an isolated worktree, stream an auditable `.jsonl` transcript that survives launcher
exit, and parse it into a structured run report (tool calls, files touched, final result). The
security posture — **zero secret leak by construction** — is the product: the child env is built
from scratch (never spread from `process.env`), with a fixed non-secret passthrough allowlist,
only the target provider's key, and an isolated `HOME`/config dir.

## Entry points

- `.` — the full surface, node-capable (detached spawn, the on-disk run registry, transcript
  parsing, trajectory hashing).
- `./browser` — the browser-safe subset: the `ProviderConfig` model, `CLAUDE_CLI_PROFILE`,
  `PASSTHROUGH_KEYS`, and `buildEngineEnv`, so the env scrub can be run and shown inside a client
  bundle. Every name on `./browser` is also on `.`.

## Usage

```ts
import { CLAUDE_CLI_PROFILE, createAgentRunner } from "@caisson/agent-runner";

const runner = createAgentRunner({ runsRoot: "/var/lib/caisson/agent-runs" });

const { runId } = runner.spawn({
  provider: CLAUDE_CLI_PROFILE, // or any { binary, baseUrlEnv, authEnv, model, args }
  task: "implement the retry helper per SPEC.md",
  worktree: "/work/checkouts/feature-retry", // the sandbox; the diff lands here
  authKey: resolveProviderKey(), // injected — the runner never reads env/dotenv itself
  baseUrl: "https://api.anthropic.com",
});

runner.tail(runId); // compact incremental transcript view
runner.status(runId); // running | done | killed | error (+ rolling summary)
runner.finalReport(runId); // { result, toolCalls, filesTouched, ... }
```

Provider-agnostic (ADR-0186 F2): the profile names the CLI binary, the env-var NAMES it reads its
endpoint + key from, the model, and an argv template (`{task}`/`{model}` substitute whole-token
only). `CLAUDE_CLI_PROFILE` is the worked example (headless `claude -p … --output-format
stream-json --strict-mcp-config`).

## Security contract (ship-blocking)

`buildEngineEnv()` is the single place a secret could reach a process that egresses to a model
provider. `src/leak-guard.test.ts` attacks it with a polluted parent env, asserts the exact child
env key set, and proves the contract end-to-end through a real spawn whose stub CLI dumps its own
env into the transcript. Keep it green; do not weaken it (ADR-0186 §4).

License: Apache-2.0.
