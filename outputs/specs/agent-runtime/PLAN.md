# PLAN — Agent-runtime slice 1 (CAISSON-109)

- **Executes:** ADR-0349 (direction) + ADR-0351 (PLAN-gate locks + riders). SPEC: `SPEC.md` beside this file.
- **Branch:** `admin/caisson-109-agent-runtime-slice-1-trajectory-contract-observation` (worktree, one PR).
- **Slice boundary (binding):** NO tool loop, NO approval/durability, NO ai-evals extension, NO MCP/CLI exposure, NO bundle membership or pricing (ADR-0351 rider 3 — publish LAST; CAISSON-111 owns the rest). Slice 1 is merge-green internal capability.

## Tasks

### T1 — `@caisson/agent-trajectory` package (new engine-neutral commercial primitive)

Owner: one agent, whole package (no shared files). Location `packages/agent-trajectory/`.

1. `manifest.ts` — kind `primitive`, commercial license posture (NOT Apache; NOT added to any
   bundle member map — reserved-id/unpublished per ADR-0351 rider 3). Follow the shape of
   `packages/tool-exec/manifest.ts`.
2. `src/schema.ts` — the trajectory contract: event envelope
   `{ eventId (uuid), runId, seq (monotonic int), version (int, start 1), occurredAt (ISO), kind, payload }`
   with kinds: `run.started`, `run.finished`, `step.started`, `step.finished`, `model.call`,
   `model.usage`, `tool.proposed`, `tool.approved`, `tool.denied`, `tool.result`, `checkpoint`.
   Zod `.strict()` everywhere; integer credit/usage units; `billingStatus: 'metered' | 'unsupported' | 'estimated'`
   on usage events (AR-3). Payload discipline per AR-4: normalized metadata inline; anything
   sensitive (prompt text, tool args/results bodies) ONLY as
   `{ digest: sha256-hex, byteLength, encRef?: string }` — never raw content. Document field
   classification in the README.
3. `src/store.ts` — `TrajectoryStore` port: `append(event)` (idempotent on `(runId, seq)`;
   rejects seq gaps/rewrites — append-only enforced), `read(runId)`. Memory implementation now;
   PG shape documented, not built.
4. `src/replay.ts` — deterministic projection: `project(events) -> RunProjection`
   (status, step tree, usage totals per billingStatus, checkpoints). Same events ⇒ byte-identical
   projection (test with shuffled-arrival ordering resolved by seq).
5. `src/adapters/claude-transcript.ts` — first AR-3 usage adapter: parse Claude Code JSONL
   transcript lines (ccusage-style) → `model.usage` events with real token counts + model id,
   `billingStatus: 'estimated'` (documented: not billing-grade until price normalization lands).
   Fixtures: 2-3 synthetic JSONL fixtures incl. a subagent-depth case + a malformed-line case
   (skipped, counted, never thrown).
6. Tests (`bun test`): schema round-trip + unknown-field rejection; append-only enforcement
   (duplicate seq idempotent, gap rejected, mutation rejected); projection determinism;
   parser fixtures. LICENSE (commercial, match e.g. `packages/tool-exec/LICENSE`), README =
   contract RFC (versioning, ordering, idempotency, field classes, replay=projection), changeset
   (minor, prose per the changeset-prose gate).

### T2 — v7 seam spike (test + findings doc only)

`packages/ai-kit/test/v7-seam-spike.test.ts` using the AI SDK's mock model test utils
(deterministic, no network): prove (a) an error thrown inside `onStepEnd` is swallowed and the
call continues (assert the documented behavior); (b) whether `prepareStep` throwing aborts the
call; (c) `stopWhen` bounds a multi-step tool loop; (d) an explicit `generateText`-loop shape
can interpose reserve→execute→settle around each step. Findings →
`outputs/specs/agent-runtime/SPIKE-v7-seam.md` with a GO / GO-WITH-CONSTRAINTS / NO-GO verdict
for the CAISSON-111 loop slice. No production code changes.

### T3 — agent-runner observation instrumentation

`packages/agent-runner`: accept an OPTIONAL injected `TrajectoryRecorder` (the store port from
T1 — add `@caisson/agent-trajectory` as a dependency; check the dependency direction is legal
for agent-runner's kind first and record it in the standards-gate fixture). When present, emit:
`run.started`, `step.*` mapped from stream events (tool calls → `tool.proposed`+`tool.result`
with digest-ref payloads), `run.finished`, and a final `model.usage` with
`billingStatus: 'unsupported'` (NO token claims — the runner has no validated usage contract).
Absent recorder ⇒ byte-identical behavior to today. Tests with a scripted fake provider binary
(follow the package's existing test pattern). Changeset (patch/minor).

### T4 — ai-kit observation instrumentation

`packages/ai-kit`: OPTIONAL `TrajectoryRecorder` on the gateway options; when present emit
`model.call` (model id, prompt DIGEST only) + `model.usage` (`billingStatus: 'metered'`, the
same integers the ledger already records) around the existing
resolve→render→guard→reserve→provider→usage→guard→reconcile chain. ZERO behavior change to
metering/guardrails; recorder failures are caught + surfaced as a warning, never fail the call
(observation must not break the money path — the fail-closed inversion arrives only with the
loop slice, per ADR-0351 rider 1). Tests. Changeset.

### T5 — standards-gate fixture + gates + PR

Standards-gate fixture asserting: `agent-trajectory` (primitive) depends on nothing above
kernel-level; ai-kit remains the only `ai`/`@ai-sdk/*` importer; agent-runner/ai-kit may depend
on `agent-trajectory`, never the reverse. Then the full gate ladder in the worktree:
`bun install` → `bun run check` → `bunx turbo run build test --filter=@caisson/agent-trajectory
--filter=@caisson/agent-runner --filter=@caisson/ai-kit --concurrency=1` → standards-gate.
Atomic conventional commits per task (`feat(agent-trajectory): …`, `feat(ai-kit): …`,
multiple `-m`, no banned subject characters), push the branch.

## Verify (goal-backward, slice-1 scope)

A recorded runner session replays to a deterministic projection; usage events carry honest
billingStatus; append-only enforcement proven; the spike verdict exists and gates CAISSON-111;
all gates green. Security tag: the SHIP audit reviews the ai-kit seam diff + the digest-ref
payload discipline.
