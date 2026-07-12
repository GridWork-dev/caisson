# @caisson/frameworks-pack

## 0.3.0

### Minor Changes

- 09ed1c8: Add SOC 2, PCI DSS, and GDPR named-regime crosswalks to the compliance framework pack. Each
  crosswalk maps the regime's control ids to the specific Caisson module and mechanism that addresses
  them, with a machine-readable claim level per row: "implements" only where a live test in the
  repository proves the technical control (and that proof is linked on the row), "maps to" everywhere
  else. Every row also states what remains the buyer's responsibility. Each crosswalk exports as a
  self-contained artifact with the regime revision pinned and a scope disclaimer embedded, so a
  reviewer reading it outside the website sees exactly what is and is not covered — the crosswalks are
  mappings, not a certification or a claim of compliance.

### Patch Changes

- Updated dependencies [2b65cf3]
- Updated dependencies [8253e76]
  - @caisson/kernel@0.4.3

## 0.2.0

### Minor Changes

- f01b6ed: Splits the Compliance edition into three separately purchasable modules — the framework
  catalogs (`@caisson/frameworks-pack`), the per-tenant evidence signer
  (`@caisson/signing-primitive`), and the evidence engine (`@caisson/compliance-core`) — while
  the Compliance edition keeps composing all three. The public API is unchanged: every symbol
  that was importable from `@caisson/compliance` still is.

### Patch Changes

- Updated dependencies [b791198]
- Updated dependencies [0af4dbf]
  - @caisson/kernel@0.4.2
