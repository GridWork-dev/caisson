# @caisson/app-base

## 0.0.18

### Patch Changes

- Updated dependencies [c36b9e2]
- Updated dependencies [b8b14b4]
  - @caisson/auth@0.4.0
  - @caisson/billing@0.6.4
  - @caisson/credits@0.5.8
  - @caisson/kernel@0.5.3
  - @caisson/mcp-server@0.6.4
  - @caisson/rate-limit@0.1.7
  - @caisson/tenancy-rls@0.5.5

## 0.0.17

### Patch Changes

- @caisson/credits@0.5.7
- @caisson/mcp-server@0.6.3

## 0.0.16

### Patch Changes

- Updated dependencies [fc0bb99]
  - @caisson/kernel@0.5.2
  - @caisson/auth@0.3.5
  - @caisson/billing@0.6.3
  - @caisson/credits@0.5.6
  - @caisson/mcp-server@0.6.2
  - @caisson/rate-limit@0.1.6
  - @caisson/tenancy-rls@0.5.4

## 0.0.15

### Patch Changes

- Updated dependencies [7de6fa4]
  - @caisson/kernel@0.5.1
  - @caisson/credits@0.5.5
  - @caisson/mcp-server@0.6.1
  - @caisson/auth@0.3.4
  - @caisson/billing@0.6.2
  - @caisson/rate-limit@0.1.5
  - @caisson/tenancy-rls@0.5.3

## 0.0.14

### Patch Changes

- Updated dependencies [c7476b9]
  - @caisson/mcp-server@0.6.0
  - @caisson/credits@0.5.4

## 0.0.13

### Patch Changes

- @caisson/mcp-server@0.5.1

## 0.0.12

### Patch Changes

- Updated dependencies [3667926]
  - @caisson/mcp-server@0.5.0

## 0.0.11

### Patch Changes

- Updated dependencies [0dbb9f7]
  - @caisson/mcp-server@0.4.0

## 0.0.10

### Patch Changes

- @caisson/credits@0.5.3
- @caisson/mcp-server@0.3.2

## 0.0.9

### Patch Changes

- @caisson/credits@0.5.2
- @caisson/mcp-server@0.3.1

## 0.0.8

### Patch Changes

- Updated dependencies [a8696cf]
- Updated dependencies [7f68b56]
- Updated dependencies [e5e4311]
- Updated dependencies [a8696cf]
- Updated dependencies [e183860]
  - @caisson/auth@0.3.3
  - @caisson/mcp-server@0.3.0
  - @caisson/kernel@0.5.0
  - @caisson/billing@0.6.1
  - @caisson/credits@0.5.1
  - @caisson/rate-limit@0.1.4
  - @caisson/tenancy-rls@0.5.2

## 0.0.7

### Patch Changes

- Updated dependencies [5d60969]
- Updated dependencies [230f02a]
- Updated dependencies [a79acb4]
- Updated dependencies [2b65cf3]
- Updated dependencies [d5cef92]
- Updated dependencies [8670f38]
- Updated dependencies [8253e76]
  - @caisson/billing@0.6.0
  - @caisson/credits@0.5.0
  - @caisson/kernel@0.4.3
  - @caisson/mcp-server@0.2.6
  - @caisson/auth@0.3.2
  - @caisson/rate-limit@0.1.3
  - @caisson/tenancy-rls@0.5.1

## 0.0.6

### Patch Changes

- Internal hygiene wave: the standards gate's locked-price table moved the Compliance bundle to its
  current price and gained rows for the two retired alias packages; the four private reference apps
  and the root manifest now carry an explicit license field; the license service applies the new
  Developer-plan coverage semantics when computing signed license claims.
- Updated dependencies [8c53ca3]
- Updated dependencies
  - @caisson/tenancy-rls@0.5.0
  - @caisson/credits@0.4.1
  - @caisson/mcp-server@0.2.5
  - @caisson/auth@0.3.1
  - @caisson/rate-limit@0.1.2

## 0.0.5

### Patch Changes

- 850b844: Moved the per-account throttle store out of the commercial license service and into the
  new shared, freely licensed rate-limiting package. The open reference application now
  composes this shared store directly for its buyer-facing throttling instead of depending
  on the commercial license service to get it. Buyer-visible throttling behavior is
  unchanged; this only changes where the code lives and removes an unnecessary dependency
  from the open reference application.
- Updated dependencies [b791198]
- Updated dependencies [b674ed3]
- Updated dependencies [d6cc28e]
- Updated dependencies [d06a9b8]
- Updated dependencies [0c883ae]
- Updated dependencies [ad02304]
- Updated dependencies [4d7eb71]
- Updated dependencies [6e48b18]
- Updated dependencies [850b844]
- Updated dependencies [850b844]
- Updated dependencies [0af4dbf]
- Updated dependencies [0af4dbf]
  - @caisson/auth@0.3.0
  - @caisson/billing@0.5.0
  - @caisson/credits@0.4.0
  - @caisson/kernel@0.4.2
  - @caisson/mcp-server@0.2.4
  - @caisson/rate-limit@0.1.1
  - @caisson/tenancy-rls@0.4.0

## 0.0.4

### Patch Changes

- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
  - @caisson/kernel@0.4.1
  - @caisson/tenancy-rls@0.3.2
  - @caisson/service-license@0.0.4
  - @caisson/auth@0.2.3
  - @caisson/billing@0.4.1
  - @caisson/credits@0.3.2
  - @caisson/mcp-server@0.2.3

## 0.0.3

### Patch Changes

- Updated dependencies [4fc006c]
- Updated dependencies [cc7cb8b]
- Updated dependencies [fb8d966]
- Updated dependencies [fb8d966]
  - @caisson/service-license@0.0.3
  - @caisson/billing@0.4.0
  - @caisson/kernel@0.4.0
  - @caisson/auth@0.2.2
  - @caisson/credits@0.3.1
  - @caisson/mcp-server@0.2.2
  - @caisson/tenancy-rls@0.3.1

## 0.0.2

### Patch Changes

- afa6070: Tenancy RLS hardening: `withTenant`/`withUser`
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
- Updated dependencies [20d5ab0]
- Updated dependencies [e62c88d]
- Updated dependencies [ccf8b10]
- Updated dependencies [c98d07b]
- Updated dependencies [afa6070]
- Updated dependencies [95103b6]
- Updated dependencies [aaff518]
- Updated dependencies [904b15b]
- Updated dependencies [549dd4e]
  - @caisson/tenancy-rls@0.3.0
  - @caisson/billing@0.3.0
  - @caisson/kernel@0.3.0
  - @caisson/credits@0.3.0
  - @caisson/mcp-server@0.2.1
  - @caisson/service-license@0.0.2
  - @caisson/auth@0.2.1

## 0.0.1

### Patch Changes

- Updated dependencies [22077d1]
- Updated dependencies [72ffd85]
- Updated dependencies [69817a1]
- Updated dependencies [5b57c78]
- Updated dependencies [a07feb0]
- Updated dependencies [9483a36]
  - @caisson/auth@0.2.0
  - @caisson/mcp-server@0.2.0
  - @caisson/billing@0.2.0
  - @caisson/kernel@0.2.0
  - @caisson/credits@0.2.0
  - @caisson/tenancy-rls@0.2.0
  - @caisson/service-license@0.0.1
