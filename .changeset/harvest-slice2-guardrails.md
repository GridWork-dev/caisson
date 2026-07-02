---
"@caisson/guardrails": minor
"@caisson/kernel": minor
"@caisson/local-store": patch
---

Harvest slice-2 (ADR-0215): guardrails' `guard.ts` gains an unconditional `"secret"`
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
