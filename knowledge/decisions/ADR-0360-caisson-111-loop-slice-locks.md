# ADR-0360 — Agent-runtime follow-on slice locks: CAISSON-111 decomposition U-1..U-7

- **Date:** 2026-07-17 (locks taken at the Kickoff-U picker rounds; filed at the follow-on
  sitting per the ADR-0328 boards-frozen convention — the reconcile session owed this
  filing and it is the `SPEC-caisson-111-loop-slices.md` build precondition (a))
- **Status:** Accepted (operator-locked)
- **Parent:** ADR-0349 (AR-1 direction) + ADR-0351 (PLAN-gate locks AR-2/3/4 + riders)
- **SPEC:** `outputs/specs/agent-runtime/SPEC-caisson-111-loop-slices.md` (tags: ai,
  security, billing). Gate satisfied: `SPIKE-v7-seam.md` verdict GO-WITH-CONSTRAINTS —
  the loop proceeds only on the explicit per-step `generateText` harness (pattern d).

## Locks

### U-1 — CAISSON-111 decomposition

**One SPEC, serial slice DAG** per ADR-0351 rider 3: S2a (contract amendment) → S2b
(usage-adapter package, tree-disjoint, may run parallel to S2) → S2 (bounded loop +
per-step metering) → S3 (approval + durability) → S4 (trajectory evals) → S5 (exposure +
publish LAST). Loop+metering and approval/durability are separate slices; S3 runs under
its own dedicated security review. Each slice rides its own ADR-0328 wave session, one PR.

### U-2 — Approval surface

**CLI-first:** `caisson run approve|deny <runId> <toolCallId>` (+ `caisson run status`
shows the pending proposal). The admin read-only trajectory view stays the deferred
ADR-0349 fork; MCP elicitation stays deferred (slice-C churn).

### U-3 — Parked-run durability

**PG TrajectoryStore + a separate durable run-state table + re-enqueue resume.** Approval
writes `tool.approved` (actor-carrying) to the append-only log AND enqueues a
`singletonKey=runId` resume job on the jobs port (no job exists while parked — the enqueue
IS the wake signal; idempotent under double-approval via the singleton key + append-only
conflict rule). The replay projection stays observation-only; a new `projectToolCalls`
sibling serves evals.

### U-4 — Price-normalized CLI usage

**A new `priced` BillingStatus value** (4th band): pricebook-computed integer credits,
never ledger-settled. `metered` stays ledger-truth only. This touches the slice-1 enum —
consumer impact (replay `usageTotals` banding, slice-1 tests) is part of slice S2a, plus
the Zod refine landing the previously comment-only invariant: `credits > 0` iff
`billingStatus ∈ {metered, priced}`; `estimated`/`unsupported` ⇒ `credits === 0`.
`ModelUsagePayload` gains optional `priceBookVersion` (provenance stamp).

### U-5 — Subagent-depth attribution

**Deferred — named non-goal.** Neither engine supports honest linkage today (Codex
structurally cannot; Claude's `isSidechain` is unconsumed). Revisit on real provider
linkage. Schema untouched.

### U-6 — PostHog LLM-obs boundary

**Out of this SPEC** — built as its own mini-lane (CAISSON-120 / ADR-0356). Binding
boundary recorded here: `packages/ai-kit` is a sold package and NEVER gets a hardcoded
vendor telemetry sink.

### U-7 — Trajectory-evals home

**Extend `packages/ai-evals` itself:** trajectory graders + a trajectory fixture kind +
a dataset. Accepts the ai-evals → agent-trajectory dependency (primitive→primitive,
precedented by ai-meter).

## Consequences

- The SPEC's build precondition (a) is satisfied by this filing; precondition (b) —
  slice 1 (CAISSON-109) merged on main — was satisfied at the PR #249 consume
  (agent-trajectory indexed at 0.2.0, unsellable/unpriced/bundle-less until S5's publish
  gate per rider 3).
- ADR-0351 rider 3's launch firewall holds throughout the DAG: no slice modifies launch,
  catalog, or buyer claims until its release gate is independently green; operator launch
  acts preempt.
- Open PLAN-gate items (SPEC §8: MCP entitlement slug · Claude-adapter re-home vs wrap ·
  S2b package name/kind/tier · approve-transport) are decided at each slice's PLAN act,
  not here.
