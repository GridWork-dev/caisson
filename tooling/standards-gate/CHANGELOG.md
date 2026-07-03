# @caisson/standards-gate

## 0.0.3

### Patch Changes

- @caisson/tenancy-rls@0.3.1

## 0.0.2

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

- Updated dependencies [b5915e0]
- Updated dependencies [b5915e0]
- Updated dependencies [afa6070]
- Updated dependencies [95103b6]
  - @caisson/registry-schema@0.2.1
  - @caisson/tenancy-rls@0.3.0

## 0.0.1

### Patch Changes

- Updated dependencies [72ffd85]
- Updated dependencies [9483a36]
  - @caisson/registry-schema@0.2.0
