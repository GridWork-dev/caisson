# @caisson/license-issue

## 1.0.9

### Patch Changes

- Updated dependencies [7d39669]
- Updated dependencies [cd694f1]
- Updated dependencies [87b07c6]
- Updated dependencies [7d39669]
- Updated dependencies [498b279]
  - @caisson/license-verify@0.3.10
  - @caisson/ui@0.6.7
  - @caisson/kernel@0.10.0

## 1.0.8

### Patch Changes

- 2405d9e: Remove unused dependencies and unreferenced internal helpers, relocate integration coverage to the package seams it verifies, and consolidate repeated build and test plumbing. The CLI no longer exports the obsolete minimal `defaultEngine`; use `templatesEngine` or inject a `GeneratorEngine`.
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
- Updated dependencies [886e1e7]
- Updated dependencies [e190797]
- Updated dependencies [87275f6]
  - @caisson/kernel@0.9.0
  - @caisson/ui@0.6.6
  - @caisson/license-verify@0.3.9

## 1.0.7

### Patch Changes

- Updated dependencies [98bf1f3]
- Updated dependencies [68df709]
- Updated dependencies [7d74f8f]
  - @caisson/ui@0.6.5
  - @caisson/kernel@0.8.0
  - @caisson/license-verify@0.3.8

## 1.0.6

### Patch Changes

- Updated dependencies [e917c52]
- Updated dependencies [f2cb853]
- Updated dependencies [b5cd9d6]
  - @caisson/kernel@0.7.0
  - @caisson/ui@0.6.4
  - @caisson/license-verify@0.3.7

## 1.0.5

### Patch Changes

- Updated dependencies [6d1c805]
- Updated dependencies [a00a9ef]
- Updated dependencies [96aa01d]
- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
- Updated dependencies [2cd4184]
- Updated dependencies [6d1c805]
- Updated dependencies [56e46f1]
  - @caisson/ui@0.6.3
  - @caisson/kernel@0.6.0
  - @caisson/license-verify@0.3.6

## 1.0.4

### Patch Changes

- c36b9e2: Builds now compile with the native TypeScript 7 compiler. The emitted type declarations are unchanged in API; some inferred type members appear in a different order in .d.ts files. Aggregate compile time drops roughly sevenfold.
- Updated dependencies [cd48b89]
- Updated dependencies [bd071c9]
- Updated dependencies [c36b9e2]
  - @caisson/ui@0.6.2
  - @caisson/kernel@0.5.3
  - @caisson/license-verify@0.3.5

## 1.0.3

### Patch Changes

- Updated dependencies [fc0bb99]
  - @caisson/kernel@0.5.2
  - @caisson/license-verify@0.3.4

## 1.0.2

### Patch Changes

- Updated dependencies [7de6fa4]
  - @caisson/kernel@0.5.1
  - @caisson/license-verify@0.3.3

## 1.0.1

### Patch Changes

- Updated dependencies [e5e4311]
- Updated dependencies [809592d]
- Updated dependencies [809592d]
- Updated dependencies [e183860]
  - @caisson/kernel@0.5.0
  - @caisson/ui@0.6.1
  - @caisson/license-verify@0.3.2

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
