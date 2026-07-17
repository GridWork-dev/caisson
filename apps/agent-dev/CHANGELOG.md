# @caisson/app-agent-dev

## 0.0.8

### Patch Changes

- @caisson/agent-dev@0.4.2
- @caisson/agent-runner@0.1.6

## 0.0.7

### Patch Changes

- @caisson/agent-dev@0.4.1
- @caisson/agent-runner@0.1.5

## 0.0.6

### Patch Changes

- Internal hygiene wave: the standards gate's locked-price table moved the Compliance bundle to its
  current price and gained rows for the two retired alias packages; the four private reference apps
  and the root manifest now carry an explicit license field; the license service applies the new
  Developer-plan coverage semantics when computing signed license claims.
- Updated dependencies [8c53ca3]
- Updated dependencies
  - @caisson/agent-dev@0.4.0

## 0.0.5

### Patch Changes

- Updated dependencies [b791198]
- Updated dependencies [b791198]
- Updated dependencies [0af4dbf]
  - @caisson/agent-dev@0.3.0
  - @caisson/agent-runner@0.1.4

## 0.0.4

### Patch Changes

- @caisson/agent-dev@0.2.3
- @caisson/agent-runner@0.1.3

## 0.0.3

### Patch Changes

- @caisson/agent-dev@0.2.2
- @caisson/agent-runner@0.1.2

## 0.0.2

### Patch Changes

- ea52d1f: Add `@caisson/agent-runner` (new, ADR-0186): the sandboxed governed agent runner completing
  the Agentic-Dev "run agents safely" story. Spawns a headless agent CLI as a detached subprocess
  in an isolated worktree with a from-scratch scrubbed env — never spreads `process.env`; fixed
  non-secret passthrough allowlist + only the target provider's key + isolated HOME/config dir
  (ship-blocking leak-guard test, unit + end-to-end through a real spawn). Provider-agnostic
  config `{ binary, baseUrlEnv, authEnv, model, args }` with a worked Claude-CLI profile
  (`--strict-mcp-config`, no credentialed MCP); durable `.jsonl` transcript surviving launcher
  exit; run registry `spawn`/`tail`/`status`/`kill`/`list`/`finalReport` with `.strict()`-validated
  meta reads and a structured report (tool calls, files touched, final result) parsed from the
  transcript. Registered in the `apps/agent-dev` demo composition (`runAgentRunnerDemo`), and
  folded into the Agentic-Dev edition's `members` pin map + dependencies (ADR-0186 F5 edition-only
  SKU, the ADR-0178 tool-exec form).
- Updated dependencies [ea52d1f]
  - @caisson/agent-runner@0.1.1
  - @caisson/agent-dev@0.2.1

## 0.0.1

### Patch Changes

- Updated dependencies [22077d1]
- Updated dependencies [a07feb0]
- Updated dependencies [9483a36]
  - @caisson/agent-dev@0.2.0
