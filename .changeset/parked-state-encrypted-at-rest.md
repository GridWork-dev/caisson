---
"@caisson/agent-trajectory": minor
---

Parked agent-run bodies (the conversation and tool-call arguments a run saves while it waits for
approval) are now encrypted at rest. Previously this snapshot was stored in the clear; a database
dump or a stray query could read it. Now every parked body is sealed with the same per-tenant
authenticated encryption the rest of the platform's sensitive fields use, and only the run that
saved it can ever decrypt it back. Approving or denying a pending tool call, and resuming a run
afterward, work exactly as before — this only changes what sits in the database in between.
