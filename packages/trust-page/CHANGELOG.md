# @caisson/trust-page

## 0.3.6

### Patch Changes

- 73bdf3c: Package descriptions, READMEs and agent notes now describe what each package does, with no prices, paid tiers or license-key requirements. The standards gate fails when a published package's description or README mentions a commercial tier or a dollar price.
- 73bdf3c: Each package's `manifest.ts` now imports `defineModule` from the sibling `registry-schema` package instead of a monorepo-only directory, so the file resolves wherever `@caisson-sh/registry-schema` is installed next to it.
- 784a846: Each package's metadata now links to its source directory in the public repository.
- 611f1de: Package comments, tests, READMEs and generated templates now describe the reader as an adopter integrating the package into their own app, not a buyer of a Caisson product. Compliance-artifact wording that faced an adopter's own customers now says so explicitly, and internal signing-key and licensing-domain comments no longer reference a retired commercial license issuer.
- 73bdf3c: Every package is now Apache-2.0 and publishes to the public npm registry. Each package ships the Apache LICENSE file, and the registry manifest carries the same license. Nothing needs a license key or a private registry to install.
- 0b02891: Every package now publishes under the `@caisson-sh` npm scope. Update imports and dependencies to the new names; module ids in registry manifests use the same scope.
- 9e5da35: Adds a README.
- Updated dependencies [73bdf3c]
- Updated dependencies [73bdf3c]
- Updated dependencies [784a846]
- Updated dependencies [611f1de]
- Updated dependencies [73bdf3c]
- Updated dependencies [0b02891]
  - @caisson-sh/artifact-render@0.2.6
  - @caisson-sh/compliance-core@0.7.3
  - @caisson-sh/kernel@0.10.1

## 0.3.5

### Patch Changes

- Updated dependencies [87b07c6]
- Updated dependencies [7d39669]
- Updated dependencies [498b279]
  - @caisson/kernel@0.10.0
  - @caisson/artifact-render@0.2.5
  - @caisson/compliance-core@0.7.2

## 0.3.4

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
  - @caisson/artifact-render@0.2.4
  - @caisson/compliance-core@0.7.1

## 0.3.3

### Patch Changes

- Updated dependencies [74f0756]
- Updated dependencies [2caec56]
- Updated dependencies [7d74f8f]
  - @caisson/compliance-core@0.7.0
  - @caisson/kernel@0.8.0
  - @caisson/artifact-render@0.2.3

## 0.3.2

### Patch Changes

- Updated dependencies [e917c52]
- Updated dependencies [f2cb853]
  - @caisson/kernel@0.7.0
  - @caisson/compliance-core@0.6.3
  - @caisson/artifact-render@0.2.2

## 0.3.1

### Patch Changes

- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
- Updated dependencies [a21c478]
  - @caisson/kernel@0.6.0
  - @caisson/compliance-core@0.6.2
  - @caisson/artifact-render@0.2.1

## 0.3.0

### Minor Changes

- 1c5c137: The trust page is now sold à la carte at $149 and included in the Compliance and
  Everything bundles: a self-contained static trust page built from an evidence pack
  through allowlist-based redaction, hostable anywhere to show prospects a compliance
  posture.

### Patch Changes

- @caisson/compliance-core@0.6.1

## 0.2.0

### Minor Changes

- ff2cc46: New buyer trust-page generator: turns an evidence pack and its crosswalk mapping into a
  self-contained static HTML page and a matching JSON data file, deployable anywhere a
  buyer chooses to host it. Redaction is allowlist-based — a field the buyer has not
  explicitly allowed never appears in either output. Never published or sellable yet; a
  future pricing round decides when that changes.

### Patch Changes

- Updated dependencies [ff2cc46]
- Updated dependencies [dd94186]
- Updated dependencies [fa79938]
- Updated dependencies [ff2cc46]
- Updated dependencies [0f2215e]
  - @caisson/artifact-render@0.2.0
  - @caisson/compliance-core@0.6.0
