# ADR-0199 — @caisson/tool-exec is wired into the Agentic-Dev edition (members-fold closed)

**Status:** accepted · 2026-07-01 (whole-repo audit round-3 remediation — operator lock, picker round 2026-07-01).
**Relates:** ADR-0178 (edition members-fold), ADR-0153 (tool-exec harvest module), ADR-0134/0188 (the audit
harness that surfaced it), ADR-0197/0198 (round 1+2 remediation locks).

## Context

Audit round 3 (finding `b090309f83aff1a3`, agent-governance) confirmed a seam gap the Stage-2 deployment had
already flagged as the open "edition members-fold" fork: the Agentic-Dev edition manifest
(`packages/agent-dev/manifest.ts`) declares `@caisson/tool-exec` a bundled, versioned, paid member per
ADR-0178, but `createAgentDevEdition()` (`packages/agent-dev/src/index.ts`) never imports, composes, or
re-exports it. A buyer composing the edition for agentic-execution governance got the lifecycle FSM, hooks
dispatcher, and emitter — but no reachable shell/side-effect exec gate, the edition's core value
proposition. The manifest asserted a member the composition did not deliver.

## Decision

Wire it. `@caisson/tool-exec` becomes a real dependency of `@caisson/agent-dev`, imported and re-exported
through the edition's single import home (`src/index.ts`), mirroring how `@caisson/agent-kernel` and
`@caisson/local-store` are already folded in, so the sandboxed exec gate is reachable from
`createAgentDevEdition()` and the manifest member matches reality. This honors ADR-0178 rather than amending
it — the declared member is now delivered. The dependency is a sibling `packages/*` edge (allowed by the
no-depend-up rule); `@caisson/tool-exec` does not depend on `@caisson/agent-dev`, so no cycle is introduced.

## Rejected

- **De-scope: drop tool-exec from the manifest and supersede ADR-0178's membership claim** — removes a
  declared paid member and guts the edition's stated exec-governance purpose to make the manifest match a
  thinner reality; the operator locked WIRE.
- **Leave the gap, document it as a known limitation** — a manifest that advertises a member the composed
  API cannot reach is exactly the drift the audit exists to close.
