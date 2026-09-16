# @caisson/platform-reads

## 0.3.1

### Patch Changes

- Updated dependencies [498b279]
  - @caisson/tenancy-rls@0.6.1

## 0.3.0

### Minor Changes

- b0e66b6: Export the canonical license-platform read expressions for updates windows, subscription and order history, license grants, and refund-net charge calculations. Existing typed readers keep their behavior while the license service now consumes the same SQL bytes.

### Patch Changes

- 87275f6: Replace ESLint and Prettier with oxlint and oxfmt.

  Linting and formatting now run on the oxc toolchain. The rule floor is unchanged: the same
  no-any, no-console, type-only-import and provider-SDK-boundary rules are enforced, at the same
  severities, and formatting keeps the settings the previous formatter used. Every package here is
  touched by the dependency removal or by the one-pass reformat, so each takes a patch bump; no
  runtime behaviour changes.

  For anyone consuming the shared configuration: the lint config package is renamed, and the lint
  and format commands changed.

- Updated dependencies [2609293]
- Updated dependencies [87275f6]
  - @caisson/tenancy-rls@0.6.0

## 0.2.11

### Patch Changes

- @caisson/tenancy-rls@0.5.8

## 0.2.10

### Patch Changes

- a5f9ea8: The figure behind an upgrade credit can now be read net of refunds: a partial refund is subtracted from what the buyer was charged, a charge in another currency can no longer outrank a dollar one on its raw number alone, and the read is checked against the licensing service's own arithmetic so the two cannot drift apart. What buyers are credited today is unchanged.

  A refund notice that names the same purchased line twice is now rejected outright instead of being partly applied. Only the first mention was ever recorded, which quietly left the buyer holding more credit than their refund had left them; the provider is now asked to send the notice again rather than have it half-recorded.

  - @caisson/tenancy-rls@0.5.7

## 0.2.9

### Patch Changes

- @caisson/tenancy-rls@0.5.6

## 0.2.8

### Patch Changes

- d0e6b5c: Rebuilt against current dependency resolutions; no source changes.

## 0.2.7

### Patch Changes

- c36b9e2: Builds now compile with the native TypeScript 7 compiler. The emitted type declarations are unchanged in API; some inferred type members appear in a different order in .d.ts files. Aggregate compile time drops roughly sevenfold.
- Updated dependencies [c36b9e2]
  - @caisson/tenancy-rls@0.5.5

## 0.2.6

### Patch Changes

- 098fe54: Rebuilt against this release's refreshed dependency resolution so the published artifact
  matches its recorded checksum exactly. No functional changes.

## 0.2.5

### Patch Changes

- 8ff4c62: Rebuilt against this release's refreshed dependency resolution so the published artifact
  matches its recorded checksum exactly. No functional changes.

## 0.2.4

### Patch Changes

- fc0bb99: Rebuilt against this release's refreshed dependency resolution so the published artifact
  matches its recorded checksum exactly. No functional changes.
  - @caisson/tenancy-rls@0.5.4

## 0.2.3

### Patch Changes

- 63e9fae: Rebuilt against this release's updated platform dependencies so the published artifact
  matches its recorded checksum exactly. No functional changes.
  - @caisson/tenancy-rls@0.5.3

## 0.2.2

### Patch Changes

- 4c6d3f7: Rebuilt against this release's updated platform dependencies so each published artifact
  matches its recorded checksum exactly. No functional changes.

## 0.2.1

### Patch Changes

- @caisson/tenancy-rls@0.5.2

## 0.2.0

### Minor Changes

- b8fe873: Commerce-lifecycle email templates and a live updates-window read.

  `@caisson/email` gains two registered transactional templates: `purchase-confirmation`
  (post-purchase receipt: buyer, order id, per-line labels, integer-cent total, dashboard
  link) and `renewal-confirmation` (renewed entitlement lines with their new updates-window
  end dates). Both mirror the existing branded layout and coerce through the same
  fail-soft template registry.

  `@caisson/platform-reads` gains `readUpdatesWindows(tx, accountId)` — the
  per-purchased-entitlement updates-window fold (one-time-sourced grants only,
  most-favorable bound per id) as a live read for buyer-facing surfaces, mirroring the
  license service's `computeUpdatesWindows` semantics without importing its runtime.

- 3758b3c: Adds `readSubscriptionStatuses` and `readOrderRecords`, typed reads over two new buyer-dashboard
  tables: a subscription's current lifecycle state (active/canceled) and an append-only order/invoice
  history. Both follow the existing column-contract pattern — a schema rename in the owning service
  fails the columns-contract test rather than silently desyncing the reader's SQL.

### Patch Changes

- 5d60969: Affiliate program support. Paddle webhook parsing now captures `discount_id` on both
  one-time purchases and subscription invoices, and the order record stamps it via a new
  append-only platform migration. The billing provider port gains an optional
  `createDiscount` method (the Paddle implementation mints percentage discount codes; other
  drivers may omit it), and a new affiliate code registry migration carries per-code program
  parameters (discount percent, commission basis points) stamped at mint time so historical
  rows survive future parameter changes. Platform-reads test harnesses updated for the new
  order-record column.
- 2b65cf3: Test coverage updated for the new subscription-cancel tombstone semantics: a cancel with
  no prior status row now records a canceled tombstone (empty price/plan sentinels) instead
  of leaving nothing behind, so out-of-order granting invoices can detect the cancel. Reads
  are unchanged; consumers already filter on active status.
- 9a81dd7: Test-only: provision the new `renewal_extension` table in the updates-window integration setup —
  `@caisson/service-license`'s `extendUpdatesWindow` now records a renewal-extension ledger row
  (the renewal-refund un-extend ledger), so any suite that exercises it must create the table.
- Updated dependencies [8253e76]
  - @caisson/tenancy-rls@0.5.1

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
