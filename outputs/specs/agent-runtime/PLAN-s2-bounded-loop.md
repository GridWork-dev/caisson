# PLAN — S2: bounded tool loop + per-step metering (CAISSON-111 slice 3 of 6)

- **Executes:** ADR-0351 AR-2 (executor in ai-kit) · ADR-0360 U-1 · SPEC
  `SPEC-caisson-111-loop-slices.md` §3. Spike constraints binding
  (`SPIKE-v7-seam.md`, GO-WITH-CONSTRAINTS, pattern d only).
- **Depends:** S2a merged (`priced` band exists; the loop itself emits `metered` via the
  gateway). Tree-disjoint from S2b.
- **Branch:** `admin/caisson-111-s2-bounded-tool-loop` (one PR).

## Shape

`packages/ai-kit/src/agent-loop.ts` — `runToolLoop(opts)`: the caller-owned per-step
harness (spike pattern d). NO new package; ai-kit stays the only `ai`/`@ai-sdk/*`
importer (AR-2); the engine-neutral contract stays in agent-trajectory.

Per step, in the caller's own try/catch (NEVER in SDK callbacks):

1. **Pre-step gates (fail-closed):** step ceiling (`stepCountIs` mirror, caller-side) ·
   integer credit budget check (budget is caller-side; `stopWhen` counts steps, not
   spend) · REQUIRED trajectory `step.started` append — an append failure PREVENTS the
   step (the ADR-0351 rider-1 fail-closed inversion arrives here; slice-1 observation
   stays fail-soft elsewhere).
2. **Reserve** through ai-meter (the existing `reserve` seam, own `withTenant` scope,
   idempotent on a per-step callId) — model steps AND tool steps. 402 (short wallet /
   open breaker) mid-run ⇒ run finishes `failed`, reservation settled exactly once,
   `run.finished` appended.
3. **Execute:** `generateText` with `stopWhen: stepCountIs(1)`, `responseMessages`
   threaded forward. Tool calls the model proposes route through the existing tool-exec
   single-phase path (two-phase/approval is S3's — this slice runs only non-gated tools).
4. **Settle** after the step at provider-reported usage (the `infer()` settle idiom:
   idempotent on callId, ZERO_USAGE on failure paths, boundary-straddling windowKey
   threading) + append `step.finished` / `model.usage` (`metered`, the settled integers).

`onStepEnd` stays best-effort observation only; `prepareStep` unused for anything
load-bearing (spike constraints 1–3).

## Tasks

1. `agent-loop.ts` + exports; options: agentId, messages, tools allowlist, maxSteps,
   creditBudget (integer), accountId/tenant pool, trajectory store, meter deps —
   following `infer()`'s dependency-injection idiom.
2. Trajectory wiring: run.started → (per step: step.started, model.call,
   model.usage[metered], tool.proposed/result for executed tools, step.finished) →
   run.finished(status). Prompt/args/results as DigestRef only (AR-4).
3. **Test matrix (deterministic, MockLanguageModelV4, zero network):**
   - loop halts at maxSteps against a never-stopping model; budget exhaustion mid-run ⇒
     402 path: `failed` + exactly-once settle (duplicate-callback matrix: dropped
     stream, restart-shaped retry with echoed callId, double settle attempt);
   - reserve failure prevents the step (no provider call — call-count pinned);
   - REQUIRED append failure prevents the step (fail-closed inversion pinned);
   - a full run's event log projects with reconciled `metered` totals ==
     ledger-settled integers;
   - tool step reserves before execution;
   - **the 5 spike tests re-run green at the pinned `ai` version** (SPEC §3.4).
4. Changeset — `@caisson/ai-kit` minor, buyer prose.
5. Verify — `--filter=...@caisson/ai-kit` full dependents + standards-gate + sot;
   EVAL (`ai` tag): ai-kit golden/eval suites re-run green.

## Routing

Main-thread EXECUTE (the money seam — reserve/settle correctness; fable stays on it per
the repo's model-lane rule). SHIP: gw-code-reviewer (opus) + gw-security-auditor (fable)
on the loop's 402/settle/fail-closed seams (`billing` tag fires the audit).
