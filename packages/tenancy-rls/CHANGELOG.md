# @caisson/tenancy-rls

## 0.3.0

### Minor Changes

- b5915e0: Add the `withAdminWrite` seam (ADR-0220, Fork AM-2 = B): a dedicated cross-tenant `admin_write`
  Postgres role for the operator mutation surface, DB-separated from the buyer `app` runtime.
  `buildAdminWritePolicySql(table)` emits a role-scoped `TO admin_write USING/CHECK (true)` policy
  (GRANT SELECT/INSERT/UPDATE, no DELETE) alongside the table's existing `app` tenant-isolation
  floor, and `withAdminWrite(db, fn)` runs `fn` as that role. Like `withTenant`, it refuses a
  SUPERUSER/BYPASSRLS role via the shared guard — now keyed per-`(db, role)` (a WeakMap of role sets)
  so the `admin_write` pre-flight is never skipped just because `app` was already vetted on the same
  `db`. The buyer isolation contract (the SELECT-only ADR-0141 `admin` read role included) is
  unchanged: a `TO admin_write` policy never matches the `app` or `admin` roles.

### Patch Changes

- afa6070: ADR-0210 hardening (SPEC-tenancy-rls, harvest slice-2 #8/#7): `withTenant`/`withUser`
  now run a one-time, fail-closed `assertRoleNotPrivileged` pre-flight (cached per
  `Transactor` in a `WeakSet`) before ever `SET LOCAL ROLE app` — a SUPERUSER or
  BYPASSRLS-configured `app` role is refused before it touches data, instead of silently
  no-oping `FORCE ROW LEVEL SECURITY`. Two new PGlite integration tests cover both flags.

  `tooling/standards-gate` gains `checkRlsEquivalence`: it discovers every tenant table
  (`account_id`/`tenant_id` NOT NULL) across each package's `src/migrations/*.sql`, renders
  `buildTenantPolicySql` for it, and diffs the hand-written RLS block against the generator's
  output — a missing block is `rls-missing`, a structural mismatch or an undocumented
  narrower GRANT is `rls-equivalence`. `rls-equivalence-overrides.json` whitelists the 7
  legitimate narrow-grant tenant tables discovered by the mandated live-gate run
  (retention_audit, alert_audit_log, locked_version, field_key_version, field_wrapped_dek,
  impersonation_session, audit_chain_entry — the last one surfaced live and isn't in the
  SPEC's original list of 6, see the build report). Also fixes a comment-confusability bug
  in the block extractor: migration files narrate design rationale in `--` comments that
  themselves say "GRANT …", which fooled the original single-pass regex into spanning from a
  stray mention to a real (possibly different table's) GRANT statement many lines away.
  Comments are now stripped before parsing and the GRANT search is bounded to each table's
  own ENABLE→CREATE POLICY window, so no per-table result can bleed into another table's in
  a multi-table migration file.

  `apps/base`'s fake rate-limit Transactor now answers the new `pg_roles` pre-flight probe
  as an unprivileged role (the fail-closed guard otherwise reads the empty fixture result as
  a store fault and fails open, masking the deny path).

- 95103b6: Money-path hardening (post-wave triage CAISSON-5/6/7/8/9). `parsePaddleEvent` now correlates
  `items[]` to `details.line_items[]` by their shared `price_id` instead of array position, and fails
  closed on a duplicate non-empty per-line join id; a malformed adjustment item now signals through an
  optional `onWarn` callback, threaded all the way from `PaddleConfig` through `verifyAndParse` and
  wired to `services/license`'s stderr telemetry, instead of a silent skip. `@caisson/credits` gains
  `creditsClawedForSource`, which `services/license`'s `applyBillingEvent` uses to bound BOTH a
  whole-transaction `type:full` refund claw AND a per-line partial claw to the purchase's
  granted-minus-already-clawed remainder regardless of delivery order, never spilling onto another
  purchase's credits. `@caisson/tenancy-rls` gains `buildAdminSelectPolicySql`, a SELECT-only
  cross-tenant policy variant; `services/license`'s admin mutation surface now uses it (rather than the
  write variant) for its read-only `account_member` existence check, and (`grantEntitlementAdmin` /
  `adjustCreditsAdmin`) fails closed with a 404 on a nonexistent target account, rolling back the whole
  transaction before any entitlement or credit row commits.
- Updated dependencies [e62c88d]
- Updated dependencies [ccf8b10]
- Updated dependencies [549dd4e]
  - @caisson/kernel@0.3.0

## 0.2.0

### Minor Changes

- 9483a36: Initial public release (0.1.0) — publish-readiness flip (ADR-0111). The open Base substrate (Apache-2.0, tier `oss`) publishes to public npm; the commercial editions/primitives/generator (tier `paid`) publish to GitHub Packages restricted. Versions were aligned to 0.1.0 in lockstep with the registry ledger; this changeset records the 0.1.0 release and seeds the changeset-presence gate (ADR-0021).

### Patch Changes

- Updated dependencies [69817a1]
- Updated dependencies [9483a36]
  - @caisson/kernel@0.2.0
