# PLAN — S3: approval + durability (CAISSON-111 slice 4 of 6; dedicated security review)

- **Executes:** ADR-0360 U-2/U-3 · SPEC `SPEC-caisson-111-loop-slices.md` §4.
- **Depends:** S2 merged (the loop is what parks/resumes). Serial.
- **Branch:** `admin/caisson-111-s3-approval-durability` (one PR).
- **Tags in play:** `security` — SHIP fires `gw-security-auditor` (fable) on the approval
  seams specifically (rider-3 independent review); `ai` fires EVAL.

## PLAN-gate decision (SPEC §8 item 4, taken here)

- **`caisson run approve|deny` transport: direct service/DB call** (the doctor.ts
  thin-client pattern against the run-state store), NOT an MCP round-trip — the CLI is
  operator-side tooling against the buyer's own deployment; an MCP hop adds a network
  auth surface for zero gain. MCP elicitation stays deferred per U-2.

## Tasks

1. **PG `TrajectoryStore`** (in agent-trajectory: the README-documented shape, additive —
   memory impl stays): migration with append-only `trajectory_event` — UNIQUE
   `(run_id, seq)`, REVOKE UPDATE/DELETE, tenant RLS via `buildTenantPolicySql`
   (mirror ai-meter's `usage_event` migration; `checkRlsEquivalence` covers it).
2. **Durable run-state table** `agent_run_state` (separate from the log, NOT derivable
   from the projection): status (`running|parked|finished`), pending `toolCallId`,
   resume pointer (next seq), updated-at. Same RLS posture. Writes are
   compare-and-swap-shaped (status transitions guarded in SQL, no read-modify-write).
3. **Two-phase tool-exec** (additive API beside `createToolExec().run()`):
   `propose(toolCall) -> parked` · `execute(approvedCall)`. Existing single-phase path
   untouched for non-gated tools.
4. **Park/resume:** loop parks on a gated tool (append `tool.proposed`, write run-state
   `parked`, exit the process cleanly). Approval (`caisson run approve <runId> <toolCallId>`)
   appends actor-carrying `tool.approved` AND enqueues `singletonKey=runId` resume job on
   the jobs port (the enqueue IS the wake signal; pg-boss singleton + append-only
   conflict rule make double-approval idempotent). Deny appends `tool.denied` + finishes
   the run `failed`. Resume job re-hydrates from the log + run-state and continues the
   S2 loop.
5. **CLI:** `caisson run approve|deny <runId> <toolCallId>` + `caisson run status <runId>`
   (shows pending proposal) on the second bin (doctor.ts pattern).
6. **Security posture in-code:** Zod `.strict()` on every boundary; timing-safe compare
   on any token; fail-closed everywhere (unknown runId/toolCallId/status ⇒ reject);
   actor field mandatory on approve/deny.
7. **Test matrix:** park across a REAL process restart (integration: park, new process,
   approve, run completes) · double-approval idempotent (singleton + conflict) ·
   deny ⇒ failed · approve on unknown/mismatched toolCallId rejected · RLS equivalence ·
   append-only violated ⇒ store rejects (gap/rewrite tests exist — extend for PG).
8. Changeset(s): agent-trajectory (PG store) minor · tool-exec minor · cli minor.
9. Verify: dependents chain + standards-gate + sot; PGlite integration lanes
   (`--concurrency=1` where the PGlite flake bites); EVAL green; then the dedicated
   fable security audit before merge.

## Routing

EXECUTE split: PG store + run-state + two-phase tool-exec main-thread (money/security
seams); CLI verbs delegable (`gw-typescript-pro`, sonnet) once the store API lands.
