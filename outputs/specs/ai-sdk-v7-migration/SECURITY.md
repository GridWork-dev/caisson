---
phase: ai-sdk-v7-migration
project: caisson
issue: CAISSON-106
reviewer: gw-security-auditor
created: 2026-07-13
verdict: pass
---

# SECURITY — AI SDK v7 migration

## Verdict: PASS

Final governed security re-audit (`019f5ce3-b580-77d3-a62e-14c93da2a2a5`):

> PASS — no security blockers found in the scoped diff from `14aa146f`. No tests run and no files modified.

## Audited seams

- reserve-before-provider and full refunds on non-delivery;
- eager stream settlement, cancellation/abort races, and exact-once reconciliation;
- safe integer token, micro-USD, and credit persistence;
- no-refund-below-reservation behavior for completed language fallbacks;
- deterministic input-only embedding fallback;
- BYOK wallet isolation and provider/model identity;
- ordered pre-v7 system-message compatibility without bypassing the existing prompt-registry or
  per-message guardrail pass.

Earlier adversarial rounds found and drove fixes for pre-delta charging, unsafe derived values,
fallback underbilling, fallback overflow, and resolver refund gaps. This receipt records the clean
post-remediation verdict.
