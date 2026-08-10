# C21 — share exact billing parser primitives

**Verdict:** VERIFIED FOLD-INTO private billing parser helper  
**Size:** estimated 12–14 net LOC  
**Risk:** medium money-adjacent parsing

## Evidence

Byte-identical helpers:

- `readString`: `packages/billing-orchestration/src/stripe-events.ts:36-38`,
  `paddle-events.ts:47-49`, `lemonsqueezy.ts:37-39`, `polar.ts:40-42`
- `readIdString`: `lemonsqueezy.ts:42-46`, `polar.ts:44-48`
- `readInt`: `stripe-events.ts:67-69`, `polar.ts:50-52`

Provider suites already pin event parsing. The helper remains private and exact.

## Safe shape

Fold only these byte-identical primitive readers. Do not share money, account, line-item, event-ID,
or provider payload logic: Paddle decimal-string handling and LemonSqueezy numeric rounding are
intentionally different.

## Registry/revenue

Internal refactor in a published paid package; patch release only. No exports, price, bundle,
entitlement, ledger, or grandfathering change.

## Refute attempt

Broad parser consolidation was refuted by provider-specific money semantics. The three exact helper
classes survived.

**Buyer/site notice:** none; parser outputs must remain byte-equivalent.
