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

The approval-compliance grader now also catches a tool that skipped approval entirely: when
a policy declares a tool name as requiring approval, a call to it that executed with no
approval decision on record is flagged, not just a call that was approved by the wrong
person or executed after being denied.

The regression-baseline gate also gained a safety check: re-baselining (`BLESS=1`) a run
that does not clear its own quality threshold now fails loudly instead of silently
overwriting the committed baseline with a worse score.
