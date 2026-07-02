# ADR-0205 — Compliance edition composes @caisson/alerting + @caisson/retention-runner at runtime

**Status:** accepted · 2026-07-02 (edition-tails-ops kickoff — operator lock, picker round 2026-07-02).
**Relates:** ADR-0178 (edition members-fold), ADR-0199 (the identical wiring for agent-dev/tool-exec),
ADR-0150/0151 (the alerting + retention-runner harvest modules).

## Context

ADR-0178 folded `@caisson/alerting` and `@caisson/retention-runner` into the Compliance edition's manifest
`members` map (merged, PR#34), but `packages/compliance/src/index.ts` never imports, composes, or
re-exports either — the exact class of manifest-asserts-what-composition-doesn't-deliver gap ADR-0199
closed for Agentic-Dev/tool-exec. No audit finding covered the Compliance leg, and ADR-0178 never decided
runtime composition; the alternative reading (the two are standalone env-gated services a buyer wires
separately) was genuinely open.

## Decision

Wire it, mirroring ADR-0199: both packages become real `workspace:*` dependencies of
`@caisson/compliance`, re-exported through the edition's single import home (`src/index.ts`) with their
factories composed into the edition surface, and the manifest kept coherent (members + dependencies). A
Compliance buyer reaches alert routing and retention sweeps from the edition they paid for, without a
side-channel install. Sibling `packages/*` edges, no depend-up, no cycles.

## Rejected

- **Manifest-only / intentionally-standalone posture** (the recon recommendation — the two primitives are
  env-gated services, unlike tool-exec which the agent run loop must reach inline) — operator locked
  compose; a paid member should be reachable from the edition's own API, and the ADR-0199 precedent makes
  "member ⇒ composed" the consistent rule across editions.
