---
"@caisson/guardrails": minor
---

Harden the guard against denial-of-service and verdict-swallowing failure modes. Both guard
entries now reject text over the 100k-code-unit work ceiling and unsafe caller-configured
cheap-deny patterns (backreferences, lookarounds, nested quantifiers and multiply-repeated
alternation groups at any nesting depth, more than one unbounded wide-atom quantifier, and
excessive bounded repetition — while open-ended `{n,}` repetition and once-only `?` groups stay
allowed) before any regex or moderator work; a malformed moderator verdict is parsed strictly
and fails closed even under an explicit failOpen policy, which covers outages and timeouts
only; a PII field-crypto context bound to a different tenant than the guard
runtime is rejected before moderation or telemetry; and a synchronously throwing event sink can
no longer replace the block error. PII placeholder restoration is growth-bounded, and guardOutput
on both entries now accepts the same PII-bearing policy shape as the input leg.
