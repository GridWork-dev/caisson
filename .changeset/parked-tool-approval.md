---
"@caisson/agent-trajectory": minor
"@caisson/tool-exec": minor
"@caisson/ai-kit": minor
"@caisson/cli": minor
---

Agent-runtime tool calls can now require human approval before they execute. A tool marked
`approvalRequired` parks the run instead of running it: the proposal is recorded, the run's
state is saved durably, and the run process can exit cleanly while the request waits. An
operator reviews the pending call and approves or denies it — from the `caisson` CLI or any
service with database access — and approval resumes the run from exactly where it left off,
picks up the approved call, and continues to completion. Denial finishes the run without ever
executing the tool. A durable run-state store and a durable trajectory log back this: approving
the same call twice is a no-op, two concurrent resume attempts can never both execute the tool,
and everything is tenant-isolated. The underlying tool-execution primitive gained a matching
two-phase mode — validate and park a call, then execute it later once it's approved — for
callers who want the same propose/execute split without the full run loop.
