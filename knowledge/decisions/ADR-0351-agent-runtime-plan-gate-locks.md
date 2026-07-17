# ADR-0351 — Agent-runtime PLAN-gate locks: AR-2/3/4 + adversarial riders

- **Date:** 2026-07-16
- **Status:** Accepted (operator-locked at the 2026-07-16 picker, two rounds)
- **Parent:** ADR-0349 (Fork AR-1, option 1 — unchanged; these are subordinate locks the
  adversarial round surfaced, none reopens AR-1)
- **Research:** `outputs/research/agent-runtime-options-expansion-2026-07-16.md` — Codex
  `code_review_deep` dispatch (4 blockers + 1 warning, cross-verified by an independent
  claim-verification agent: 6 confirmed, 1 partial, 1 refuted) + the option-2/3/4 expansion
  fan-out + the audit gap-coverage map.

## Locks

### AR-2 — Runtime package + entitlement home

**Engine-neutral commercial primitive + ai-kit adapter.** The trajectory contract, store,
and ports live in a new shared engine-neutral commercial primitive (kind `primitive`,
depends only down); the AI SDK v7 executor (`ToolLoopAgent` adapter) lives INSIDE `ai-kit`
— preserving the ADR-0011/0022 provider-SDK boundary (ai-kit stays the only package
importing `ai`/`@ai-sdk/*`). Bundle membership and the Agentic-Dev-only buyer semantics
are locked at PLAN with a standards-gate dependency fixture proving the graph.
Verified tension this resolves: the SPEC's "depends only on kernel-level primitives" holds
for tool-exec/ai-meter/jobs (all `primitive`/`base` kind) but not ai-kit (`edition` kind) —
the split is the only shape that satisfies both.

### AR-3 — External-CLI billing authority

**Trusted usage-adapter package, unbilled until proven.** Operator direction (verbatim
intent): ccusage-style transcript parsing already extracts trustworthy Claude token usage
including subagent depth (the gw-core `gw cost` pattern); the same is achievable for Codex.
A provider-specific **usage-adapter package** is first-class runtime scope: per-provider
adapters proving token/model identity + integer price normalization. Until an adapter is
proven for a provider, that provider's CLI runs emit trajectory **observation** events with
`billingStatus: "unsupported"` — no billing from generic/unvalidated stream-json, and no
claim that runner usage is metered.

### AR-4 — Trajectory payload + replay posture

**Metadata + encrypted refs; replay = projection.** Append-only normalized metadata;
sensitive/full payloads (prompts, tool args/results, approval context) behind bounded,
digest-anchored, encrypted references with explicit retention classification per field.
Replay means deterministic **projection** from events — never re-executing model/tool
calls. A trajectory-contract RFC (event versioning, canonical ordering, idempotency keys,
field classification) precedes schema code and takes the dedicated `gw-security-auditor`
review the `security` tag already implies.

## Binding riders on the PLAN (adversarially sourced, independently verified)

1. **v7 seam spike first.** The first executable task is a pinned `ai@7.0.22` spike proving
   the fail-closed money chokepoint inside the tool loop: reserve completes before every
   model/tool step; a reserve or required trajectory-append failure PREVENTS execution;
   approval is durably recorded before any gated tool runs; retry/abort/dropped-stream/
   restart/duplicate-callback paths settle exactly once. Verified against live docs:
   lifecycle callbacks that throw are **caught internally and the call continues**, and
   `onStepFinish` is deprecated for `onStepEnd` — callbacks are never the authoritative
   persistence/billing mechanism. If the spike cannot prove fail-closed behavior, stop for
   a narrow ADR amendment to explicit `generateText`/`streamText` loop control (option 1
   itself unchanged).
2. **Slice 1 = trajectory observation, not metering closure.** Instrumenting the existing
   CLI runner emits observation events; "runner metered" is claimable only after AR-3
   adapters land. (Runner reality verified: spawns the provider CLI outside ai-kit,
   open-ended stream events, no usage in `RunReport`, cost wiring explicitly deferred.)
3. **Serial risk DAG + launch firewall.** Order: forks (this ADR) → v7 spike → minimal
   internal trajectory contract → non-billable runner observation → AI loop + billing
   invariants → approval/durability under its own security review → trajectory evals →
   CLI/MCP exposure + bundle-membership publish LAST. Runtime work never modifies launch,
   catalog, or buyer claims until its release gate is independently green; operator launch
   acts preempt runtime work.
4. **Named PLAN non-goals from the gap map** (silently absent in the SPEC, now explicit):
   agent-dev live-runner composition wiring, agent-runner SDK (non-CLI) backends, MCP
   resources/prompts, and migrating Ask-AI/support-bot/intel/AEO accounting onto the
   trajectory schema are follow-ons the PLAN names, not silent scope.

## Corrections recorded

- The Codex review's "disjoint member maps" claim was REFUTED at verification: AI-Production
  and Agentic-Dev manifests share `@caisson/ai-config` + `@caisson/kernel`. The AR-2
  bundle-membership fixture accounts for shared members.

## Consequences

- The agent-runtime PLAN can decompose immediately against these locks; slice 1 remains
  independently shippable as observation-only.
- Follow-on program timing recorded (research doc): portable-skills expansion waits only
  for the runtime's tool-allowlist shape to exist once; vertical automations wait for
  slices 1-3+; MCP resources/prompts is an optional standalone slice with mature client
  support, while elicitation/async-tasks ride the runtime per ADR-0349 guard 3.
