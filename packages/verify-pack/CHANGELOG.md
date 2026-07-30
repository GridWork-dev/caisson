# @caisson/verify-pack

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
