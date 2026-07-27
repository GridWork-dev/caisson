# Verification

Verdict: **BLOCKED**

Goal: prove that the newly armed docs-service configuration restored the production Ask AI
journey.

The audit proved the deployed page, Ask AI controls, submission transition, and fail-closed
Turnstile recovery. It could not prove the stated goal because Cloudflare rejected the automated
browser before the handler reached retrieval. Therefore the configuration is deployed but the
behavioral recovery is not yet verified end to end.

Required closure evidence: one ordinary production browser receives a streamed grounded answer
with citations after asking a non-sensitive docs question.
