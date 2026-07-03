# @caisson/local-store

## 0.2.1

### Patch Changes

- e62c88d: Harvest slice-2 (ADR-0215): guardrails' `guard.ts` gains an unconditional `"secret"`
  `GuardCategory` — a credential-shaped span (AWS/GitHub/OpenAI keys, JWTs, PEM blocks, secret-named
  assignments, URL userinfo passwords) now blocks at the cheap pre-screen tier, before the (possibly
  outaged) `Moderator` ever runs, closing the named egress-secret asymmetry. The `scrubForEgress`/
  `looksLikeSecret` predicate moves to `@caisson/kernel` (`secret-scrub.ts`) — the shared zero-dep base
  both `guardrails` and `local-store` already depend on — so the predicate has exactly one
  implementation; `@caisson/local-store`'s `egress-guard.ts` re-exports it, keeping its public surface
  and golden-pinned scrub contract unchanged (internal-only move, patch). `@caisson/guardrails` also
  ships a new standalone FTC "4 Ps" dark-pattern presentation guardrail (`ftc4p.ts`): a pure heuristic
  evaluator scoring marketing/UI copy against prominence/presentation/placement/proximity for false
  urgency, forced continuity, confirmshaming, opt-out-framed enrollment, and drip pricing, optionally
  wrappable as a `Moderator` via `ftc4pModerator`.
- 623d07c: Doc-only: README note on the macOS fleet CI leg and the host-provisioned extension-capable SQLite.
- Updated dependencies [e62c88d]
- Updated dependencies [ccf8b10]
- Updated dependencies [549dd4e]
  - @caisson/kernel@0.3.0

## 0.2.0

### Minor Changes

- 9483a36: Initial public release (0.1.0) — publish-readiness flip (ADR-0111). The open Base substrate (Apache-2.0, tier `oss`) publishes to public npm; the commercial editions/primitives/generator (tier `paid`) publish to GitHub Packages restricted. Versions were aligned to 0.1.0 in lockstep with the registry ledger; this changeset records the 0.1.0 release and seeds the changeset-presence gate (ADR-0021).

### Patch Changes

- Updated dependencies [69817a1]
- Updated dependencies [9483a36]
  - @caisson/kernel@0.2.0
