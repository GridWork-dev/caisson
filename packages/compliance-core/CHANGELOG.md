# @caisson/compliance-core

## 0.2.0

### Minor Changes

- f01b6ed: Splits the Compliance edition into three separately purchasable modules — the framework
  catalogs (`@caisson/frameworks-pack`), the per-tenant evidence signer
  (`@caisson/signing-primitive`), and the evidence engine (`@caisson/compliance-core`) — while
  the Compliance edition keeps composing all three. The public API is unchanged: every symbol
  that was importable from `@caisson/compliance` still is.

### Patch Changes

- Updated dependencies [b791198]
- Updated dependencies [f01b6ed]
- Updated dependencies [0af4dbf]
  - @caisson/field-crypto@0.2.4
  - @caisson/kernel@0.4.2
  - @caisson/frameworks-pack@0.2.0
