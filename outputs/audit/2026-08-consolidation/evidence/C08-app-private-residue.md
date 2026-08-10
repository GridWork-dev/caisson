# C08 — delete private app residue and dead nav metadata

**Verdict:** VERIFIED DELETE  
**Size:** 87 estimated formatted LOC  
**Risk:** low

## Evidence

Dead/test-only symbols:

- `frameworkById` — `apps/site/lib/attestations.ts:70-72`
- five unused inferred request types — `apps/site/lib/auth-config.ts:107,118,130,139,149`
- `isInCart` and self-test — `apps/site/lib/cart.ts:53-55`, `cart.test.ts:70-73`
- `isPaddleCancelConfigured` and self-test — `apps/site/lib/paddle-cancel.ts:20-22`,
  `paddle-cancel.test.ts:19-24`
- redundant runtime action list/parity test —
  `apps/admin/src/lib/audit-export-payload.ts:7-25`; exhaustive typed record remains at
  `audit-export-payload.ts:170-225`

Dead navigation derivation:

- `MarketingRoute.nav`, five `nav: true` values, and `NAV_ROUTES` at
  `apps/site/lib/routes.ts:37-38,46-51,82-83`
- self-only tests at `apps/site/lib/routes.test.ts:77-88,152`
- real nav uses `BUNDLE_ROUTES` and hand-shaped panels at `apps/site/components/site-nav.tsx:21,35-107`

## Registry/revenue

Private app symbols only. No package, ledger, bundle, route, or checkout behavior changes.

## Refute attempt

The refuter checked dynamic access, route conventions, production imports, and type-only consumers.
It preserved `navLabel`, live inferred input types, and the exhaustive action schema.

**Buyer/site notice:** none expected.
