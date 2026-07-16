# ADR-0349 — Agent-runtime expansion: governed single-agent runtime, spec-now build-now

- **Date:** 2026-07-15
- **Status:** Accepted (operator-locked at the 2026-07-15 AR-1 picker)
- **Fork:** AR-1 (`docs/state/decisions-and-forks.md`)
- **Research:** `outputs/research/agent-runtime-audit-2026-07-15.md` (operator-supplied
  read-only audit, exa-verified external patterns)

## Context

The audit finds Caisson's differentiation is governed AI execution (metering, credit
enforcement, prompt versioning, guardrails, evals, audit provenance, isolated execution),
but the middle layer is missing: no integrated `run → step → model call → tool proposal →
approval → tool result → checkpoint` contract connects the AI-production primitives to the
CLI runner, MCP server, product assistants, and watchers. Four directions were tabled:
(1) governed single-agent runtime, (2) portable-skills expansion to the Agent Skills spec,
(3) vertical reference automations, (4) MCP-interop lead.

## Decision

**Option 1 — compose a governed single-agent runtime.** One append-only trajectory schema
(runs, steps, calls, tool proposals, approvals, results, usage, checkpoints); bounded tool
loops on AI SDK v7 (`ToolLoopAgent`/`stopWhen`/`prepareStep`) inside `ai-kit`'s existing
provider seam; `tool-exec` adapted as the tool-execution gate; every model/tool step charged
through `ai-meter`; durable pause/resume + human approval through the existing jobs port
(Trigger.dev as one adapter). **Timing: spec now, build now** — the engineering backlog is
empty and the launch chain blocks only on operator acts.

Sequencing guards (from the audit, binding on the PLAN):

1. Instrument the EXISTING CLI runner + ai-kit against the trajectory schema before adding
   any new executor.
2. Evals extend to trajectories (tool choice, unnecessary calls, approval compliance,
   budget adherence) — not just outputs.
3. Same runtime exposed through CLI and MCP; subagents only after single-agent
   cancellation/retries/metering/replay are proven.
4. The seven-act lifecycle FSM stays the governance wrapper — never the execution graph.
5. No LangGraph/A2A unless a locked requirement demands arbitrary graphs or cross-vendor
   remote-agent collaboration.

## Alternatives rejected (for now)

- **Portable-skills expansion** — sellable fast but leaves execution/durability/metering
  external; becomes a natural follow-on once the runtime exists.
- **Vertical automations first** — duplicates orchestration/telemetry/approval per vertical.
- **MCP-interop lead** — client support for elicitation/async tasks is uneven, and it still
  needs a durable executor behind it; MCP exposure rides the runtime instead (guard 3).

## Consequences

- A new SPEC (`outputs/specs/agent-runtime/`) decomposes the build; EXECUTE rides dedicated
  session(s) under the ADR-0328 wave convention.
- Trajectory + approval state is security-sensitive: the security floor
  (timing-safe compares, Zod `.strict()` boundaries, fail-closed gates) applies to every new
  contract; `security` tag fires the SHIP audit.
- Runner usage becomes metered — closes the audit's "runner not wired into ai-meter" gap.
