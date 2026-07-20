# @caisson/design-critic

## 0.0.2

### Patch Changes

- 16de8df: Declares each package's type-check-only `build` task as producing no cacheable output (`outputs: []`), clearing the five stale "no output files found" warnings from a clean turbo build. No behavior change.

## 0.0.1

### Patch Changes

- a551702: Reconcile the visual-audit findings ledger against a full 48-route verification pass:
  82 findings flip to fixed, 125 stay open, the 14 accepted are preserved. Data-only
  change to `findings.toml`; no reconcile logic changed.
