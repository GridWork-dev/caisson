---
status: locks-taken (2026-07-17 Kickoff-U pickers; ADR filing rides the reconcile session — boards frozen during the wave)
owner: operator
tags: [ai, security, billing]
---

# SPEC — Agent-runtime follow-on slices (CAISSON-111)

- **Parent:** `SPEC.md` (ADR-0349 Fork AR-1) + ADR-0351 PLAN-gate locks (AR-2/3/4 + riders).
  This SPEC decomposes the REMAINDER after slice 1 (CAISSON-109: trajectory contract +
  observation instrumentation + v7 seam spike) into locked, serially-ordered slices.
- **Gate satisfied:** `SPIKE-v7-seam.md` verdict **GO-WITH-CONSTRAINTS** — the loop may
  proceed ONLY on the explicit per-step `generateText` harness (pattern d). Binding spike
  constraints are restated in §3.
- **Research (2026-07-17, five-lane recon):** Codex rollout-format + gw-core transcript
  pipelines · price-normalization landscape (ai-meter pricebook reuse) · jobs-port/approval
  durability gaps · ai-evals/exposure seams · PostHog LLM-obs (spun out — see non-goals).
- **Build timing:** NO code until (a) the reconcile session files this SPEC's lock ADR and
  (b) slice 1 (caisson-109 branch) is merged on main. Each slice rides its own ADR-0328
  wave session, one PR each.

## Operator locks taken 2026-07-17 (the reconcile session files these as the lock ADR)

