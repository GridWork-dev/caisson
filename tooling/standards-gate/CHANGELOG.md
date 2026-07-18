# @caisson/standards-gate

## 0.0.11

### Patch Changes

- c7476b9: The agent-runtime dependency-boundary check now allows the trajectory package to depend on the
  field-encryption primitive, since parked run bodies are now encrypted at rest.
- Updated dependencies [f40653b]
  - @caisson/registry-schema@0.5.3

## 0.0.10

### Patch Changes

- Updated dependencies [5a09b01]
  - @caisson/registry-schema@0.5.2

## 0.0.9

### Patch Changes

- Updated dependencies [3f05e1e]
  - @caisson/registry-schema@0.5.1

## 0.0.8

### Patch Changes

- 59e1365: TypeScript bridge to 6.0.3 (Kickoff T task 5, re-derived version map): the workspace catalog moves
  from ^5.7.3 to ^6.0.3 (the stable JS-compiler transition release; 7.x is the native compiler whose
  stable API waits for 7.1). standards-gate pins its own typescript to ^6.0.3 explicitly so a future
  catalog move to 7.x cannot strand its ts.createScanner usage. brand, ui-pro, and demo-registry gain
  a css.d.ts ambient declaration for the side-effect CSS imports TS 6.0 now checks (TS2882).
  - @caisson/tenancy-rls@0.5.2
  - @caisson/registry-schema@0.5.0

## 0.0.7

### Patch Changes

- 4b1b9b7: Disable turbo caching on the standards-gate test task. The suite reads the registry ledger and
  every workspace package.json at runtime — outside its package input globs — so cache hits could
  report stale-green results. Its effective inputs are the whole repo; running fresh every time is
  the sound behavior.
- 4d85f28: The reserved-id carve-out for ui-pro is removed from entitlement expansion: a ui-pro
  purchase now resolves to the real module grant, and the fail-closed rejection of unknown
  ids applies to it on any index that does not ship it. The standards gate gains the ui-pro
  price-authority row.
- Updated dependencies [3d23da7]
- Updated dependencies [9a81dd7]
- Updated dependencies [8253e76]
- Updated dependencies [99d665a]
- Updated dependencies [ab352ab]
- Updated dependencies [4d85f28]
  - @caisson/registry-schema@0.5.0
  - @caisson/tenancy-rls@0.5.1

## 0.0.6

### Patch Changes

- Internal hygiene wave: the standards gate's locked-price table moved the Compliance bundle to its
  current price and gained rows for the two retired alias packages; the four private reference apps
  and the root manifest now carry an explicit license field; the license service applies the new
  Developer-plan coverage semantics when computing signed license claims.
- Updated dependencies [8170382]
- Updated dependencies [8c53ca3]
- Updated dependencies
  - @caisson/registry-schema@0.4.0
  - @caisson/tenancy-rls@0.5.0

## 0.0.5

### Patch Changes

- ad66801: Clarify two historical code comments; no behavior change.
- 850b844: Added a new shared rate-limiting package with an in-memory per-client-IP throttle for
  surfaces with no signed-in identity yet. The docs and license services now both import
  this shared limiter instead of each keeping a separate copy of the same logic. The
  internal licensing-boundary check also now recognizes the new package as part of the
  open, freely licensed base set. Buyer-visible throttling behavior, including the limits,
  the retry timing, and which header is trusted for the client IP, is unchanged; this only
  changes where the code lives.
- 0af4dbf: Added a gate check that scans shipped documentation and source comments for internal-only
  vocabulary and bare specification-id citations.
- aec9f1c: The standards gate now checks a locked module's registry manifest price against its authoritative
  listed price, keyed by package id. A manifest carrying a stale or drifted price now fails the
  build before it can ship, instead of the mismatch only surfacing later at checkout. Package names
  and version bumps in a changeset header are unaffected by this change; only manifest pricing is
  checked.
- Updated dependencies [b791198]
- Updated dependencies [d6cc28e]
- Updated dependencies [0c883ae]
- Updated dependencies [2834c3f]
- Updated dependencies [41e07b6]
- Updated dependencies [850b844]
- Updated dependencies [31d6a41]
- Updated dependencies [0af4dbf]
- Updated dependencies [0af4dbf]
  - @caisson/registry-schema@0.3.0
  - @caisson/tenancy-rls@0.4.0

## 0.0.4

### Patch Changes

- cf66d65: The standards gate now checks every pending changeset's release note before it can merge. A
  changeset body ships verbatim into the target package's public changelog, so the gate rejects
  internal shorthand, references to numbered internal documents, and repo-internal directory
  paths before they can reach a published changelog. Package names and version bumps in the
  changeset header are unaffected; only the written description is checked. An empty changeset
  still passes.
- Updated dependencies [cf66d65]
  - @caisson/tenancy-rls@0.3.2

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
