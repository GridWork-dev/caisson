# @caisson-sh/demo-registry

## 0.2.18

### Patch Changes

- Updated dependencies [12c6867]
- Updated dependencies [304851a]
  - @caisson-sh/audit-harness@1.0.5
  - @caisson-sh/audit-worm@2.2.6
  - @caisson-sh/ai-meter@1.1.5
  - @caisson-sh/local-store@1.1.4
  - @caisson-sh/prompt-registry@1.1.4
  - @caisson-sh/ui-pro@0.3.10

## 0.2.17

### Patch Changes

- 73bdf3c: The site, demos and internal tooling follow the move to Apache-2.0: the gate now requires every published package to be Apache-2.0 with its LICENSE file, the commerce and entitlement checks are gone, and the docs install everything from public npm.
- Updated dependencies [eb2648e]
- Updated dependencies [73bdf3c]
- Updated dependencies [73bdf3c]
- Updated dependencies [784a846]
- Updated dependencies [611f1de]
- Updated dependencies [784a846]
- Updated dependencies [73bdf3c]
- Updated dependencies [73bdf3c]
- Updated dependencies [0b02891]
  - @caisson-sh/ui-pro@0.3.9
  - @caisson-sh/ai-meter@1.1.4
  - @caisson-sh/audit-worm@2.2.5
  - @caisson-sh/local-store@1.1.3
  - @caisson-sh/prompt-registry@1.1.3
  - @caisson-sh/ui@0.6.8
  - @caisson-sh/audit-harness@1.0.4

## 0.2.16

### Patch Changes

- Updated dependencies [045b21e]
- Updated dependencies [f02b193]
- Updated dependencies [cd694f1]
- Updated dependencies [ecfa65e]
  - @caisson/local-store@1.1.2
  - @caisson/audit-worm@2.2.4
  - @caisson/ui@0.6.7
  - @caisson/audit-harness@1.0.3
  - @caisson/license-issue@1.0.9
  - @caisson/ai-meter@1.1.3
  - @caisson/prompt-registry@1.1.2
  - @caisson/ui-pro@0.3.8

## 0.2.15

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

- b0e66b6: Move the internal audit harness and shared component demo catalog into the tooling workspace namespace. Package names and import paths are unchanged.
- Updated dependencies [2405d9e]
- Updated dependencies [b0e66b6]
- Updated dependencies [886e1e7]
- Updated dependencies [e190797]
- Updated dependencies [87275f6]
- Updated dependencies [b0e66b6]
  - @caisson/audit-harness@1.0.2
  - @caisson/license-issue@1.0.8
  - @caisson/local-store@1.1.1
  - @caisson/ui@0.6.6
  - @caisson/ui-pro@0.3.7
  - @caisson/ai-meter@1.1.2
  - @caisson/audit-worm@2.2.3
  - @caisson/prompt-registry@1.1.1

## 0.2.14

### Patch Changes

- @caisson/license-issue@1.0.7
- @caisson/ai-meter@1.1.1

## 0.2.13

### Patch Changes

- Updated dependencies [98bf1f3]
- Updated dependencies [5d1f295]
- Updated dependencies [42d9710]
- Updated dependencies [e19da1d]
- Updated dependencies [68df709]
  - @caisson/ui@0.6.5
  - @caisson/prompt-registry@1.1.0
  - @caisson/local-store@1.1.0
  - @caisson/ai-meter@1.1.0
  - @caisson/audit-harness@1.0.1
  - @caisson/audit-worm@2.2.2
  - @caisson/license-issue@1.0.7
  - @caisson/ui-pro@0.3.6

## 0.2.12

### Patch Changes

- Updated dependencies [f2cb853]
- Updated dependencies [b5cd9d6]
  - @caisson/audit-worm@2.2.1
  - @caisson/ui@0.6.4
  - @caisson/license-issue@1.0.6
  - @caisson/ai-meter@1.0.11
  - @caisson/local-store@1.0.6
  - @caisson/prompt-registry@1.0.6
  - @caisson/ui-pro@0.3.5
  - @caisson/audit-harness@1.0.1

## 0.2.11

### Patch Changes

- Updated dependencies [6d1c805]
- Updated dependencies [31bf5f1]
- Updated dependencies [a00a9ef]
- Updated dependencies [96aa01d]
- Updated dependencies [31bf5f1]
- Updated dependencies [2cd4184]
- Updated dependencies [96aa01d]
- Updated dependencies [6d1c805]
- Updated dependencies [56e46f1]
  - @caisson/ui@0.6.3
  - @caisson/audit-worm@2.2.0
  - @caisson/ai-meter@1.0.10
  - @caisson/local-store@1.0.5
  - @caisson/prompt-registry@1.0.5
  - @caisson/audit-harness@1.0.1
  - @caisson/license-issue@1.0.5
  - @caisson/ui-pro@0.3.4

## 0.2.10

### Patch Changes

- @caisson/license-issue@1.0.4
- @caisson/ai-meter@1.0.9

## 0.2.9

### Patch Changes

- c36b9e2: Builds now compile with the native TypeScript 7 compiler. The emitted type declarations are unchanged in API; some inferred type members appear in a different order in .d.ts files. Aggregate compile time drops roughly sevenfold.
- 16de8df: Declares each package's type-check-only `build` task as producing no cacheable output (`outputs: []`), clearing the five stale "no output files found" warnings from a clean turbo build. No behavior change.
- Updated dependencies [bd071c9]
- Updated dependencies [cd48b89]
- Updated dependencies [bd071c9]
- Updated dependencies [c36b9e2]
  - @caisson/audit-worm@2.1.4
  - @caisson/ui@0.6.2
  - @caisson/ai-meter@1.0.8
  - @caisson/audit-harness@1.0.1
  - @caisson/license-issue@1.0.4
  - @caisson/local-store@1.0.4
  - @caisson/prompt-registry@1.0.4
  - @caisson/ui-pro@0.3.3

