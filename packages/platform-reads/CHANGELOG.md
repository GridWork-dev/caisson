# @caisson/platform-reads

## 0.1.6

### Patch Changes

- Updated dependencies [8c53ca3]
- Updated dependencies
  - @caisson/tenancy-rls@0.5.0

## 0.1.5

### Patch Changes

- b791198: Documentation and metadata cleanup plus dependency-declaration hygiene: package descriptions, READMEs, changelogs, and source comments no longer carry internal build references, and shared external dependency ranges now resolve through the workspace dependency catalog (published dependency ranges unchanged; the TypeScript devDependency floor moves to ^5.7.3).
- 41e07b6: Module manifests can now declare `sellable: false` to mark a package that ships only as bundle
  substrate and is never sold on its own. The field is optional and defaults to sellable, so every
  existing manifest stays valid and unchanged. The shared cross-service read layer and the commerce
  price-book are both marked bundle-only.
- Updated dependencies [b791198]
- Updated dependencies [0c883ae]
- Updated dependencies [0af4dbf]
  - @caisson/tenancy-rls@0.4.0

## 0.1.4

### Patch Changes

- Updated dependencies [cf66d65]
  - @caisson/tenancy-rls@0.3.2

## 0.1.3

### Patch Changes

- @caisson/tenancy-rls@0.3.1

## 0.1.2

### Patch Changes

- Updated dependencies [b5915e0]
- Updated dependencies [afa6070]
- Updated dependencies [95103b6]
  - @caisson/tenancy-rls@0.3.0

## 0.1.1

### Patch Changes

- 6236f59: Add `@caisson/platform-reads` (new): shared typed read-only queries over the
  services/license cross-service tables (`entitlement_grant` / `license_grant`), so the
  buyer dashboard (apps/site) and any other surface reading those tables imports the typed
  reader instead of hand-copying raw SQL — a column rename now fails the columns-contract
  test instead of silently desyncing at runtime.

  Update `@caisson/observability` (ADR-0117): the vendor-neutral OpenTelemetry bootstrap
  (env-gated NodeSDK + OTLP/HTTP exporter, HTTP/fetch/pg auto-instrumentation, and
  span-attribute scrubbing).

- Updated dependencies [9483a36]
  - @caisson/tenancy-rls@0.2.0
