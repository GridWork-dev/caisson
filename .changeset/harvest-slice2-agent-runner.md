---
"@caisson/agent-runner": patch
"@caisson/agent-dev": patch
"@caisson/app-agent-dev": patch
"@caisson/registry": patch
---

Add `@caisson/agent-runner` (new, ADR-0186): the sandboxed governed agent runner completing
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
