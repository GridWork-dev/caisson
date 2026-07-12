# @caisson/license-issue

## 1.0.0

### Minor Changes

- 1bc677a: Add an optional embeddable issuance-log surface at the `@caisson/license-issue/ui` subpath for the
  admin issuer app. It renders the issued-license records — tier, live/expired status, entitlement
  count, and coverage — with the active-vs-total split up front. The surface is read-only and
  server-render safe: it holds no signing key and opens no database, drawing only the records handed
  to it, and composes the `@caisson/ui` kit. Importing the package root stays React-free.

### Patch Changes

- Updated dependencies [08fd857]
- Updated dependencies [0137008]
- Updated dependencies [317bad5]
- Updated dependencies [2b65cf3]
- Updated dependencies [5a8b317]
- Updated dependencies [8253e76]
- Updated dependencies [f903014]
- Updated dependencies [eff7248]
- Updated dependencies [47e04fd]
- Updated dependencies [51e3ed0]
- Updated dependencies [b5a3690]
- Updated dependencies [b5a3690]
- Updated dependencies [51e3ed0]
- Updated dependencies [c905c61]
- Updated dependencies [2c93128]
- Updated dependencies [b7e58a8]
- Updated dependencies [b43959c]
  - @caisson/ui@0.6.0
  - @caisson/license-verify@0.3.1
  - @caisson/kernel@0.4.3

## 0.0.6

### Patch Changes

- Added a README to each package describing what it provides, how to install or reference it, and a short usage example built from its real exports. No runtime behavior changed.

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
