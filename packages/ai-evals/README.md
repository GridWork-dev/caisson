# @caisson-sh/ai-evals

An eval harness for AI features: define a dataset of cases, score them with a grader, and gate a
build on a committed baseline instead of a gut feeling. Runs fully offline and deterministic — no
live model call, no secret, no flaky network dependency — so the same suite produces the same
verdict in CI every time.

- **Layer:** base

## What it gives you

- **`defineEval`** — run a named dataset of cases through one or more scorers and get back a
  deterministic summary (per-case scores, pass rate, and a rationale for every result).
- **A grader taxonomy** — deterministic graders (`exactGrader`, `regexGrader`,
  `jsonShapeGrader`, `schemaGrader`) for pure pattern/shape checks, `judgeGrader` for model-graded
  scoring against a recorded judge transcript, and a dedicated `injectionGrader` whose refusal
  rubric is a hard-coded deny-list — a persuasive input can talk a model judge out of a refusal,
  it can never talk a deny-list out of one.
- **A regression gate** — `gateAgainstBaseline` compares a fresh run against a committed JSON
  baseline and fails the build on a regression past tolerance, the same "bless the new baseline
  on purpose" discipline as a golden-file test.
- **Confidence + agreement statistics** — a closed-form Wilson confidence interval
  (`wilsonLowerBound`) and Fleiss-kappa ensemble agreement (`fleissKappa`,
  `ensembleAgreement`, `counterfactualStability`) for scoring an eval suite's own reliability, not
  just its pass rate.
- **A reflexivity queue** — capture cases where a model judge and a human disagree
  (`captureDisagreement`) and consolidate them for operator review, so judge drift gets caught
  before it silently lowers the bar.
- **A budget-isolated spend ledger** — `recordEvalSpend` tracks eval-run cost on its own ledger,
  never touching the production credit wallet.

## Usage

```ts
import {
  defineEval,
  exactGrader,
  gateAgainstBaseline,
} from "@caisson-sh/ai-evals";

const run = await defineEval({
  name: "greeting-quality",
  promptVersionId: version.id,
  threshold: 0.95,
  cases: [{ id: "case-1", input: { name: "Ada" }, output: "Hello, Ada!" }],
  scorers: { "exact-match": exactGrader() },
});

const gate = gateAgainstBaseline("__evals__/baseline.json", [run]);
if (!gate.passed) throw new Error("eval regressed past its committed baseline");
```

## Entry points

- `.` — the full surface, node-capable (the harness, the graders, and the baseline file's
  load/save transport).
- `./browser` — the browser-safe subset: the gate's rules with no file I/O. The baseline boundary
  schema, `compareToBaseline`, `assertRunEligibleForBaseline`, the BLESS merge
  (`mergeIntoBaseline`), and `wilsonLowerBound`. Import it to show or check a comparison in a
  client bundle; `gateAgainstBaseline` stays on `.` because it reads and writes the committed file.
  Every name on `./browser` is also on `.`.

## Test

```sh
bun test packages/ai-evals/src
```
