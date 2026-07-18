---
"@caisson/ai-evals": minor
---

New graders score an agent run's tool-call trajectory: whether every tool call stayed on
its declared allowlist, whether the run repeated an already-successful call unnecessarily,
whether every gated tool executed only under an authorized approval, and whether the run
stayed inside its credit budget. All four are fully deterministic — no model call, no
recorded cassette required. A companion dataset, built from real governed-loop runs,
ships with the package and demonstrates each grader catching a genuine violation without
tripping any of the others on the same case.
