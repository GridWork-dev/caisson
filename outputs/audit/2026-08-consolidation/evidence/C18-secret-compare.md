# C18 — use the kernel secret-comparison primitive

**Verdict:** VERIFIED FOLD-INTO `@caisson/kernel/node`  
**Size:** estimated 20–25 net LOC  
**Risk:** high authentication boundary

## Evidence

- Better Stack duplicate: `services/betterstack-adapter/handler.ts:46-56` (`secretsMatch`).
- Canonical primitive: `packages/kernel/src/crypto.ts:18-27`, exported through
  `packages/kernel/src/node.ts:16-22`.
- Existing canonical tests: `packages/kernel/src/crypto.test.ts:18-23`.
- Better Stack repeats direct timing-safe behavior tests at
  `services/betterstack-adapter/handler.test.ts:128-140`.
- Node-compatible kernel use is already allowed in this Worker build.

The license service has a similar helper at `services/license/src/app.ts:287-298`, but its empty
configured-token guard is semantically required: `safeEqualVariable("", "")` is true. Any extension
of this fold to license must retain `token.length !== 0` before comparison; that optional extension
is not required for this card's acceptance.

## Registry/revenue

Internal service implementation only. No package ID or entitlement change; Better Stack must be
redeployed and auth-smoked after execution.

## Refute attempt

Raw substitution into license was refuted as unsafe. Better Stack's helper is byte-semantics
equivalent to the kernel primitive and survived.

**Buyer/site notice:** none; auth behavior must remain 401/200 identical.