## 0.2.8

### Patch Changes

- @caisson/license-issue@1.0.3
- @caisson/ai-meter@1.0.7

## 0.2.7

### Patch Changes

- @caisson/ai-meter@1.0.6
- @caisson/audit-worm@2.1.3
- @caisson/license-issue@1.0.3
- @caisson/local-store@1.0.3
- @caisson/prompt-registry@1.0.3
- @caisson/ui-pro@0.3.2

## 0.2.6

### Patch Changes

- @caisson/license-issue@1.0.2
- @caisson/ai-meter@1.0.5
- @caisson/audit-worm@2.1.2
- @caisson/local-store@1.0.2
- @caisson/prompt-registry@1.0.2
- @caisson/ui-pro@0.3.1

## 0.2.5

### Patch Changes

- Updated dependencies [9d50e7c]
  - @caisson/ai-meter@1.0.4
  - @caisson/license-issue@1.0.1
  - @caisson/audit-worm@2.1.1

## 0.2.4

### Patch Changes

- Updated dependencies [1de88d7]
  - @caisson/audit-worm@2.1.0

## 0.2.3

### Patch Changes

- @caisson/license-issue@1.0.1
- @caisson/ai-meter@1.0.3

## 0.2.2

### Patch Changes

- @caisson/license-issue@1.0.1
- @caisson/ai-meter@1.0.2

## 0.2.1

### Patch Changes

- 59e1365: TypeScript bridge to 6.0.3 (Kickoff T task 5, re-derived version map): the workspace catalog moves
  from ^5.7.3 to ^6.0.3 (the stable JS-compiler transition release; 7.x is the native compiler whose
  stable API waits for 7.1). standards-gate pins its own typescript to ^6.0.3 explicitly so a future
  catalog move to 7.x cannot strand its ts.createScanner usage. brand, ui-pro, and demo-registry gain
  a css.d.ts ambient declaration for the side-effect CSS imports TS 6.0 now checks (TS2882).
- Updated dependencies [ca44db5]
- Updated dependencies [1867fa3]
- Updated dependencies [e5e4311]
- Updated dependencies [e5e4311]
- Updated dependencies [59e1365]
- Updated dependencies [59e1365]
- Updated dependencies [809592d]
- Updated dependencies [809592d]
- Updated dependencies [e183860]
  - @caisson/audit-worm@2.0.0
  - @caisson/ui-pro@0.3.0
  - @caisson/ui@0.6.1
  - @caisson/prompt-registry@1.0.1
  - @caisson/ai-meter@1.0.1
  - @caisson/license-issue@1.0.1
  - @caisson/local-store@1.0.1
  - @caisson/audit-harness@1.0.0

## 0.2.0

### Minor Changes

- 97b0341: A shared component-demo registry, a live operator catalog, and two migrated growth-email
  templates.

  `@caisson/demo-registry` is a new, private, unpublished package: one typed catalog of every
  base-kit, UI Pro, and per-package embeddable component, each entry carrying its owning
  package, license tier, prop variants, and a live demo renderer built from sample data. It
  is the one data source the buyer-facing component gallery and the operator catalog both
  read from, so what ships is what gets demoed — never a second, drifting copy.

  `@caisson/email` gains two more registered templates: `waitlist-welcome` and
  `nurture-follow-up`, migrated from a standalone plain-HTML implementation into the shared
  branded layout used by every other transactional email. Every email the product sends —
  transactional and growth — now renders through one template registry.

  The admin app's design-system section is now the catalog: every component and every email
  template render live with sample data, grouped and filterable by license tier and owning
  package, with a send-test-to-operator action on each email. The marketing site's two
  standalone growth-email builders (never wired to a live sender) are removed in favor of
  the two templates now living in `@caisson/email`; the dev-only email preview page is
  removed too, superseded by the operator catalog.

### Patch Changes

- 51e3ed0: The UI-base demo entry follows the `EditionCard` → `BundleCard` rename in `@caisson/ui`
  (display name + import; the stable `ui.edition-card` demo id is unchanged). Private
  package only; no publishable release.
- Updated dependencies [1bc677a]
- Updated dependencies [1bc677a]
- Updated dependencies [1bc677a]
- Updated dependencies [08fd857]
- Updated dependencies [0137008]
- Updated dependencies [1bc677a]
- Updated dependencies [329150a]
- Updated dependencies [679cce6]
- Updated dependencies [1bc677a]
- Updated dependencies [8670f38]
- Updated dependencies [5a8b317]
- Updated dependencies [8253e76]
- Updated dependencies [1bc677a]
- Updated dependencies [f903014]
- Updated dependencies [eff7248]
- Updated dependencies [b63d107]
- Updated dependencies [47e04fd]
- Updated dependencies [51e3ed0]
- Updated dependencies [b5a3690]
- Updated dependencies [b5a3690]
- Updated dependencies [51e3ed0]
- Updated dependencies [c905c61]
- Updated dependencies [2c93128]
- Updated dependencies [b7e58a8]
- Updated dependencies [b5a3690]
- Updated dependencies [b43959c]
- Updated dependencies [4d85f28]
- Updated dependencies [4c8daa9]
  - @caisson/ai-meter@1.0.0
  - @caisson/audit-harness@1.0.0
  - @caisson/audit-worm@1.0.0
  - @caisson/ui@0.6.0
  - @caisson/license-issue@1.0.0
  - @caisson/local-store@1.0.0
  - @caisson/ui-pro@0.2.0
  - @caisson/prompt-registry@1.0.0
