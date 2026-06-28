# AGENTS — @caisson/ai-evals

Agent-facing authoring/usage contract (ADR-0020 `agents`). What a generation agent or the AI
Production Kit must know to wire and gate evals correctly.

## Invariants (do not violate)

- **Offline + deterministic by construction (ADR-0062, SPEC TM6).** Model-graded scorers route
  through the `Judge` port; CI uses the **cassette replay** driver (`cassetteJudge`) — recorded
  verdicts, zero network, zero provider secret. A LIVE judge is injected LOCALLY only and is wrapped
  in `recordingJudge` to mint a reviewable cassette. This package NEVER imports `@caisson/ai-kit` or a
  provider SDK (down-only, ADR-0003) — the live driver is the caller's, passed in.
- **The injection grader is its own fail-closed class (TM9).** `injectionGrader` is a deterministic
  substring deny-list; a graded input can never talk it into passing, and an empty/malformed rubric
  (`mustNotContain`) THROWS — the check can't be disabled by omitting it. Never fold injection
  resistance into a model-graded scorer that could be argued out of a refusal.
- **Datasets are version-bound (ADR-0061).** Every dataset carries a `promptVersionId` FK to a
  `prompt_version` row, so a score is attributable to one immutable prompt version. Re-grade a new
  prompt version against the same dataset to compare.
- **The gate is regression-vs-committed-baseline (ADR-0072), BLESS-style.** `gateAgainstBaseline`
  fails closed: an eval that regresses, misses its `threshold`, lacks a baseline entry, or shrank its
  dataset fails. The baseline is rewritten ONLY through `BLESS` (the same discipline as
  `@caisson/testing` `matchGolden`). This runs as a DISTINCT turbo `eval` task in the monorepo —
  **never** a required CI job inside a generated buyer repo.

## Grader taxonomy

- `exactGrader()` — `expected.equals` string equality.
- `regexGrader()` — `expected.matches` (+ optional `flags`).
- `jsonShapeGrader()` — output parses as JSON and contains every `expected.requiredKeys` dot-path.
- `schemaGrader(zodSchema)` — output parses as JSON and validates against the schema.
- `injectionGrader()` — fail-closed `expected.mustNotContain` deny-list (its own class, TM9).
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

## Out of scope (this primitive)

No provider call, no token metering (`@caisson/ai-meter`), no prompt storage/addressing
(`@caisson/prompt-registry`), no guardrail enforcement (`@caisson/guardrails`). This package only
runs cases through scorers and gates the aggregate against a committed baseline. The golden artifacts
live in `__evals__/` (baseline + cases) and `__cassettes__/` — update the baseline only via `BLESS`.
