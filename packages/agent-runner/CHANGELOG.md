# @caisson/agent-runner

## 0.1.5

### Patch Changes

- Updated dependencies [2b65cf3]
- Updated dependencies [8253e76]
  - @caisson/kernel@0.4.3

## 0.1.4

### Patch Changes

- b791198: Documentation and metadata cleanup plus dependency-declaration hygiene: package descriptions, READMEs, changelogs, and source comments no longer carry internal build references, and shared external dependency ranges now resolve through the workspace dependency catalog (published dependency ranges unchanged; the TypeScript devDependency floor moves to ^5.7.3).
- 0af4dbf: Rewrote README, AGENTS, CHANGELOG, package.json descriptions, and inline source comments to
  read as clean, buyer-facing documentation. Removed sibling-repository provenance framing,
  internal build-phase shorthand, and bare specification-id citations that had leaked into
  shipped copy. No runtime behavior changed in any package — documentation and comments only.
- Updated dependencies [b791198]
- Updated dependencies [0af4dbf]
  - @caisson/kernel@0.4.2

## 0.1.3

### Patch Changes

- Updated dependencies [cf66d65]
  - @caisson/kernel@0.4.1

## 0.1.2

### Patch Changes

- Updated dependencies [fb8d966]
  - @caisson/kernel@0.4.0

## 0.1.1

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
- Updated dependencies [e62c88d]
- Updated dependencies [ccf8b10]
- Updated dependencies [549dd4e]
  - @caisson/kernel@0.3.0
