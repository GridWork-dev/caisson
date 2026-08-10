# C03 — delete dead account-entitlement resolver

**Verdict:** VERIFIED DELETE  
**Size:** 414 exact LOC  
**Risk:** medium because the neighboring service issues licenses

## Evidence

- Implementation: `services/license/src/resolve-entitlements.ts:1-56`.
- Dedicated test: `services/license/src/resolve-entitlements.integration.test.ts:1-357`.
- One barrel export: `services/license/src/index.ts:215`.
- No runtime caller exists; only the integration test and barrel export reference
  `resolveAccountEntitlements`.
- The live issuer independently reads purchases/windows and expands entitlements at
  `services/license/src/app.ts:383-421`; `/issue` invokes that path at `app.ts:630-678`.
- Shared expansion truth remains in `@caisson/registry-schema`; ADR-0071 does not require this
  account wrapper.

## Registry/revenue

`@caisson/service-license` is private and absent from ledger/index/tarballs. Deleting this unused
wrapper changes no entitlement, bundle, or grandfathering state.

## Refute attempt

The refuter traced the actual issuance path and ADR-0255 contract. It confirmed that the live path
signs purchased IDs directly and does not import the wrapper. The test itself points to the
registry-schema goldens as canonical expansion coverage.

**Buyer/site notice:** none; preserve live issuer tests.
