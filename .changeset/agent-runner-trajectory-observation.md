---
"@caisson/agent-runner": patch
---

Add optional trajectory observation to the agent runner. When a caller injects a trajectory recorder
(the append-only store port from the new engine-neutral trajectory package), the runner can replay a
finished run's transcript into a trajectory event log: a run-started event, a step per assistant
turn, tool proposals and results paired by tool-use id, a run-finished event, and a final usage event
whose billing status is unsupported because the runner has no validated token contract and therefore
makes no token claims. Sensitive bodies — the opening input, tool argument and result payloads — are
carried only as a sha256 digest reference, never inlined. Recording is strictly opt-in: with no
recorder configured the runner behaves byte-identically to before and stays off the hot path.
