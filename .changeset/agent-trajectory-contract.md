---
"@caisson/agent-trajectory": minor
---

New engine-neutral trajectory package: an append-only, replayable event schema for a governed agent
run (runs, steps, model calls, tool proposals, approvals, tool results, usage, checkpoints). Every
event is validated at a strict boundary with integer token and credit units; sensitive bodies —
prompt text, tool argument and result bodies, checkpoint state — are carried only as a sha256 digest
reference, never inlined. The package ships an append-only store port (idempotent per run sequence,
gaps and rewrites rejected) with an in-memory implementation, a deterministic projection that folds
the same log to a byte-identical view regardless of arrival order, and a first usage adapter that
reads Claude Code transcript lines into estimated usage events. Reserved and unpublished for now:
it joins no bundle and carries no committed price until the runtime loop lands.
