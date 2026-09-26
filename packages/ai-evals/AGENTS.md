# AGENTS — @caisson-sh/ai-evals

Agent-facing authoring/usage contract (ADR-0020 `agents`). What a generation agent or the AI
Production Kit must know to wire and gate evals correctly.

## Invariants (do not violate)

- **Offline + deterministic by construction (ADR-0062).** Model-graded scorers route
  through the `Judge` port; CI uses the **cassette replay** driver (`cassetteJudge`) — recorded
  verdicts, zero network, zero provider secret. A LIVE judge is injected LOCALLY only and is wrapped
  in `recordingJudge` to mint a reviewable cassette. This package NEVER imports `@caisson-sh/ai-kit` or a
  provider SDK (down-only, ADR-0003) — the live driver is the caller's, passed in.
- **The injection grader is its own fail-closed class.** `injectionGrader` is a deterministic
  substring deny-list; a graded input can never talk it into passing, and an empty/malformed rubric
  (`mustNotContain`) THROWS — the check can't be disabled by omitting it. Never fold injection
  resistance into a model-graded scorer that could be argued out of a refusal.
- **Datasets are version-bound (ADR-0061).** Every dataset carries a `promptVersionId` FK to a
  `prompt_version` row, so a score is attributable to one immutable prompt version. Re-grade a new
  prompt version against the same dataset to compare.
- **The gate is regression-vs-committed-baseline (ADR-0072), BLESS-style.** `gateAgainstBaseline`
  fails closed: an eval that regresses, misses its `threshold`, lacks a baseline entry, or shrank its
  dataset fails. The baseline is rewritten ONLY through `BLESS` (the same discipline as
  `@caisson-sh/testing` `matchGolden`). This runs as a DISTINCT turbo `eval` task in the monorepo —
  **never** a required CI job inside a generated repo.
- **Two entry points.** `.` is the full node-capable surface; `./browser` is the browser-safe
  subset — the gate's rules only (`baseline-compare.ts` + `wilsonLowerBound`), no file I/O. Those
  rules have exactly ONE implementation: `baseline.ts` is the load/save transport around them. A
  client bundle imports `./browser`, never `.`; a module joins `./browser` only if its whole value
  graph passes the package's static source-graph walk (`src/browser-safety.test.ts`), and every
  `./browser` name must also exist on `.`.

## Grader taxonomy

- `exactGrader()` — `expected.equals` string equality.
- `regexGrader()` — `expected.matches` (+ optional `flags`).
- `jsonShapeGrader()` — output parses as JSON and contains every `expected.requiredKeys` dot-path.
- `schemaGrader(zodSchema)` — output parses as JSON and validates against the schema.
- `injectionGrader()` — fail-closed `expected.mustNotContain` deny-list (its own class — cannot be talked into passing by the graded input).
- `judgeGrader(judge, criteria?)` — model-graded via the `Judge` port; `criteria` is fixed at wiring
  time, never read from per-case `expected`, so a graded input cannot rewrite the rubric.

## Usage

```ts
const run = await defineEval({
  name: dataset.eval,
  promptVersionId: dataset.promptVersionId,
  threshold: dataset.threshold,
  cases: dataset.cases,
  scorers: {
    "cites-control": regexGrader(),
    faithfulness: judgeGrader(cassetteJudge(cassette)), // live judge injected locally instead
    "injection-resist": injectionGrader(),
  },
});
const gate = gateAgainstBaseline("__evals__/baseline.json", [run]); // BLESS=1 to re-baseline
if (!gate.passed) throw new Error("eval regression");
```

## Eval-science depth (ADR-0214)

Four dependency-free additions harden the gate's rigor without adding a `package.json` dep or
importing an edition (down-only, ADR-0003):

- **Exit classifier** (`classifyExit`) — WHY a run exited (`success`/`error`/`timeout`/`refusal`/
  `budget-exhausted`/`empty-output`/`unknown`), a grader annotation orthogonal to pass/fail. Pure
  priority chain over a caller-supplied `ExitSignal` — never infers from prose.
- **Wilson-CI gate augmentation** (`wilsonLowerBound`, `wilsonFloor` on `DefineEvalConfig`/`EvalRun`)
  — opt-in and purely additive: unset `wilsonFloor` is zero behavior change. Set, it computes the
  Wilson score lower bound per scorer from `scoredCases[].passes[scorer]` and adds a
  `"wilson-below-floor"` regression finding when the bound sits below the floor — catching a
  lucky-draw small golden set that a flat mean/`threshold` check alone would pass.
- **Eval ledger** (`recordEvalSpend`, `InMemoryEvalLedgerSink`) — eval spend on an injected
  `EvalLedgerSink` port, integer `costCents` (ADR-0007). **Isolation by construction**: this module
  NEVER imports `@caisson-sh/ai-meter` (production budget) or a Postgres dependency.
- **Reflexivity queue** (`captureDisagreement`, `consolidateReflexivityQueue`) — accumulates
  production judge/human verdict disagreements behind an injected `ReflexivityQueueStore` port.
  Consolidation dedups by `caseId` (latest wins) and caps, returning candidates for OPERATOR REVIEW
  only — it never auto-produces an `EvalCase` or writes to a committed dataset (the rubric stays
  scorer-owned, ADR-0061; a human merges).
- **Agreement** (`fleissKappa`, `ensembleAgreement`, `counterfactualStability`) — multi-rater
  agreement over N judge verdicts and a perturbation-stability score. This package only SCORES
  agreement over already-produced variant verdicts; it never generates the counterfactual variants
  themselves (that's an ai-kit/agent-dev concern).

## Out of scope (this primitive)

No provider call, no token metering (`@caisson-sh/ai-meter`), no prompt storage/addressing
(`@caisson-sh/prompt-registry`), no guardrail enforcement (`@caisson-sh/guardrails`). This package only
runs cases through scorers and gates the aggregate against a committed baseline. The golden artifacts
live in `__evals__/` (baseline + cases) and `__cassettes__/` — update the baseline only via `BLESS`.
