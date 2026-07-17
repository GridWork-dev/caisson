# @caisson/local-ai-app

## 0.0.8

### Patch Changes

- Updated dependencies [e5e4311]
- Updated dependencies [e183860]
  - @caisson/kernel@0.5.0
  - @caisson/field-crypto@0.3.2
  - @caisson/license-verify@0.3.2
  - @caisson/local-ai@0.2.7
  - @caisson/local-inference@0.1.3
  - @caisson/local-privacy@0.1.3
  - @caisson/local-store@1.0.1
  - @caisson/local-sync@0.1.3

## 0.0.7

### Patch Changes

- Updated dependencies [317bad5]
- Updated dependencies [2b65cf3]
- Updated dependencies [2b65cf3]
- Updated dependencies [329150a]
- Updated dependencies [679cce6]
- Updated dependencies [1bc677a]
- Updated dependencies [8253e76]
  - @caisson/license-verify@0.3.1
  - @caisson/kernel@0.4.3
  - @caisson/local-ai@0.2.6
  - @caisson/local-store@1.0.0
  - @caisson/field-crypto@0.3.1
  - @caisson/local-inference@0.1.2
  - @caisson/local-privacy@0.1.2
  - @caisson/local-sync@0.1.2

## 0.0.6

### Patch Changes

- Updated dependencies [8c53ca3]
- Updated dependencies
  - @caisson/field-crypto@0.3.0
  - @caisson/local-inference@0.1.1
  - @caisson/local-privacy@0.1.1
  - @caisson/local-sync@0.1.1
  - @caisson/local-ai@0.2.5

## 0.0.5

### Patch Changes

- bc12f3a: Carve local-first privacy, inference, and sync into separately priced commercial modules.
- Updated dependencies [b791198]
- Updated dependencies [bc12f3a]
- Updated dependencies [2834c3f]
- Updated dependencies [90b6dc1]
- Updated dependencies [f178f9a]
- Updated dependencies [9efcff2]
- Updated dependencies [9efcff2]
- Updated dependencies [4d7eb71]
- Updated dependencies [0af4dbf]
- Updated dependencies [0af4dbf]
- Updated dependencies [0af4dbf]
- Updated dependencies [4d7eb71]
  - @caisson/field-crypto@0.2.4
  - @caisson/kernel@0.4.2
  - @caisson/license-verify@0.3.0
  - @caisson/local-ai@0.2.4
  - @caisson/local-store@0.2.4
  - @caisson/local-inference@0.1.0
  - @caisson/local-privacy@0.1.0
  - @caisson/local-sync@0.1.0

## 0.0.4

### Patch Changes

- @caisson/local-ai@0.2.3

## 0.0.3

### Patch Changes

- @caisson/local-ai@0.2.2

## 0.0.2

### Patch Changes

- Updated dependencies [081a1d8]
  - @caisson/local-ai@0.2.1

## 0.0.1

### Patch Changes

- 84052aa: Defense-in-depth hardening (all private apps, no publish):

  - `@caisson/site`: `AddMemberInput` gains `.strict()` for boundary-schema floor consistency (behavior
    unchanged — the parse object is hand-built, owner-gated, RLS-scoped, parameterized).
  - `@caisson/local-ai-app` + `@caisson/app-compliance`: the demo field-crypto paths (`demoProvider` /
    `createLegHarness`) now **fail closed under `NODE_ENV=production`** instead of silently using the fixed
    demo key vector. Neither app is a deployed service and both handle only synthetic data, so this never
    fires today (tests run under `NODE_ENV=test`; the compliance leg is golden-deterministic so `fromEnv`
    is deliberately NOT used) — pure defense-in-depth against a future deploy routing real data through.

- Updated dependencies [57170c5]
- Updated dependencies
- Updated dependencies [9483a36]
  - @caisson/local-ai@0.2.0
