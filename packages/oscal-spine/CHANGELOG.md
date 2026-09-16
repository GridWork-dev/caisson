# @caisson/oscal-spine

## 0.2.2

### Patch Changes

- Updated dependencies [87b07c6]
- Updated dependencies [7d39669]
- Updated dependencies [498b279]
  - @caisson/kernel@0.10.0
  - @caisson/artifact-render@0.2.5

## 0.2.1

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
- Updated dependencies [b0e66b6]
- Updated dependencies [2609293]
- Updated dependencies [87275f6]
  - @caisson/kernel@0.9.0
  - @caisson/artifact-render@0.2.4

## 0.2.0

### Minor Changes

- 74f0756: Both packages gain a browser-safe `./browser` entry point: the contracts and vocabulary, the
  crosswalk model, the catalog pin, the control model with all three framework packs, and the pure
  catalog and assessment-plan exporters can now be imported inside a client bundle. The main entry
  is unchanged and keeps the full node-capable surface; every browser-entry export is also
  available there. As part of this, the catalog and assessment-plan exporters' default id generator
  now uses the runtime's built-in WebCrypto `crypto.randomUUID()` instead of the Node crypto
  module — the same UUID format, and any injected `newId` seam behaves exactly as before — and
  both packages now declare a Node 20.12 minimum. Consumers of the compliance-core re-export
  receive the same default-id change.

### Patch Changes

- Updated dependencies [7d74f8f]
  - @caisson/kernel@0.8.0
  - @caisson/artifact-render@0.2.3

## 0.1.1

### Patch Changes

- f2cb853: `@caisson/kernel`'s main entry point is now browser-safe. Everything that needs a Node built-in — constant-time secret comparison, audit-chain hashing, migration assembly, and the SSRF guard — moved to a new `@caisson/kernel/node` entry point. The main entry keeps the error model, the strict-schema helpers, canonical serialization and the audit-chain types, the money and version types, the timeout-bounded fetch, and the event sink.

  Server-side code that used one of the moved functions changes a single import path: `@caisson/kernel/node` re-exports the main entry in full, so nothing else in that import list has to move. Nothing changed about what any of these functions do.

  This is what lets packages built on the kernel — the trust-page generator and the artifact renderer among them — be imported directly into a browser bundle. Previously any import of the kernel dragged Node's crypto and DNS modules along with it, and a front end had to keep its own hand-written copy of that logic in step by hand. `@caisson/frameworks-pack` gains a matching `@caisson/frameworks-pack/registry` entry point exposing the control model on its own, for the same reason; its main entry is unchanged.

- Updated dependencies [e917c52]
- Updated dependencies [f2cb853]
  - @caisson/kernel@0.7.0
  - @caisson/artifact-render@0.2.2

## 0.1.0

### Minor Changes

- a21c478: Adds the standalone $249 OSCAL spine with assessment, results, POA&M, catalog, XML, ISO 27001,
  NIST 800-53, and OLIR support while preserving both parent packages' public exports. The module
  joins Compliance, moving Compliance to $1,649 with a $659 renewal and Everything to $2,259 with
  an $899 renewal.

### Patch Changes

- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
  - @caisson/kernel@0.6.0
  - @caisson/artifact-render@0.2.1

This package is versioned by Changesets. Published entries are append-only.
