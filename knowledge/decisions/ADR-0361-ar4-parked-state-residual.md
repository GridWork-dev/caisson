# ADR-0361 — AR-4 amendment: parked run-state plaintext is an accepted pre-publish residual

- **Date:** 2026-07-18
- **Status:** Accepted (operator-locked)
- **Parent:** ADR-0351 (AR-4: metadata + encrypted refs; replay = projection) · ADR-0360
  (CAISSON-111 U-3: PG TrajectoryStore + separate durable run-state table)
- **Context PR:** #272 (CAISSON-111 slice S3, approval + durability)

## Context

S3 (PR #272) added `agent_run_state.parked_state`, a jsonb column holding the FULL
resumable snapshot a parked run needs to continue after a process restart: the actual
`ModelMessage[]` conversation and the proposed tool-call arguments, in plaintext — not the
digest-anchored, encrypted references AR-4 locked ("sensitive/full payloads — prompts,
tool args/results, approval context — behind bounded, digest-anchored, encrypted
references with explicit retention classification per field", ADR-0351).

This is a genuine narrowing of AR-4's application, not an oversight: the append-only
trajectory log (`trajectory_event`) already honors AR-4 in full — every event's sensitive
body travels as a `DigestRef` (sha256 digest + byte length), never inlined, exactly as
locked. `parked_state` is a SEPARATE, mutable, non-append-only table with no encrypted-ref
mechanism built for it yet; a true cross-process resume needs the actual conversation
bytes to hand back to the model, and no digest-only representation can supply that without
a body store this slice does not build. The fable security-audit review on PR #272 flagged
this as a locked-AR-4 narrowing and escalated it to the operator rather than approving a
silent scope interpretation.

## Decision

**Accept until S5 publish.** Plaintext `parked_state` under forced tenant RLS is an
accepted residual for the PRE-PUBLISH runtime only — `@caisson/agent-trajectory` ships
`sellable: false` and is not yet a member of any priced bundle, so no buyer's data is at
risk today. The `encRef`/`@caisson/field-crypto` wrap for parked bodies is a **named gate
of slice S5**: the agent-runtime cannot be published or sold — no bundle membership, no
priced catalog entry — until parked bodies are encrypted per the AR-4 shape. This is not a
deferral into silence; it is a locked precondition on S5's own SHIP gate.

The retention fix (parked_state is nulled on deny, on finish, and on a successful
terminal resume) is NOT deferred — it landed in S3 itself (already committed on the PR
#272 branch) and holds regardless of this ADR: a terminal run keeps no snapshot, encrypted
or not.

## Mitigations present (pre-publish, why the residual is bounded)

- **FORCE ROW LEVEL SECURITY** on `agent_run_state`, tenant-isolated identically to
  `trajectory_event` (ADR-0005) — a query that forgets its tenant scope sees nothing.
- **No read surface exposes the column.** `RunStateStore.read()` (the port every caller —
  including `caisson run status` — uses) returns a snapshot that never includes
  `parked_state`; only `claimResume` (the resume worker's own internal claim) reads it,
  and only to hand it back into the SAME loop that will re-guard/re-execute it.
- **Buyer-owned database.** The runtime composes into a buyer's OWN generated repo against
  their OWN Postgres — this is not a shared multi-tenant SaaS table GridWork operates on
  buyers' behalf; the buyer already has full DB access to their own tenant's rows by
  construction.
- **Terminal retention is fixed now** (see Decision) — the plaintext window is bounded to
  the run's ACTIVE parked lifetime, never persisted past a decision.

## Consequences

- S3 (PR #272) merges as-is; this ADR is the record of the operator's explicit
  acknowledgment, not a blocker on the slice.
- The S5 PLAN (exposure + publish, per ADR-0360's slice DAG) MUST carry the `encRef` wrap
  of `parked_state` as a BLOCKING task, and S5's SHIP review must verify it is implemented
  and tested before any bundle-membership or pricing publish step runs. A PLAN that reaches
  S5's publish tasks without this wrap is not gate-clean.
- Supersedes nothing. This AMENDS AR-4's application to `agent_run_state` specifically —
  a mutable, non-append-only run-state table with no encrypted-ref mechanism today. The
  append-only trajectory log's `DigestRef` discipline (schema.ts, AR-4 in full) is
  untouched and remains binding as originally locked.
