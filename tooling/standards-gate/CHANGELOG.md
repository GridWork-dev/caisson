# @caisson/standards-gate

## 0.1.5

### Patch Changes

- Updated dependencies [498b279]
- Updated dependencies [cd694f1]
  - @caisson/tenancy-rls@0.6.1
  - @caisson/registry-schema@0.5.12

## 0.1.4

### Patch Changes

- 2609293: Consolidation wave one: the eighteen refutation-verified cuts from the August consolidation audit.

  New public API: `@caisson/kernel` gains the narrow `./crypto` subpath (node:crypto-only graph,
  so a Cloudflare Worker can import the timing-safe compare without the wide `./node` barrel's
  `node:dns` reach), and `@caisson/tenancy-rls` exports `createPgTransactor(pool)` — the canonical
  node-postgres BEGIN/COMMIT/best-effort-ROLLBACK/release adapter previously copy-pasted across the
  site, admin, the license deploy entry, the CLI, and the generated Next starter (which also gains
  the best-effort rollback it lacked). Everything else is deletion or internal consolidation with
  behavior pinned by tests: dead marketplace/build residue and dead nav derivation out of the site,
  the unused account-entitlement resolver and 111 unreachable barrel exports out of the license
  service, the orphan EU AI Act manifest out of compliance (it was being packed while unreachable),
  an unused trust-page devDependency, shared task-registry lookup across the five jobs drivers,
  shared exact byte-identical parser readers in billing-orchestration, the kernel browser-graph
  walker folded onto the shared testing module-graph, the intel OpenRouter transport shared between
  enrichment and its eval judge, license scheduler test fixtures consolidated, the dependency graph
  guard moved into standards-gate ownership (its test now runs in the package suite), the Better
  Stack adapter's unauthenticated dev bypass deleted and its secret compare folded onto the kernel
  primitive, and one boundary-policy data source feeding ESLint, dependency-cruiser, and the
  standards gate — closing a drifted cruiser hand-copy that had silently stopped guarding the five
  current bundle roots.

- 87275f6: Replace ESLint and Prettier with oxlint and oxfmt.

  Linting and formatting now run on the oxc toolchain. The rule floor is unchanged: the same
  no-any, no-console, type-only-import and provider-SDK-boundary rules are enforced, at the same
  severities, and formatting keeps the settings the previous formatter used. Every package here is
  touched by the dependency removal or by the one-pass reformat, so each takes a patch bump; no
  runtime behaviour changes.

  For anyone consuming the shared configuration: the lint config package is renamed, and the lint
  and format commands changed.

- Updated dependencies [2609293]
- Updated dependencies [886e1e7]
- Updated dependencies [87275f6]
- Updated dependencies [c10e3b6]
  - @caisson/tenancy-rls@0.6.0
  - @caisson/registry-schema@0.5.11

## 0.1.3

### Patch Changes

- Updated dependencies
  - @caisson/registry-schema@0.5.10

## 0.1.2

### Patch Changes

- @caisson/registry-schema@0.5.9
- @caisson/tenancy-rls@0.5.8

## 0.1.1

### Patch Changes

- e917c52: Adds a build-time check that every named entitlement edge points at a module the registry index actually carries. The runtime now skips an unresolvable edge instead of failing the whole grant, so this gate is what keeps a missing target loud at the moment it is still free to fix.
- e917c52: Both catalog parity checks gain the direction they were missing. The price check now also fails when the pricebook carries a row no price lock backs, which previously passed forever even though such a row still feeds upgrade credits and checkout quotes, and a renamed or retired one keeps quoting a product that no longer ships. The membership check now re-runs its claim against the published registry index as well as the workspace manifests, since the index is what a live buyer's grants actually resolve from; a gap there is reported as a warning, because publishing a member before folding it into its bundle legitimately opens that window for one release.
- Updated dependencies [e917c52]
  - @caisson/registry-schema@0.5.9
  - @caisson/tenancy-rls@0.5.7

## 0.1.0

### Minor Changes

- 108a358: Adds a pricing-agreement check that keeps the catalog's locked prices and the commerce price book in exact agreement, so a reprice can never leave the displayed price or upgrade credits behind.

### Patch Changes

- 308327d: Bump dependency-cruiser devDependency ^16 -> ^18, aligning the nested pin with the root ^18 already live since #231; no behavior change (CI runs root 18.1.0 on Node 22 either way).
- Updated dependencies [25fd03c]
- Updated dependencies [a21c478]
- Updated dependencies [108a358]
  - @caisson/registry-schema@0.5.8
  - @caisson/tenancy-rls@0.5.6

## 0.0.16

### Patch Changes

- Updated dependencies [31d59fd]
  - @caisson/registry-schema@0.5.7

## 0.0.15

### Patch Changes

- bd071c9: The manifest-pending warning no longer fires for packages that already declare themselves never-published internal tooling (brand, demo-registry, platform-migrations, audit-harness) in an explicit, auditable exemption set. A package must still carry a real SPDX license either way.
- 16de8df: Declares each package's type-check-only `build` task as producing no cacheable output (`outputs: []`), clearing the five stale "no output files found" warnings from a clean turbo build. No behavior change.
- Updated dependencies [c36b9e2]
  - @caisson/registry-schema@0.5.6
  - @caisson/tenancy-rls@0.5.5

## 0.0.14

### Patch Changes

- Updated dependencies [2229209]
  - @caisson/registry-schema@0.5.5

## 0.0.13

### Patch Changes

- @caisson/tenancy-rls@0.5.4

## 0.0.12

### Patch Changes

- Updated dependencies [5d03808]
  - @caisson/registry-schema@0.5.4
  - @caisson/tenancy-rls@0.5.3

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
