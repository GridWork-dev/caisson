# @caisson/app-compliance

## 0.0.18

### Patch Changes

- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
- Updated dependencies [13e814d]
- Updated dependencies [0d87855]
- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
- Updated dependencies [a21c478]
- Updated dependencies [96aa01d]
  - @caisson/audit-worm@2.2.0
  - @caisson/compliance@1.0.0
  - @caisson/field-crypto@1.0.0
  - @caisson/kernel@0.6.0
  - @caisson/tenancy-rls@0.5.6

## 0.0.17

### Patch Changes

- Updated dependencies [1c5c137]
  - @caisson/compliance@0.6.0

## 0.0.16

### Patch Changes

- @caisson/compliance@0.5.10

## 0.0.15

### Patch Changes

- Updated dependencies [bd071c9]
- Updated dependencies [c36b9e2]
  - @caisson/audit-worm@2.1.4
  - @caisson/compliance@0.5.9
  - @caisson/field-crypto@0.3.5
  - @caisson/kernel@0.5.3
  - @caisson/tenancy-rls@0.5.5

## 0.0.14

### Patch Changes

- @caisson/compliance@0.5.8

## 0.0.13

### Patch Changes

- Updated dependencies [fc0bb99]
  - @caisson/kernel@0.5.2
  - @caisson/audit-worm@2.1.3
  - @caisson/compliance@0.5.7
  - @caisson/field-crypto@0.3.4
  - @caisson/tenancy-rls@0.5.4

## 0.0.12

### Patch Changes

- Updated dependencies [7de6fa4]
  - @caisson/kernel@0.5.1
  - @caisson/audit-worm@2.1.2
  - @caisson/compliance@0.5.6
  - @caisson/field-crypto@0.3.3
  - @caisson/tenancy-rls@0.5.3

## 0.0.11

### Patch Changes

- @caisson/compliance@0.5.5
- @caisson/audit-worm@2.1.1

## 0.0.10

### Patch Changes

- Updated dependencies [3fdc6a8]
  - @caisson/compliance@0.5.4

## 0.0.9

### Patch Changes

- Updated dependencies [1de88d7]
  - @caisson/audit-worm@2.1.0
  - @caisson/compliance@0.5.3

## 0.0.8

### Patch Changes

- Updated dependencies [ca44db5]
- Updated dependencies [1867fa3]
- Updated dependencies [e5e4311]
- Updated dependencies [e5e4311]
- Updated dependencies [c186409]
- Updated dependencies [e183860]
  - @caisson/audit-worm@2.0.0
  - @caisson/kernel@0.5.0
  - @caisson/compliance@0.5.2
  - @caisson/field-crypto@0.3.2
  - @caisson/tenancy-rls@0.5.2

## 0.0.7

### Patch Changes

- Updated dependencies [1bc677a]
- Updated dependencies [2b65cf3]
- Updated dependencies [8253e76]
  - @caisson/audit-worm@1.0.0
  - @caisson/kernel@0.4.3
  - @caisson/tenancy-rls@0.5.1
  - @caisson/compliance@0.5.1
  - @caisson/field-crypto@0.3.1

## 0.0.6

### Patch Changes

- Internal hygiene wave: the standards gate's locked-price table moved the Compliance bundle to its
  current price and gained rows for the two retired alias packages; the four private reference apps
  and the root manifest now carry an explicit license field; the license service applies the new
  Developer-plan coverage semantics when computing signed license claims.
- Updated dependencies [8c53ca3]
- Updated dependencies
- Updated dependencies [8c53ca3]
- Updated dependencies [8c53ca3]
- Updated dependencies
  - @caisson/audit-worm@0.3.0
  - @caisson/compliance@0.5.0
  - @caisson/field-crypto@0.3.0
  - @caisson/tenancy-rls@0.5.0

## 0.0.5

### Patch Changes

- Updated dependencies [b791198]
- Updated dependencies [aec9f1c]
- Updated dependencies [f01b6ed]
- Updated dependencies [0c883ae]
- Updated dependencies [aec9f1c]
- Updated dependencies [0af4dbf]
- Updated dependencies [0af4dbf]
  - @caisson/audit-worm@0.2.4
  - @caisson/compliance@0.4.0
  - @caisson/field-crypto@0.2.4
  - @caisson/kernel@0.4.2
  - @caisson/tenancy-rls@0.4.0

## 0.0.4

### Patch Changes

- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
  - @caisson/audit-worm@0.2.3
  - @caisson/compliance@0.3.1
  - @caisson/field-crypto@0.2.3
  - @caisson/kernel@0.4.1
  - @caisson/tenancy-rls@0.3.2

## 0.0.3

### Patch Changes

- Updated dependencies [93770dd]
- Updated dependencies [fb8d966]
- Updated dependencies [fb8d966]
  - @caisson/compliance@0.3.0
  - @caisson/kernel@0.4.0
  - @caisson/audit-worm@0.2.2
  - @caisson/field-crypto@0.2.2
  - @caisson/tenancy-rls@0.3.1

## 0.0.2

### Patch Changes

- Updated dependencies [b5915e0]
- Updated dependencies [e62c88d]
- Updated dependencies [ccf8b10]
- Updated dependencies [afa6070]
- Updated dependencies [081a1d8]
- Updated dependencies [95103b6]
- Updated dependencies [f9d58c4]
- Updated dependencies [549dd4e]
  - @caisson/tenancy-rls@0.3.0
  - @caisson/kernel@0.3.0
  - @caisson/field-crypto@0.2.1
  - @caisson/audit-worm@0.2.1
  - @caisson/compliance@0.2.1

## 0.0.1

### Patch Changes

- 84052aa: Backlog P3 defense-in-depth (from the PR#35 sibling sweep; all private apps, no publish):

  - `@caisson/site`: `AddMemberInput` gains `.strict()` for boundary-schema floor consistency (behavior
    unchanged — the parse object is hand-built, owner-gated, RLS-scoped, parameterized).
  - `@caisson/local-ai-app` + `@caisson/app-compliance`: the demo field-crypto paths (`demoProvider` /
    `createLegHarness`) now **fail closed under `NODE_ENV=production`** instead of silently using the fixed
    demo key vector. Neither app is a deployed service and both handle only synthetic data, so this never
    fires today (tests run under `NODE_ENV=test`; the compliance leg is golden-deterministic so `fromEnv`
    is deliberately NOT used) — pure defense-in-depth against a future deploy routing real data through.

- Updated dependencies [72ffd85]
- Updated dependencies
- Updated dependencies [59d332f]
- Updated dependencies [57170c5]
- Updated dependencies [69817a1]
- Updated dependencies [fcd5131]
- Updated dependencies [a07feb0]
- Updated dependencies [9483a36]
  - @caisson/field-crypto@0.2.0
  - @caisson/compliance@0.2.0
  - @caisson/audit-worm@0.2.0
  - @caisson/kernel@0.2.0
  - @caisson/tenancy-rls@0.2.0
