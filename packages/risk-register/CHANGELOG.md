# @caisson/risk-register

## 0.3.5

### Patch Changes

- Updated dependencies [045b21e]
- Updated dependencies [87b07c6]
- Updated dependencies [7d39669]
- Updated dependencies [498b279]
  - @caisson/audit-worm@2.2.4
  - @caisson/kernel@0.10.0
  - @caisson/frameworks-pack@0.8.2

## 0.3.4

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
  - @caisson/audit-worm@2.2.3
  - @caisson/frameworks-pack@0.8.1

## 0.3.3

### Patch Changes

- Updated dependencies [74f0756]
- Updated dependencies [7d74f8f]
  - @caisson/frameworks-pack@0.8.0
  - @caisson/kernel@0.8.0
  - @caisson/audit-worm@2.2.2

## 0.3.2

### Patch Changes

- f2cb853: `@caisson/kernel`'s main entry point is now browser-safe. Everything that needs a Node built-in — constant-time secret comparison, audit-chain hashing, migration assembly, and the SSRF guard — moved to a new `@caisson/kernel/node` entry point. The main entry keeps the error model, the strict-schema helpers, canonical serialization and the audit-chain types, the money and version types, the timeout-bounded fetch, and the event sink.

  Server-side code that used one of the moved functions changes a single import path: `@caisson/kernel/node` re-exports the main entry in full, so nothing else in that import list has to move. Nothing changed about what any of these functions do.

  This is what lets packages built on the kernel — the trust-page generator and the artifact renderer among them — be imported directly into a browser bundle. Previously any import of the kernel dragged Node's crypto and DNS modules along with it, and a front end had to keep its own hand-written copy of that logic in step by hand. `@caisson/frameworks-pack` gains a matching `@caisson/frameworks-pack/registry` entry point exposing the control model on its own, for the same reason; its main entry is unchanged.

- Updated dependencies [e917c52]
- Updated dependencies [f2cb853]
  - @caisson/kernel@0.7.0
  - @caisson/frameworks-pack@0.7.0
  - @caisson/audit-worm@2.2.1

## 0.3.1

### Patch Changes

- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
- Updated dependencies [a21c478]
  - @caisson/audit-worm@2.2.0
  - @caisson/kernel@0.6.0
  - @caisson/frameworks-pack@0.6.1

## 0.3.0

### Minor Changes

- 1c5c137: The risk register is now sold à la carte at $279 and included in the Compliance and
  Everything bundles: likelihood x impact scoring with a computed residual, operator
  overrides recorded as chained exceptions, crosswalks into shipped framework packs,
  and a risk-treatment-plan evidence artifact.

## 0.2.0

### Minor Changes

- fa79938: New risk register: score any risk by likelihood and impact, and the residual severity is always
  computed from that rating — there is no field for typing in a number by hand. An operator override
  is never a silent edit either: it is recorded as its own exception, with who asserted it, why, and
  when, on the tenant's write-once audit chain, so the original computed score stays recoverable even
  after an override is in force. Every entry can point at any framework module's controls, and a
  register can be exported as a treatment-plan summary. Not sold individually yet.

### Patch Changes

- Updated dependencies [ff2cc46]
  - @caisson/frameworks-pack@0.6.0
