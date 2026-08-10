# C19 — remove Better Stack's unauthenticated bypass

**Verdict:** VERIFIED DELETE  
**Size:** estimated 15–25 net LOC  
**Risk:** medium; security-improving public-route change

## Evidence

- Environment field/branch: `services/betterstack-adapter/handler.ts:147-158,177-191`.
- Test bypass fixture and explicit bypass test:
  `services/betterstack-adapter/handler.test.ts:142-149,251-270`.
- README/wrangler contract:
  `services/betterstack-adapter/README.md:33-36` and
  `services/betterstack-adapter/wrangler.toml:18-24`.
- Any non-empty value, including `"0"`, authorizes requests.
- Production has both secrets and checked-in 401/200 proof:
  `docs/deploy/STATE.md:1364-1385`.

## Safe shape

Delete `ALLOW_UNAUTHENTICATED`; use a real local fixture secret/header in tests. Keep route-level
authentication tests and both production secret modes.

## Registry/revenue

Private deployed Worker; no registry/bundle state. Requires Worker redeploy and unauthenticated 401
plus authenticated success smoke proof.

## Refute attempt

No deploy config sets the bypass, and only tests/local prose use it. No operational need survived.

**Buyer/site notice:** none; attack surface shrinks.
