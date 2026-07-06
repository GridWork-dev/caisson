# @caisson/prompt-registry

## 0.2.4

### Patch Changes

- b791198: Documentation and metadata cleanup plus dependency-declaration hygiene: package descriptions, READMEs, changelogs, and source comments no longer carry internal build references, and shared external dependency ranges now resolve through the workspace dependency catalog (published dependency ranges unchanged; the TypeScript devDependency floor moves to ^5.7.3).
- 0af4dbf: Rewrote README, AGENTS, CHANGELOG, package.json descriptions, and inline source comments to
  read as clean, buyer-facing documentation. Removed sibling-repository provenance framing,
  internal build-phase shorthand, and bare specification-id citations that had leaked into
  shipped copy, and regenerated a couple of stale public-surface sections against the actual
  exports. No runtime behavior changed in any package — documentation and comments only.
- Updated dependencies [b791198]
- Updated dependencies [0c883ae]
- Updated dependencies [0af4dbf]
  - @caisson/kernel@0.4.2
  - @caisson/tenancy-rls@0.4.0

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

- 9483a36: Initial public release (0.1.0) — publish-readiness flip (ADR-0111). The open Base substrate (Apache-2.0, tier `oss`) publishes to public npm; the commercial editions/primitives/generator (tier `paid`) publish to GitHub Packages restricted. Versions were aligned to 0.1.0 in lockstep with the registry ledger; this changeset records the 0.1.0 release and seeds the changeset-presence gate (ADR-0021).

### Patch Changes

- 22077d1: Hardening pass (2026-07-01): emitted buyer CI templates get
  least-privilege `permissions:` + `persist-credentials: false`; verifyAccountJwt failure
  messages collapse to one generic reason (oracle closed); judgeGrader validates live judge
  verdicts fail-closed and judge output is bounded; MCP `generate` modules array + id/version
  strings are bounded with an O(1) pre-parse guard; the agent-dev emitter YAML-escapes all
  free-text frontmatter so the `tools:` allowlist is un-suppressible, and `@caisson/tool-exec`
  is wired into the Agentic-Dev edition (ADR-0199, honoring ADR-0178); guardrails cheapDeny is
  stateless across calls (global-regex lastIndex bypass closed); prompt-registry bounds rawVars
  values and total rendered content. Additional coverage was also added for the admin control
  plane, metering/BYOK paths, destructive job flows, composition roots, and WORM integrity.
- Updated dependencies [69817a1]
- Updated dependencies [9483a36]
  - @caisson/kernel@0.2.0
  - @caisson/tenancy-rls@0.2.0
