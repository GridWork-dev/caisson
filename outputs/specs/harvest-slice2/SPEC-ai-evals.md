# SPEC — `@caisson/ai-evals` (eval-science depth: exit-classifier + Wilson-CI + reflexivity + Fleiss-kappa)

**Status: LOCKED — ADR-0210 (asymmetry: harden-in-place) + ADR-0214 (eval-science depth), harvest
slice-2 wave, 2026-07-02 operator picker.** Spec-gated: no code lands until this SPEC + its ADR are
filed (ADR-0133 §4).

- **Slice:** harvest slice-2 (lift-sweep ranks #5, #11, #15 + gridwork-core exit-classifier).
- **Edition:** AI Production Kit (unchanged — ADR-0210 locks the flagged asymmetry to HARDEN IN
  PLACE: capability lands inside this existing commercial package, no new package, no edition move).
- **Sources (rebuild-clean, patterns only):** telesis (Wilson-CI golden-set gate), throughframe
  (`eval_feed.consolidate_reflexivity_queue`, Fleiss-kappa guard), gridwork-core (exit-classifier).
  Firewall respected — never media-pipeline.
- **Type:** HARDEN. **Tags:** `ai`.

## Goal (WHAT + WHY)

`@caisson/ai-evals` (ADR-0062) already runs deterministic + model-graded cases against a committed
baseline, but its gate is a flat mean with no way to (a) tell a case's exit reason apart from a
wrong answer, (b) trust a small golden set's pass rate, (c) recycle production judge/human
disagreements into the golden set, or (d) measure whether a judge ensemble — or a re-run on
paraphrased input — agrees with itself. Landing these four primitives here, not a new package,
keeps one gate, one baseline file, one `Judge` port.

## Scope

**In:** four dependency-free additions, each a new `src/*.ts` + its own test file. Zero new
`package.json` deps (zod only, unchanged); zero new imports of `@caisson/ai-kit` or a provider SDK
(down-only, ADR-0003 — `Judge` stays caller-injected).

1. **Exit classifier** (`src/exit-classifier.ts`) — why a run exited, not whether it scored well.
2. **Wilson-CI gate augmentation** (`src/wilson.ts` + threading into `baseline.ts`/`define-eval.ts`) — opt-in, additive to the existing mean-vs-baseline check.
3. **Budget-isolated eval ledger** (`src/eval-ledger.ts`) — eval spend, injected-port storage, never touches `@caisson/ai-meter` or a postgres dep.
4. **Reflexivity queue + Fleiss-kappa agreement** (`src/reflexivity-queue.ts`, `src/agreement.ts`).

**Out:** a live counterfactual-variant generator (an ai-kit/agent-dev concern — this package only
scores agreement over already-produced variant verdicts); any Postgres schema/migration (storage
stays an injected port, mirroring `Judge`); `apps/*` demo wiring; changing the two committed
`__evals__/baseline.json` entries (task 6 leaves them green, unblessed).

## Design

- **Exit taxonomy:** `EXIT_CLASSES = ["success","error","timeout","refusal","budget-exhausted","empty-output","unknown"]`; `exitSignalSchema = z.object({ output?, errored?, timedOut?, budgetExhausted?, refusalMarkers?: string[] }).strict()`. `classifyExit(signal): ExitClass` — pure priority chain: error → timeout → budget-exhausted → refusal (substring match on `refusalMarkers`, case-insensitive) → empty-output → success → unknown.
- **Wilson math:** `wilsonLowerBound(successes: number, n: number, z = 1.96): number` — closed-form lower bound, no deps.
- **Gate threading (additive):** optional `wilsonFloor?: number` on `DefineEvalConfig`/`EvalRun` (plain TS interfaces, not Zod-parsed — safe to extend). When set, `compareToBaseline` computes per-scorer `successes` from `scoredCases[].passes[scorer]` over `run.cases`, and adds `RegressionKind = "wilson-below-floor"` if `wilsonLowerBound(successes, run.cases) < wilsonFloor - EPS`. Unset → zero behavior change (existing baseline stays green). `wilsonFloor` is a confidence floor distinct from `threshold` (which gates the mean) — looser, to catch a lucky-draw small sample.
- **Eval ledger:** `EvalSpendEntry { id, evalName, ranAt, cases, costCents: int }` (`.strict()`, integer money per ADR-0007). `EvalLedgerSink { record(entry) }` port + `InMemoryEvalLedgerSink` (mirrors `kernel/event-sink.ts` `InMemoryEventSink`). `recordEvalSpend(sink, { evalName, cases, costCents })` stamps `id: crypto.randomUUID()` + ISO `ranAt`, validates, calls `sink.record`. No import of `@caisson/ai-meter` — isolation by construction.
- **Reflexivity queue:** `ReflexivityCandidate { id, evalName, caseId, input, output, modelVerdict, humanVerdict: "pass"|"fail", capturedAt }`. `ReflexivityQueueStore { enqueue(candidate); list(evalName) }` port + `InMemoryReflexivityQueueStore`. `flagsDisagreement(model, human): boolean`. `captureDisagreement(store, args)` stamps id/time, enqueues only when verdicts disagree. `consolidateReflexivityQueue(store, evalName, { maxCases? })` reads, dedups by `caseId` (latest wins), caps, returns `ReflexivityCandidate[]` for operator review — never auto-produces an `EvalCase` (rubric is scorer-owned; a human merges into a committed dataset, ADR-0061).
- **Agreement:** `fleissKappa(counts: number[][]): number` — items×categories count-matrix formula. `ensembleAgreement(verdicts: ("pass"|"fail")[][]): number` tallies per case, calls `fleissKappa`. `counterfactualStability(base, variants: ("pass"|"fail")[]): { agree, total, stabilityScore }` — caller supplies base + N variant verdicts already produced by a caller-driven re-run; this package only scores agreement.

## Tasks (for PLAN)

1. `src/exit-classifier.ts` + test (one fixture per class incl. priority ties). Verify: `cd packages/ai-evals && bun test src/exit-classifier.test.ts`.
2. `src/wilson.ts` + test (n=large/100%→tight interval; n=3/100%→wide interval below 0.5). Verify: `bun test src/wilson.test.ts`.
3. Thread `wilsonFloor` through `define-eval.ts`/`baseline.ts`; extend `evals.test.ts` asserting the two committed evals still pass with it unset. Verify: `bun test src/evals.test.ts`.
4. `src/eval-ledger.ts` + test (round-trip; non-integer/negative `costCents` rejected). Verify: `bun test src/eval-ledger.test.ts`.
5. `src/reflexivity-queue.ts` + test (agreement → no enqueue; disagreement → enqueued; consolidate dedups + caps). Verify: `bun test src/reflexivity-queue.test.ts`.
6. `src/agreement.ts` + test (perfect-agreement → kappa 1; hand-computed partial fixture; stability score on a known variant set). Verify: `bun test src/agreement.test.ts`.
7. Re-export new symbols from `src/index.ts`; extend `AGENTS.md` invariants + `manifest.ts` description; changeset naming `ai-evals` (patch). Verify: `bun run check` (repo root) green.

## Verify (goal-backward)

- Existing `evals.test.ts` (compliance-answer + injection-defense vs committed baseline) still passes unmodified — additive, not a breaking rewrite.
- `classifyExit` returns the right class for each of the 7 taxonomy fixtures, deterministically.
- `wilsonLowerBound(3,3)` sits well below `wilsonLowerBound(300,300)` — CI tightens with sample size.
- `recordEvalSpend`/`InMemoryEvalLedgerSink` never import `@caisson/ai-meter` (grep-checkable).
- `captureDisagreement` enqueues only on mismatch; consolidation output is deduped + capped, never auto-merged into a committed dataset.
- `fleissKappa` on a perfect-agreement matrix returns `1`; `bun run check` is green.

## Effort: M (~1–2 days + tests, 4 small-to-medium leaf modules). Value: MEDIUM — hardens an existing revenue package's rigor story (AI Production Kit sells on "evals done right"); no new SKU.
