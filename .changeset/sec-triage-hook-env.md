---
"@caisson/agent-kernel": minor
"@caisson/tool-exec": minor
---

Let hook and tool subprocesses run under a caller-supplied environment.

A `CommandHookSpec` (agent-kernel) and a `CommandSpec` allowlist entry (tool-exec) may now set an
optional `env` object. Supplied, it is passed to the spawned process verbatim, never merged with
the parent's environment, so a caller narrowing a child to exactly the vars it needs must include
`PATH` explicitly if the command needs it. Absent, the default is unchanged: the child inherits
the parent's full environment. Flipping that default is a separate, deliberate major version, not
this change.
