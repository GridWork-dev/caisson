# @caisson/local-inference

## 0.1.8

### Patch Changes

- f2cb853: `@caisson/kernel`'s main entry point is now browser-safe. Everything that needs a Node built-in — constant-time secret comparison, audit-chain hashing, migration assembly, and the SSRF guard — moved to a new `@caisson/kernel/node` entry point. The main entry keeps the error model, the strict-schema helpers, canonical serialization and the audit-chain types, the money and version types, the timeout-bounded fetch, and the event sink.

  Server-side code that used one of the moved functions changes a single import path: `@caisson/kernel/node` re-exports the main entry in full, so nothing else in that import list has to move. Nothing changed about what any of these functions do.

  This is what lets packages built on the kernel — the trust-page generator and the artifact renderer among them — be imported directly into a browser bundle. Previously any import of the kernel dragged Node's crypto and DNS modules along with it, and a front end had to keep its own hand-written copy of that logic in step by hand. `@caisson/frameworks-pack` gains a matching `@caisson/frameworks-pack/registry` entry point exposing the control model on its own, for the same reason; its main entry is unchanged.

- Updated dependencies [e917c52]
- Updated dependencies [f2cb853]
  - @caisson/kernel@0.7.0
  - @caisson/local-privacy@0.1.8

## 0.1.7

### Patch Changes

- 36dd6ed: Bedrock rented transport surfaces bounded, credential-scrubbed AWS error diagnostics (`__type`/`message` + a 4KB-capped body) on non-2xx instead of status-only, making live-leg failures diagnosable without echoing SigV4 headers or credentials.
- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
  - @caisson/kernel@0.6.0
  - @caisson/local-privacy@0.1.7

## 0.1.6

### Patch Changes

- c36b9e2: Builds now compile with the native TypeScript 7 compiler. The emitted type declarations are unchanged in API; some inferred type members appear in a different order in .d.ts files. Aggregate compile time drops roughly sevenfold.
- Updated dependencies [c36b9e2]
  - @caisson/kernel@0.5.3
  - @caisson/local-privacy@0.1.6

## 0.1.5

### Patch Changes

- Updated dependencies [fc0bb99]
  - @caisson/kernel@0.5.2
  - @caisson/local-privacy@0.1.5

## 0.1.4

### Patch Changes

- Updated dependencies [7de6fa4]
  - @caisson/kernel@0.5.1
  - @caisson/local-privacy@0.1.4

## 0.1.3

### Patch Changes

- Updated dependencies [e5e4311]
- Updated dependencies [e183860]
  - @caisson/kernel@0.5.0
  - @caisson/local-privacy@0.1.3

## 0.1.2

### Patch Changes

- Updated dependencies [2b65cf3]
- Updated dependencies [8253e76]
  - @caisson/kernel@0.4.3
  - @caisson/local-privacy@0.1.2

## 0.1.1

### Patch Changes

- Added a README to each package describing what it provides, how to install or reference it, and a short usage example built from its real exports. No runtime behavior changed.
- Updated dependencies
  - @caisson/local-privacy@0.1.1

## 0.1.0

### Minor Changes

- bc12f3a: Carve local-first privacy, inference, and sync into separately priced commercial modules.

### Patch Changes

- Updated dependencies [b791198]
- Updated dependencies [bc12f3a]
- Updated dependencies [0af4dbf]
  - @caisson/kernel@0.4.2
  - @caisson/local-privacy@0.1.0
