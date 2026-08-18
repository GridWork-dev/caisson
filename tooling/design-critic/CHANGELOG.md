# @caisson/design-critic

## 0.0.4

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

## 0.0.3

### Patch Changes

- 4ef8920: Reconcile the visual-audit findings ledger against the 2026-07-21 141-surface rubric
  sweep: 502 new findings land, 105 stay open (89 lane-confirmed still-present, the 14
  accepted preserved, 2 not-verifiable kept open), 34 flip to fixed. Data-only change to
  `findings.toml`; no reconcile logic changed.
- accf3f6: Reconcile the visual-audit findings ledger after the visual-remediation phase merged and
  deployed: 566 open rows flip to fixed (live-verified fix classes), 23 flip to accepted
  per the closeout locks (Turnstile environment noise, vendor console-NaN family,
  deliberate legal measure and jump-nav posture, the retention-runner tint deferral), and
  4 stay open as real leftovers (footer tracking anomaly, AdminNav/CatalogNav merge,
  foundations Panel C orphan). Data-only change to `findings.toml`; no reconcile logic
  changed.
- 367ef64: Final visual-remediation ledger reconcile after the residual batch and the ten-lane
  live re-audit: 27 rows flip to fixed (the built accepted carve-outs plus the open
  leftovers), the 14 illustration-placeholder rows stay accepted pending the schematics
  kickoff, and 6 curated info-tier re-audit findings enter as open. Data-only change to
  `findings.toml`.
- 32d1db7: Ledger reconcile after the open-row sextet deployed and live-verified: the six open
  live-reaudit rows flip to fixed, the 14 illustration-placeholder rows stay accepted
  pending the schematics kickoff. Data-only change to `findings.toml`.

## 0.0.2

### Patch Changes

- 16de8df: Declares each package's type-check-only `build` task as producing no cacheable output (`outputs: []`), clearing the five stale "no output files found" warnings from a clean turbo build. No behavior change.

## 0.0.1

### Patch Changes

- a551702: Reconcile the visual-audit findings ledger against a full 48-route verification pass:
  82 findings flip to fixed, 125 stay open, the 14 accepted are preserved. Data-only
  change to `findings.toml`; no reconcile logic changed.
