# C07 — consolidate scheduler test fixtures only

**Verdict:** VERIFIED-NARROW FOLD  
**Size:** estimated 80–90 net LOC  
**Risk:** low if production schedulers remain separate

## Evidence

Three live scheduler surfaces total 601 source + 1,102 test LOC:

- `services/license/src/abandoned-checkout-scheduler.ts` and test
- `services/license/src/credit-expiry-scheduler.ts` and test
- `services/license/src/anchoring-scheduler.ts` and test

Their tests repeat roughly 130 lines of fake `JobQueue`/factory machinery. Production callers are
distinct and live at `services/license/src/deploy.ts:93-180`.

## Safe shape

Fold only fake queue factories and common scheduler assertions into a private service test helper.
Keep all three production modules, task construction, cron rules, account enumerators, notification
behavior, and anchoring hourly-floor checks separate.

## Registry/revenue

Private service tests only; no registry or bundle effect. The live abandoned-checkout and credit
schedulers remain armed; anchoring remains intentionally inert per deploy state.

## Refute attempt

The original proposal included production bootstrap abstraction. Refutation downgraded that shape:
business and safety differences would force configuration-heavy indirection. The test-fixture fold
survived.

**Buyer/site notice:** none.
