---
"@caisson/agent-runner": minor
"@caisson/tool-exec": minor
"@caisson/site": patch
---

Both packages gain a browser-safe `./browser` entry point, so the parts of each that are pure
validation can now be imported inside a client bundle.

`@caisson/agent-runner/browser` carries the provider profile model, `CLAUDE_CLI_PROFILE`,
`PASSTHROUGH_KEYS`, and `buildEngineEnv` — the env scrub, exactly as the runner itself runs it.
`buildEngineEnv`'s first parameter is now typed structurally instead of as Node's process-env type,
so it no longer requires Node's ambient types; `process.env` still satisfies it and existing callers
are unchanged.

`@caisson/tool-exec/browser` carries `createToolProposer`, the default-deny allowlist lookup plus
Zod argv validation with no spawn seam attached — the same gate `createToolExec` runs, now also
available on the main entry, so a UI can show whether a call is permitted without a process
boundary anywhere near it.

The main entry of each package is unchanged and keeps the full Node-capable surface, and every
browser-entry export is also available there. The site's agent-runner and tool-exec interactive
demos now run that real logic instead of a hand-maintained copy.
