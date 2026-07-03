# @caisson/app-compliance

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
