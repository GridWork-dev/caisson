# @caisson/ds-manifest

## 0.3.5

### Patch Changes

- 73bdf3c: Package descriptions, READMEs and agent notes now describe what each package does, with no prices, paid tiers or license-key requirements. The standards gate fails when a published package's description or README mentions a commercial tier or a dollar price.
- 73bdf3c: Each package's `manifest.ts` now imports `defineModule` from the sibling `registry-schema` package instead of a monorepo-only directory, so the file resolves wherever `@caisson-sh/registry-schema` is installed next to it.
- 784a846: Each package's metadata now links to its source directory in the public repository.
- 611f1de: Package comments, tests, READMEs and generated templates now describe the reader as an adopter integrating the package into their own app, not a buyer of a Caisson product. Compliance-artifact wording that faced an adopter's own customers now says so explicitly, and internal signing-key and licensing-domain comments no longer reference a retired commercial license issuer.
- 73bdf3c: Every package is now Apache-2.0 and publishes to the public npm registry. Each package ships the Apache LICENSE file, and the registry manifest carries the same license. Nothing needs a license key or a private registry to install.
- 0b02891: Every package now publishes under the `@caisson-sh` npm scope. Update imports and dependencies to the new names; module ids in registry manifests use the same scope.

## 0.3.4

### Patch Changes

- 97ec962: Regenerate ds-manifest's bundled component metadata for the new @caisson/ui version (version-pr.yml runs `bun run --filter @caisson/ui gen:manifest` after Changesets consumes versions, and packages/ui/scripts/manifest-generator.ts writes ui's package.json version into packages/ds-manifest/src/base-manifest.json), so the already-recorded @caisson/ds-manifest@0.3.3 tarball no longer reproduces; a new package version preserves the existing row.

## 0.3.3

### Patch Changes

- 886e1e7: Strip internal decision-log citations from the public mirror export, and gate the sync on the exported artifact building, testing, linting and formatting clean before a byte reaches the public repo.

  The ThemeToggle summary no longer repeats its own component name: every other component's manifest summary has that prefix removed by the generator, and this one kept it only because a parenthetical sat between the name and the em dash the generator matches on. Two comments where a decision id was the grammatical subject of a sentence are reworded so the sentence still stands once the id is gone.

- 87275f6: Replace ESLint and Prettier with oxlint and oxfmt.

  Linting and formatting now run on the oxc toolchain. The rule floor is unchanged: the same
  no-any, no-console, type-only-import and provider-SDK-boundary rules are enforced, at the same
  severities, and formatting keeps the settings the previous formatter used. Every package here is
  touched by the dependency removal or by the one-pass reformat, so each takes a patch bump; no
  runtime behaviour changes.

  For anyone consuming the shared configuration: the lint config package is renamed, and the lint
  and format commands changed.

## 0.3.2

### Patch Changes

- fab7a0d: Repack the design-system manifest with the upgraded `@types/culori` catalog range so its published archive metadata stays synchronized with the root catalog.

## 0.3.1

### Patch Changes

- e917c52: The colour-contrast check now treats an unmeasurable pair as a failure rather than a pass. A ratio that cannot be computed made every comparison against the minimum come out false, so such a pair would have been reported as compliant; the check now requires a ratio to be at or above the minimum before it passes.

## 0.3.0

### Minor Changes

- 96aa01d: Replace the four-component design-system fixture with a deterministic manifest generated from all
  39 primary UI components, add a byte-for-byte drift guard, and centralize browser-rendered semantic,
  functional, and code-token contrast validation in `@caisson/ds-manifest`.

## 0.2.2

### Patch Changes

- c36b9e2: Builds now compile with the native TypeScript 7 compiler. The emitted type declarations are unchanged in API; some inferred type members appear in a different order in .d.ts files. Aggregate compile time drops roughly sevenfold.

## 0.2.1

### Patch Changes

- f844386: Fix the public mirror's CI, which failed `bun test` on every sync since the registry-index
  bundler test was added: `bundle-registry-index.test.ts` reads the repo-root `registry/index.json`
  ledger, absent-by-design from the mirror, and is now excluded (same class as the existing
  `entitlement-expansion.test.ts` exclusion). Also fixes two bugs the mirror's new lint/test gate
  surfaced along the way: `generate.test.ts`'s edition-auto-expand describe block loaded the same
  absent registry ledger at describe-definition time (now `describe.skipIf`-gated + lazy in
  `beforeAll`, matching the `advisory-lock.integration.test.ts` precedent — zero behavior change in
  the private repo, where the file is always present); and `ds-manifest`'s doctor tool
  (`UI_IMPORT_RE` / `PKG_UI_DEP_RE`) hardcoded the `@caisson/ui` npm specifier, so the shipped
  `@caisson-sh/ds-manifest` could never detect a hallucinated-component import against the public
  `@caisson-sh/ui` package a real mirror buyer would install — both regexes now accept an optional
  `-sh` scope (strict widening, no behavior change for real `@caisson/ui` commercial usage).

  The mirror's exporter (`scripts/export-public-mirror.ts`, not itself a published package) also
  gained: a lint + format-check CI leg; a root `eslint.config.js` + `.prettierignore` shipped into
  the mirror; an export-time `prettier --write` pass so the npm scope rename's length change can
  never desync the mirror from its own format-check; and a fix to `sanitizeSourceComments`'s naive
  regex, which previously misread a `/* */`-lookalike sequence inside a string literal (a
  comment-injection test fixture) as a real comment span and silently corrupted real code caught in
  the false span — it is now string/template-literal-aware.

## 0.2.0

### Minor Changes

- 7f68b56: Add a new shared package holding the component-manifest schema, a typed reader, and a pure WCAG
  contrast checker — the common data and analysis layer the CLI, the buyer MCP, and the kit's own
  build-time generator all import so a coding agent can discover and verify correct usage of the
  design-system kit without duplicating that logic in each front end.
