# @caisson/agent-trajectory

## 0.3.0

### Minor Changes

- c7476b9: Parked agent-run bodies (the conversation and tool-call arguments a run saves while it waits for
  approval) are now encrypted at rest. Previously this snapshot was stored in the clear; a database
  dump or a stray query could read it. Now every parked body is sealed with the same per-tenant
  authenticated encryption the rest of the platform's sensitive fields use, and only the run that
  saved it can ever decrypt it back. Approving or denying a pending tool call, and resuming a run
  afterward, work exactly as before — this only changes what sits in the database in between.
- c3b0e41: Agent-runtime tool calls can now require human approval before they execute. A tool marked
  `approvalRequired` parks the run instead of running it: the proposal is recorded, the run's
  state is saved durably, and the run process can exit cleanly while the request waits. An
  operator reviews the pending call and approves or denies it — from the `caisson` CLI or any
  service with database access — and approval resumes the run from exactly where it left off,
  picks up the approved call, and continues to completion. Denial finishes the run without ever
  executing the tool. A durable run-state store and a durable trajectory log back this: approving
  the same call twice is a no-op, two concurrent resume attempts can never both execute the tool,
  and everything is tenant-isolated. The underlying tool-execution primitive gained a matching
  two-phase mode — validate and park a call, then execute it later once it's approved — for
  callers who want the same propose/execute split without the full run loop.
- dffd0c1: Usage events gain a fourth billing band, `priced`: pricebook-computed integer credits
  attached to real adapter-extracted token counts, with provenance stamped in the new
  optional `priceBookVersion` field. Priced events are cost statements, never charges —
  only `metered` remains ledger-truth. The schema now enforces the credit invariant
  (nonzero credits are only valid on `metered`/`priced` events), and run projections
  report a `priced` usage band alongside the existing three.
- 696b2c5: Agent runs now project a scored-consumable tool-call list. `projectToolCalls(events)` folds
  a run's tool proposals, approvals, denials, and results into one entry per call — its name,
  its argument digest, who approved or denied it and how, and whether it succeeded — ordered
  by proposal order and stable under out-of-order event delivery, exactly like the existing
  run projection. This is a new, separate projection: the existing run projection and its
  shape are unchanged.

## 0.2.0

### Minor Changes

- 3f05e1e: New engine-neutral trajectory package: an append-only, replayable event schema for a governed agent
  run (runs, steps, model calls, tool proposals, approvals, tool results, usage, checkpoints). Every
  event is validated at a strict boundary with integer token and credit units; sensitive bodies —
  prompt text, tool argument and result bodies, checkpoint state — are carried only as a sha256 digest
  reference, never inlined. The package ships an append-only store port (idempotent per run sequence,
  gaps and rewrites rejected) with an in-memory implementation, a deterministic projection that folds
  the same log to a byte-identical view regardless of arrival order, and a first usage adapter that
  reads Claude Code transcript lines into estimated usage events. Reserved and unpublished for now:
  it joins no bundle and carries no committed price until the runtime loop lands.
