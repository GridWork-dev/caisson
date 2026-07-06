# @caisson/license-issue

## 0.0.5

### Patch Changes

- b791198: Documentation and metadata cleanup plus dependency-declaration hygiene: package descriptions, READMEs, changelogs, and source comments no longer carry internal build references, and shared external dependency ranges now resolve through the workspace dependency catalog (published dependency ranges unchanged; the TypeScript devDependency floor moves to ^5.7.3).
- 2834c3f: Bundle upgrade crediting and snapshot-at-sale entitlements. The price book gains a pre-declared item-to-bundle credit map: upgrading from modules you already own to a bundle now credits each owned member's retail against the bundle price, floored at zero, from one source the checkout reads rather than any ad-hoc arithmetic. A companion bundle-membership timeline records when each member joined each bundle. Licenses gain a per-purchase snapshot record so a bundle purchase delivers exactly the member set as of the sale date, filtered fail-soft at the resolver; missing data always favors full access, and older licenses keep unrestricted access unchanged.
- 0af4dbf: Rewrote README, AGENTS, CHANGELOG, package.json descriptions, and inline source comments to
  read as clean, buyer-facing documentation. Removed sibling-repository provenance framing,
  internal build-phase shorthand, and bare specification-id citations that had leaked into
  shipped copy. No runtime behavior changed in any package — documentation and comments only.
- 4d7eb71: License claims now track each purchased module or edition's own 12-month updates window instead of one window for the whole account. Renewing one module extends only that module — your other purchases keep their own dates, and a fresh purchase always gets a full fresh window rather than inheriting an older one. A token without any window info, or missing an entry for a given purchase, is treated as unrestricted, so every license issued before this change keeps working exactly as before. When a module is covered by more than one purchase (say, bought individually and again as part of a bundle), you always get the better of the two windows.
- Updated dependencies [b791198]
- Updated dependencies [2834c3f]
- Updated dependencies [90b6dc1]
- Updated dependencies [f178f9a]
- Updated dependencies [9efcff2]
- Updated dependencies [0af4dbf]
- Updated dependencies [4d7eb71]
  - @caisson/kernel@0.4.2
  - @caisson/license-verify@0.3.0

## 0.0.4

### Patch Changes

- Updated dependencies [cf66d65]
  - @caisson/kernel@0.4.1
  - @caisson/license-verify@0.2.3

## 0.0.3

### Patch Changes

- Updated dependencies [fb8d966]
  - @caisson/kernel@0.4.0
  - @caisson/license-verify@0.2.2

## 0.0.2

### Patch Changes

- Updated dependencies [e62c88d]
- Updated dependencies [ccf8b10]
- Updated dependencies [549dd4e]
  - @caisson/kernel@0.3.0
  - @caisson/license-verify@0.2.1

## 0.0.1

### Patch Changes

- Updated dependencies [69817a1]
- Updated dependencies [9483a36]
  - @caisson/kernel@0.2.0
  - @caisson/license-verify@0.2.0
