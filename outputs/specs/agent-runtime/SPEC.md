---
status: shipped (PRs #244, #272, #273, and #275)
owner: operator
tags: [ai, security, billing]
---

# SPEC — Governed single-agent runtime

- **Decision:** ADR-0349 (Fork AR-1, operator-locked 2026-07-15: option 1, spec-now build-now)
- **PLAN-gate locks:** ADR-0351 (2026-07-16) — AR-2 home = engine-neutral primitive + ai-kit
  adapter (resolves this SPEC's scope-item-1 "kernel-primitives only" vs ai-kit tension);
  AR-3 = trusted usage-adapter package, CLI runs `billingStatus: unsupported` until proven;
  AR-4 = metadata + encrypted payload refs, replay = deterministic projection. Binding
  riders: pinned ai@7.0.22 fail-closed seam spike first (v7 callbacks swallow errors;
  `onStepEnd` never authoritative), slice 1 = trajectory observation, serial risk DAG +
  launch firewall.
- **Research:** `outputs/research/agent-runtime-audit-2026-07-15.md` (read-only audit +
  exa-verified external patterns)
- **Tags:** `ai` (fires EVAL) · `security` (fires the security audit — approval/trajectory
  state is security-sensitive) · `billing` (every step meters through ai-meter/credits)

## Goal

A caisson buyer can run a bounded, tool-using agent through the SAME governed gateway that
already meters, guards, versions, and audits every other model call — and every run leaves an
append-only, replayable trajectory (steps, tool proposals, approvals, usage, checkpoints) that
evals can score and the audit chain can anchor. WHY: the audit found the platform's missing
middle is exactly this layer — the primitives (ai-kit gateway, ai-meter reserve-before-call,
guardrails, prompt registry, ai-evals, tool-exec, jobs, audit-worm) all exist but nothing
connects them into `run → step → model call → tool proposal → approval → tool result →
checkpoint`. Competitors ship ungoverned loops; caisson's differentiation is the governed one.

## Scope (single-agent, deliberately)

1. **Trajectory contract** — one append-only schema for runs, steps, model calls, tool
   proposals, approvals, results, usage, checkpoints. Zod `.strict()` at every boundary;
   integer money/credit units; `crypto.randomUUID()` ids. Lives where the audit pointed:
   a new home package (name at PLAN — candidate `@caisson/agent-runtime`) that depends only
   on kernel-level primitives, never "up".
2. **Instrument existing surfaces FIRST** (ADR-0349 guard 1): the agent-runner CLI executor
   and ai-kit's gateway emit trajectory events before any new executor is written. This
   closes the audit's "runner usage not wired into ai-meter" gap as its own shippable slice.
3. **Bounded tool loop** — AI SDK v7 (`ToolLoopAgent`, `stopWhen`, `prepareStep`) inside
   ai-kit's existing provider seam; tool execution through an adapted `tool-exec` gate
   (arg-array discipline, allowlists); guardrails pre/post each step; prompts from the
   append-only registry; **every model AND tool step reserve-metered through ai-meter**
   (402 fail-closed on exhausted credits, mid-run).
4. **Durable pause/resume + human approval** — through the existing jobs port (pg-boss in
   service contexts; Trigger.dev as one adapter, installed-version compatibility proven
   before any new API is used). A tool proposal that requires approval parks the run;
   approval/denial is a trajectory event with an actor.
5. **Trajectory evals** — ai-evals extends to score tool choice, unnecessary calls, approval
   compliance, budget adherence, and final output (deterministic first, judged where needed;
   green-only cassette discipline as in the intel lane).
6. **Exposure** — the same runtime through the CLI and the MCP server (run start/status;
   MCP elicitation/async-tasks only where client support is proven — ADR-0349 rejected
   MCP-interop-lead, so MCP exposure rides, never leads).

## Non-goals (binding, from ADR-0349)

- No multi-agent/subagent orchestration until single-agent cancellation, retries, metering,
  and replay are proven (guard 3).
- The seven-act lifecycle FSM in agent-kernel stays the governance wrapper — it is NEVER the
  execution graph (guard 4).
- No LangGraph, no A2A, no new orchestration framework (guard 5).
- No hosted run UI (the admin cockpit may grow a read-only trajectory view later — its own
  fork).
- SkillArtifact/Agent-Skills-spec expansion and vertical reference agents are follow-on
  programs, not this SPEC.

## Verification (goal-backward)

A demo run: an agent with 2-3 tools executes a bounded task through the gateway; the
trajectory replays deterministically from its events; the run's credit ledger reconciles
exactly (reserve → usage → settle, integer units, exact-once under a dropped stream); a
tool proposal gated on approval parks and resumes across a process restart; an eval scores
the trajectory (including one deliberate budget-violation case failing RED); the security
audit passes the approval/state seams. `bun run check` + standards-gate green; the new
package ships through `tooling/` like every other.

## Sequencing

PLAN decomposes into waves per ADR-0328 (parallel worktree sessions, one PR each). Slice 1
(trajectory schema + instrument existing runner/ai-kit) is independently shippable and
proves the contract before the loop engine lands. Tree-disjoint from the sandbox-demo
program (ADR-0350) which runs in parallel.
