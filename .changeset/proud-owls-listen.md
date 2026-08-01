---
"@caisson/testing": patch
"@caisson/site": patch
---

The risk-register interactive demo on the site now drives the real risk-register package end to
end — authoring, residual computation, treatment-plan assembly, and the audited override flow all
run the shipped code instead of a hand-maintained copy. The shared test harness gains a
module-graph walker that statically proves a browser entry never reaches a Node builtin, so this
class of demo is verified by source analysis rather than trusting a bundler.
