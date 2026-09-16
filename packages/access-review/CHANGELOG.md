# @caisson/access-review

## 0.3.5

### Patch Changes

- Updated dependencies [498b279]
- Updated dependencies [87b07c6]
- Updated dependencies [7d39669]
- Updated dependencies [498b279]
  - @caisson/tenancy-rls@0.6.1
  - @caisson/kernel@0.10.0
  - @caisson/jobs@0.7.4

## 0.3.4

### Patch Changes

- 87275f6: Replace ESLint and Prettier with oxlint and oxfmt.

  Linting and formatting now run on the oxc toolchain. The rule floor is unchanged: the same
  no-any, no-console, type-only-import and provider-SDK-boundary rules are enforced, at the same
  severities, and formatting keeps the settings the previous formatter used. Every package here is
  touched by the dependency removal or by the one-pass reformat, so each takes a patch bump; no
  runtime behaviour changes.

  For anyone consuming the shared configuration: the lint config package is renamed, and the lint
  and format commands changed.

- Updated dependencies [f669d4a]
- Updated dependencies [2405d9e]
- Updated dependencies [b0e66b6]
- Updated dependencies [2609293]
- Updated dependencies [8993cf7]
- Updated dependencies [1964e9d]
- Updated dependencies [87275f6]
  - @caisson/kernel@0.9.0
  - @caisson/jobs@0.7.3
  - @caisson/tenancy-rls@0.6.0

## 0.3.3

### Patch Changes

- 74f0756: The pure half of the access-review campaign kernel — the decision vocabulary, chain record kinds,
  the decision scan, and the close guard — now lives in its own internal module with no database or
  Node dependencies, and the campaign lifecycle delegates to it, so there is exactly one
  implementation of the close rules. Every public export keeps its name and shape. The site's
  access-review interactive demo now runs that real logic end to end instead of a hand-maintained
  copy.
- Updated dependencies [7d74f8f]
- Updated dependencies [742c979]
  - @caisson/kernel@0.8.0
  - @caisson/jobs@0.7.2
  - @caisson/tenancy-rls@0.5.8

## 0.3.2

### Patch Changes

- Updated dependencies [e917c52]
- Updated dependencies [e917c52]
- Updated dependencies [f2cb853]
  - @caisson/kernel@0.7.0
  - @caisson/jobs@0.7.1
  - @caisson/tenancy-rls@0.5.7

## 0.3.1

### Patch Changes

- 108a358: README refreshed: the module is now a standalone catalog listing and a member of the Compliance and Everything bundles.
- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
  - @caisson/kernel@0.6.0
  - @caisson/jobs@0.7.0
  - @caisson/tenancy-rls@0.5.6

## 0.3.0

### Minor Changes

- 1c5c137: Access reviews are now sold à la carte at $199 and included in the Compliance and
  Everything bundles: audit-prep review campaigns over an imported membership snapshot,
  with per-reviewee attested approve/revoke decisions recorded into the WORM log and
  undecided reviewees flagged, never auto-approved.

## 0.2.0

### Minor Changes

- d9d56b8: New module: access-review campaigns. A reviewer imports a membership roster from CSV or JSON,
  opens a review campaign, and records an approve or revoke decision for each person on the list.
  Every decision is written to the same tamper-evident audit trail the rest of the compliance
  tooling uses, so an auditor can prove the review actually happened rather than trusting a plain
  log. A campaign closes automatically once every reviewer decision is in, or once its deadline
  passes — anyone left undecided is called out explicitly rather than being treated as approved.
  This module is not yet available for purchase.