| #   | Fork                       | Lock                                                                                                                                                                                                                                                                 |
| --- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U-1 | CAISSON-111 decomposition  | **One SPEC, serial slice DAG** per ADR-0351 rider 3 — loop+metering and approval/durability are separate slices, the latter under its own dedicated security review                                                                                                  |
| U-2 | Approval surface           | **CLI-first**: `caisson run approve/deny <runId> <toolCallId>` (+ `run status` shows the pending proposal). Admin read-only trajectory view stays the deferred ADR-0349 fork; MCP elicitation stays deferred (slice-C churn)                                         |
| U-3 | Parked-run durability      | **PG TrajectoryStore + a separate durable run-state table + re-enqueue resume**: approval writes `tool.approved` AND enqueues a `singletonKey=runId` resume job; the projection stays observation-only; a new `projectToolCalls` sibling serves evals                |
| U-4 | Price-normalized CLI usage | **A new `priced` BillingStatus value** (4th band): pricebook-computed integer credits, never ledger-settled. `metered` stays ledger-truth only. Touches the slice-1 enum — the lock ADR must record the consumer-impact and the schema refine (§5)                   |
| U-5 | Subagent-depth attribution | **Deferred — named non-goal.** Neither engine supports honest linkage (Codex structurally cannot; Claude's `isSidechain` is unconsumed). Revisit on real provider linkage                                                                                            |
| U-6 | PostHog LLM-obs (audit M4) | **Out of this SPEC.** Built as its own mini-lane (CAISSON-120, in flight this wave): first-party Ask-AI + support-bot `$ai_generation` capture. Binding boundary recorded here: `packages/ai-kit` is a sold package and NEVER gets a hardcoded vendor telemetry sink |
| U-7 | Trajectory-evals home      | **Extend `packages/ai-evals` itself**: trajectory graders + a trajectory fixture kind + a dataset; accepts the ai-evals → agent-trajectory dependency (primitive→primitive, precedented)                                                                             |

## 1. Goal (unchanged from the parent SPEC, goal-backward)

A buyer runs a bounded, tool-using agent through the SAME governed gateway that meters,
guards, versions, and audits every other model call. The proof stays the parent SPEC's
demo: bounded run through the gateway · deterministic replay from events · credit ledger
reconciles exactly (reserve → usage → settle, integer units, exact-once under a dropped
stream) · an approval-gated tool proposal parks and resumes across a process restart · an
eval scores the trajectory with one deliberate budget-violation case failing RED · the
security audit passes the approval/state seams.

## 2. Slice DAG (binding order; each slice = one wave session/PR)

```
S2a  contract amendment      'priced' BillingStatus + credits refine + priceBookVersion   (small, first — every later slice consumes it)
S2b  usage-adapter package   AR-3 home: Codex adapter + price normalization + alias map   (tree-disjoint; may run parallel to S2)
S2   bounded loop + metering pattern-d harness in ai-kit; per-step reserve/settle; 402 fail-closed mid-run
S3   approval + durability   OWN SECURITY REVIEW: PG store, run-state table, two-phase tool-exec, CLI approve/deny, re-enqueue resume
S4   trajectory evals        ai-evals extension + projectToolCalls + budget adherence
S5   exposure + publish LAST CLI run start/status, MCP run tools, bundle membership/pricing
```

ADR-0351 rider 3's launch firewall holds throughout: no slice modifies launch, catalog, or
buyer claims until its release gate is independently green; operator launch acts preempt.

## 3. S2 — bounded loop + per-step metering (in ai-kit, per AR-2)

The executor lives INSIDE `packages/ai-kit` (the only `ai`/`@ai-sdk/*` importer); the
contract/store/ports stay in the engine-neutral primitive. Binding spike constraints:

1. The loop is the caller's own per-step harness — `generateText` with
   `stopWhen: stepCountIs(1)` per step, `responseMessages` threaded forward (pattern d).
   Reserve-before-step and settle-after-step live in the caller's try/catch — NEVER in
   `onStepEnd`/`onStepFinish` (SDK swallows callback throws; empty catch, verified against
   `ai@7.0.22` source).
2. `onStepEnd` is best-effort observation only. `prepareStep` MAY carry a pre-step gate
   (fail-closed today by accident of control flow) but nothing may DEPEND on that surviving
   an SDK bump.
3. `stopWhen`/`stepCountIs(N)` is the hard step ceiling; the credit budget is enforced
   caller-side per step (stopWhen counts steps, not spend). Budget exhaustion mid-run =
   402 fail-closed, run finishes `failed` with the reservation settled exactly once.
4. **Re-run all v7 seam-spike tests on ANY `ai` version bump** before trusting the loop
   (the pinned-seam discipline; findings (a)/(b) are undocumented control flow).
5. Every model step AND tool step reserves through ai-meter before execution; a reserve or
   required trajectory-append failure PREVENTS the step (the fail-closed inversion arrives
   here, per ADR-0351 rider 1 — slice-1 observation stays fail-soft).

## 4. S3 — approval + durability (own dedicated security review)

- **PG-backed `TrajectoryStore`** (the README-documented shape: append-only, UNIQUE
  `(run_id, seq)`, REVOKE UPDATE/DELETE, tenant RLS — mirror ai-meter's `usage_event`).
- **A separate durable run-state table** (NOT the append-only log): parked/awaiting-approval
  status, pending `toolCallId`, resume pointer. The projection cannot host this (it
  deliberately folds no `tool.*` events) — verified.
- **Two-phase tool-exec**: propose → park → external approval → execute. Today's
  `createToolExec().run()` is single-phase; the two-phase API is additive, the existing
  path stays for non-gated tools.
- **Resume**: approval writes `tool.approved` (actor-carrying) to the log AND enqueues a
  `singletonKey=runId` resume job on the jobs port (pg-boss has no hold-until-signaled
  primitive; no job exists while parked — the enqueue IS the wake signal). Idempotent under
  double-approval by the singleton key + the append-only conflict rule.
- **CLI approval surface** (U-2): `caisson run approve|deny <runId> <toolCallId>` on the
  `caisson` bin (doctor.ts thin-MCP-client pattern or direct service call — PLAN decides
  the transport; the verb set is locked).
- Trajectory/approval state is security-sensitive: Zod `.strict()` everywhere, timing-safe
  compares on any token, fail-closed gates; the slice's SHIP fires `gw-security-auditor`
  on the approval seams specifically (rider 3's independent review).

## 5. S2a + S2b — usage honesty: `priced`, the adapter package, Codex

**S2a (contract amendment, first):** `BillingStatus` gains `priced` — pricebook-computed
integer credits attached to real adapter-extracted counts; never ledger-settled.
`ModelUsagePayload` gains optional `priceBookVersion` (provenance stamp). A Zod refine
lands the previously comment-only invariant: `credits > 0` permitted iff
`billingStatus ∈ {metered, priced}`; `estimated`/`unsupported` ⇒ `credits === 0`.
`metered`'s binding definition is untouched: the numbers ARE the credit ledger's.
Consumer impact (replay usageTotals banding, slice-1 tests) is part of this slice.

**S2b (the AR-3 usage-adapter package):** a NEW package (name at PLAN;
deps: kernel + ai-meter + agent-trajectory — primitive→primitive, precedented by ai-meter
itself). It hosts:

- **Price normalization**: reuse ai-meter's `BUNDLED_PRICE_BOOK`/`resolvePriceEntry`/
  `computeCost` verbatim (integer micro-USD, ceil rounding, `PRICE_BOOK_VERSION`) + a NEW
  dated-model-id alias map (`claude-sonnet-4-5-20250514` → `anthropic/claude-sonnet-4.5`).
  Unknown model or missing alias ⇒ stays `estimated`, never a guess, never `priced`.
- **The Codex adapter** (sibling of claude-transcript; whether the Claude adapter re-homes
  here or is wrapped is a PLAN item). Binding honesty bar, fixture-backed:
  1. Stateful scanner: model latched from the nearest `turn_context`, provider read from
     `session_meta.model_provider` — NEVER hardcoded, NEVER fallback-guessed (the ccusage
     `gpt-5` display fallback is explicitly rejected).
  2. Usage from `last_token_usage` deltas with `cached_input_tokens` subtracted out of
     `input_tokens`; a fixture asserts delta-consistency against successive
     `total_token_usage` cumulative diffs (the documented cumulative trap).
  3. `reasoning_output_tokens` is already folded into `output_tokens` — a fixture proves
     no double-count.
  4. A `token_count`-free session (interactive TUI, legacy logs) yields ZERO usage events
     with the run marked `unsupported` — never zero-valued `estimated` events.
     Format instability is accepted and contained: the rollout format is vendor-internal;
     adapter failures skip-and-count, never throw (the slice-1 robustness contract).

## 6. S4 — trajectory evals (in ai-evals, per U-7)

- `packages/agent-trajectory` gains `projectToolCalls(events)` — a SIBLING projection
  folding `tool.proposed/approved/denied/result` into a scored-consumable tool-call list;
  `project()` and `RunProjection` stay byte-stable.
- `packages/ai-evals` gains trajectory graders + a trajectory fixture kind (the
  `input.kind` discriminator idiom) + a dataset: tool-choice vs allowlist, unnecessary
  calls, approval compliance (from the folded approve/deny events), budget adherence
  (near-free: `usageTotals` — now including the `priced` band — + `classifyExit`).
  Deterministic graders first; judged criteria constants where needed (intel
  `ACTIONABILITY_CRITERIA` pattern), cassette-replayed in CI, green-only discipline with
  the `assertRunEligibleForBaseline` pre-BLESS guard.
- One deliberate budget-violation case failing RED is the parent SPEC's acceptance row.

## 7. S5 — exposure + publish (LAST)

- CLI: `caisson run start|status` on the `caisson` bin (doctor.ts thin-client pattern).
- MCP: `run_start`/`run_status` via the registerTool seam (coach.ts/manifest-tools.ts
  template; new optional `McpServerOptions` group).
- Bundle membership + pricing publish rides the END of this slice per rider 3 (reserved-id
  until then; the AR-2 standards-gate dependency fixture proves the graph).

## 8. Open PLAN-gate items (named, deliberately NOT locked here)

1. MCP run-tools entitlement slug: the Agentic-Dev fold slug vs a dedicated slug
   (`ds-doctor` decoupling precedent).
2. Claude-transcript adapter: re-home into the S2b package vs wrap in place.
3. The S2b package name + manifest kind/tier.
4. `caisson run approve` transport: direct service/DB call vs MCP-tool round-trip.

## 9. Non-goals (binding)

- Subagent-depth usage attribution (U-5) — schema untouched; revisit on real linkage.
- PostHog/vendor telemetry anywhere in sold packages (U-6 boundary).
- Multi-agent/subagent orchestration, FSM-as-execution-graph, LangGraph/A2A (ADR-0349
  guards, unchanged).
- Hosted run UI; admin trajectory view stays its own deferred fork.
- Live-runner composition into agent-dev, non-CLI SDK backends, MCP resources/prompts
  (ADR-0351 rider 4 non-goals, unchanged — resources shipped separately by CAISSON-117).

## 10. Verification (goal-backward, per slice)

Each slice's wave session runs the parent SPEC's demo criteria that its slice unlocks, plus:
S2a/S2b — refine rejects nonzero credits on estimated/unsupported; alias-miss stays
estimated; Codex fixtures prove the four honesty bars. S2 — spike tests re-run green at the
pinned `ai` version; a dropped-stream/restart/duplicate-callback matrix settles exactly
once. S3 — park/resume across a real process restart; double-approval idempotent; security
audit on the approval seams. S4 — budget-violation case RED; baselines gated. S5 — the
full parent demo end-to-end. `bun run check` + standards-gate green everywhere; the `ai`
tag fires EVAL; the `security` tag fires the audit at every SHIP.
