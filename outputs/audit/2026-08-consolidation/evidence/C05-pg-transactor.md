# C05 — centralize node-postgres transaction adapters

**Verdict:** VERIFIED FOLD-INTO `@caisson/tenancy-rls`  
**Size:** 211 gross duplicated lines; estimated 180–195 net reduction  
**Risk:** high transaction-boundary code

## Evidence

Equivalent BEGIN/COMMIT/ROLLBACK/release adapters exist at:

- `packages/tenancy-rls/src/supabase.ts:56-93`
- `apps/site/lib/db.ts:42-79`
- `apps/admin/src/lib/admin-db.ts:150-183`
- `services/license/src/deploy.ts:40-76`
- `packages/cli/src/run.ts:381-416`
- `packages/cli/templates/framework/next/src/lib/db.ts:21-56`
- `services/license/live/webhook-grant.live.test.ts:51-80`

Counting uses inclusive physical source ranges. The 38-line canonical implementation in
`tenancy-rls` is retained and excluded from the 211 duplicated-line gross count.

The contract already belongs to tenancy at `packages/tenancy-rls/src/rls.ts:21-33`, and the package
already depends on `pg` (`packages/tenancy-rls/package.json:23-26`).

## Safe shape

Export a caller-pool-owned `createPgTransactor(pool)`. Keep pool construction, lazy template pool
initialization, HMR caching, error listeners, shutdown, and `pool.end()` with each caller. Add fake
Pool tests for BEGIN, COMMIT, best-effort ROLLBACK, and release.

## Registry/revenue

No package ID is removed. `tenancy-rls` is a published Base package, so the new public helper needs
a normal release/changeset; bundle and entitlement state do not change.

## Refute attempt

Caller lifecycle differences were real but sit outside the duplicated adapter. The refuter preserved
the template's lazy pool behavior and still found the narrow helper equivalent.

**Buyer/site notice:** no behavior change intended; generated starter source becomes smaller.
