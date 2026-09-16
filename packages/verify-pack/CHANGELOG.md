# @caisson/verify-pack

## 0.2.4

### Patch Changes

- Updated dependencies [87b07c6]
- Updated dependencies [7d39669]
- Updated dependencies [498b279]
  - @caisson/kernel@0.10.0

## 0.2.3

### Patch Changes

- 87275f6: Replace ESLint and Prettier with oxlint and oxfmt.

  Linting and formatting now run on the oxc toolchain. The rule floor is unchanged: the same
  no-any, no-console, type-only-import and provider-SDK-boundary rules are enforced, at the same
  severities, and formatting keeps the settings the previous formatter used. Every package here is
  touched by the dependency removal or by the one-pass reformat, so each takes a patch bump; no
  runtime behaviour changes.

  For anyone consuming the shared configuration: the lint config package is renamed, and the lint
  and format commands changed.

- b0e66b6: Prepare the out-of-band audit evidence-pack verifier for its first release. It validates the complete-file manifest, pack seal, receipt chain, and row-anchor signatures without trusting executable code from the pack.
- Updated dependencies [f669d4a]
- Updated dependencies [b0e66b6]
- Updated dependencies [2609293]
- Updated dependencies [87275f6]
  - @caisson/kernel@0.9.0

## 0.2.2

### Patch Changes

- Updated dependencies [7d74f8f]
  - @caisson/kernel@0.8.0

## 0.2.1

### Patch Changes

- Updated dependencies [e917c52]
- Updated dependencies [f2cb853]
  - @caisson/kernel@0.7.0

## 0.2.0

### Minor Changes

- 31bf5f1: Evidence packs now use a v2 detached seal over a canonical manifest containing every exported file
  name and SHA-256 digest, and no longer embed executable verifier code. The new commercial
  `@caisson/verify-pack` package is the independently obtained verification path and requires an
  issuer-key fingerprint obtained independently from the pack before it can report PASS.

### Patch Changes

- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
  - @caisson/kernel@0.6.0

## 0.1.0

### Minor Changes

- Initial out-of-band audit evidence-pack verifier with an independently supplied issuer-key
  fingerprint.
