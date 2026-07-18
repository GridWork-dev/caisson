---
"@caisson/agent-trajectory": minor
---

Agent runs now project a scored-consumable tool-call list. `projectToolCalls(events)` folds
a run's tool proposals, approvals, denials, and results into one entry per call — its name,
its argument digest, who approved or denied it and how, and whether it succeeded — ordered
by proposal order and stable under out-of-order event delivery, exactly like the existing
run projection. This is a new, separate projection: the existing run projection and its
shape are unchanged.
