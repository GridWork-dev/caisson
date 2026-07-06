# @caisson/auth

## 0.2.3

### Patch Changes

- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
  - @caisson/kernel@0.4.1
  - @caisson/tenancy-rls@0.3.2

## 0.2.2

### Patch Changes

- Updated dependencies [fb8d966]
  - @caisson/kernel@0.4.0
  - @caisson/tenancy-rls@0.3.1

## 0.2.1

### Patch Changes

- Updated dependencies [b5915e0]
- Updated dependencies [e62c88d]
- Updated dependencies [ccf8b10]
- Updated dependencies [afa6070]
- Updated dependencies [95103b6]
- Updated dependencies [549dd4e]
  - @caisson/tenancy-rls@0.3.0
  - @caisson/kernel@0.3.0

## 0.2.0

### Minor Changes

- 9483a36: Initial public release (0.1.0). The open Base substrate (Apache-2.0) publishes to
  public npm; the commercial editions, primitives, and generator publish to a restricted
  registry. Versions were aligned to 0.1.0 for this release.

### Patch Changes

- 22077d1: Security hardening: account-token verification failures now collapse to one
  generic reason instead of leaking which check failed; judge-graded verdicts validate
  fail-closed and judge output is bounded; MCP module generation bounds its id/version
  strings against oversized input; the agent-dev config emitter escapes free-text
  frontmatter so its tool allowlist can't be suppressed; the guardrails deny-list check is
  stateless across calls; prompt rendering bounds template-variable and total output size.
- a07feb0: Compliance now bundles `@caisson/alerting` and `@caisson/retention-runner`, and
  Agentic-Dev bundles `@caisson/tool-exec`, at no extra cost over the edition price.

  Also: `@caisson/auth`'s manifest now declares its real `@caisson/tenancy-rls` dependency
  (it imports it in `schema.ts`/`membership.ts`), and `@caisson/field-crypto` extracts the
  `KmsClient` port to a leaf `kms-port.ts` to break a type cycle between its KMS modules.
  `KmsClient` is still re-exported from `kms.ts` for back-compat.

- Updated dependencies [69817a1]
- Updated dependencies [9483a36]
  - @caisson/kernel@0.2.0
  - @caisson/tenancy-rls@0.2.0
