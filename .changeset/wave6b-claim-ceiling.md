---
"@caisson/guardrails": minor
---

Add an evidence-gated claims evaluator for copy review: given a metric, its
baseline, and the improvement threshold/margin a claim requires, `claimTier`
scores the evidence onto a three-rung ladder (unproven / measured /
validated), and `assertClaimAllowed` throws before a marketing or AI-feature
claim ships without evidence strong enough to back it. Works with either
plain ratios or integer money-style values, so a "measurably faster" or
"industry-leading" claim can be checked against real numbers instead of
verified by eyeball.
