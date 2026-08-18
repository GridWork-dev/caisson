# @caisson/browser-audit

## 0.0.3

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
- Updated dependencies [aac3b87]
- Updated dependencies [87275f6]
  - @caisson/testing@0.0.4

## 0.0.2

### Patch Changes

- 16de8df: Declares each package's type-check-only `build` task as producing no cacheable output (`outputs: []`), clearing the five stale "no output files found" warnings from a clean turbo build. No behavior change.
