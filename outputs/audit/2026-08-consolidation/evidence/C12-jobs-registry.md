# C12 — centralize jobs task-registry lookup

**Verdict:** VERIFIED FOLD-INTO private jobs helper  
**Size:** 72 gross; estimated 45–50 net  
**Risk:** medium provider behavior

## Evidence

Five drivers repeat map construction and missing-task errors:

- `packages/jobs/src/queue.ts:113-132,163-168`
- `packages/jobs/src/trigger-driver.ts:75-77,96-119`
- `packages/jobs/src/inngest.ts:57-59,79-109`
- `packages/jobs/src/pgboss.ts:209-211,252-258,281-287,331-342`
- `packages/jobs/src/bullmq.ts:158-160,216-222,239-245,271-282`

Nine `registry.get` and three `registry.has` guards implement the same `NotFoundError` contract.
Each driver has missing-task tests, including `queue.test.ts:25-36,195-198`,
`trigger-driver.test.ts:60-78`, `pgboss.test.ts:167-186`, and `bullmq.test.ts:128-149`.

## Safe shape

Add private `createTaskRegistry`/`requireRegisteredTask` helpers. Keep registration, payload parsing,
alerting, singleton, queue construction, scheduling, and provider worker semantics local.

## Registry/revenue

`@caisson/jobs` is a published Base package. This is an internal refactor with a normal patch
release; no exports, ledger IDs, bundles, or entitlements change.

## Refute attempt

Provider-wide abstraction was refuted. Only exact map/lookup/error behavior survived.

**Buyer/site notice:** none intended.
