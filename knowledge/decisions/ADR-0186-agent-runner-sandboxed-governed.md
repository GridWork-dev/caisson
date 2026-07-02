# ADR-0186 — @caisson/agent-runner: sandboxed governed agent runner (Agentic-Dev sellable)

**Status:** accepted · decision-locked 2026-07-01 (LIFT slice-1 picker, forks F1/F2/F5) · FILED 2026-07-02
at build start per the "files at build" convention recorded on the board.
**Relates:** ADR-0133 (harvest initiative), ADR-0065/0066 (agent-kernel/Agentic-Dev base), ADR-0153/0199
(tool-exec governed tool-call, edition wiring), ADR-0137 (edition below-sum pricing), ADR-0187/0188 (the
sibling slice-1 locks, both already shipped).

## Context

`@caisson/agent-dev` ships the artifact/schema kernel, multi-harness emitter, and local memory — but
nothing that _runs_ an agent. The missing primitive: spawn a governed AI coding agent in a sandbox and
get back an auditable transcript + structured run report + a worktree diff. Source pattern (rebuild-clean,
patterns only): gridwork-core `tools/lib/glm-engine.ts`. SPEC: `outputs/specs/lift-phase/SPEC-agent-runner.md`.
The zero-secret-leak-by-construction posture is itself the selling point for compliance-conscious dev orgs.

## Decision

1. **F1 — boundary/license:** a NEW commercial package `@caisson/agent-runner`
   (`LicenseRef-Caisson-Commercial`), Agentic-Dev edition member — separate from `agent-dev` to keep the
   emitter/kernel composition clean.
2. **F2 — provider config:** provider-agnostic `{ binary, baseUrlEnv, authEnv, model }` — generalized off
   the z.ai/`claude`-CLI-specific source.
3. **F5 — SKU:** folded into the Agentic-Dev edition price; no standalone per-module SKU (consistent with
   ADR-0137 edition-below-sum).
4. **Security contract (non-negotiable):** child env is built from scratch by a `buildEngineEnv()`-style
   scrubber — never spread `process.env`; fixed non-secret passthrough allowlist + only the target
   provider's key; isolated HOME/config dir; no credentialed MCP; no side-effect tools. A leak-guard test
   asserting no `process.env` secret reaches the child env is a ship-blocking gate.

## Rejected

- **Fold into `@caisson/agent-dev`** — bloats the schema/emitter package with subprocess lifecycle and
  couples two release cadences; the edition composition already delivers both from one import home.
- **claude-CLI-specific config** — the source's z.ai binding is incidental; the sellable primitive is the
  sandbox + transcript + report contract, which any headless agent CLI can satisfy.
- **Standalone SKU** — contradicts the ADR-0137 below-sum edition economics for a member whose value is
  completing the edition story.
