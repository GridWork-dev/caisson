# @caisson/service-betterstack-adapter

## 0.0.10

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

- Updated dependencies [f669d4a]
- Updated dependencies [b0e66b6]
- Updated dependencies [2609293]
- Updated dependencies [87275f6]
  - @caisson/kernel@0.9.0

## 0.0.9

### Patch Changes

- Updated dependencies [7d74f8f]
  - @caisson/kernel@0.8.0

## 0.0.8

### Patch Changes

- Updated dependencies [e917c52]
- Updated dependencies [f2cb853]
  - @caisson/kernel@0.7.0

## 0.0.7

### Patch Changes

- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
  - @caisson/kernel@0.6.0

## 0.0.6

### Patch Changes

- Updated dependencies [c36b9e2]
  - @caisson/kernel@0.5.3

## 0.0.5

### Patch Changes

- Updated dependencies [fc0bb99]
  - @caisson/kernel@0.5.2

## 0.0.4

### Patch Changes

- Updated dependencies [7de6fa4]
  - @caisson/kernel@0.5.1

## 0.0.3

### Patch Changes

- Updated dependencies [e5e4311]
- Updated dependencies [e183860]
  - @caisson/kernel@0.5.0

## 0.0.2

### Patch Changes

- Updated dependencies [2b65cf3]
- Updated dependencies [8253e76]
  - @caisson/kernel@0.4.3
