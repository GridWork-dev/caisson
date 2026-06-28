// @caisson/ai-evals — eval harness + grader taxonomy + regression-vs-committed-baseline gate
// (ADR-0062). A base primitive: the AI Production Kit gates prompt/agent quality through it. Offline
// + deterministic by construction (cassette-replayed model graders, no provider call, no secret); a
// live judge is injected locally only. Never imports an edition (down-only, ADR-0003).

// Harness.
export {
  defineEval,
  parseDataset,
  evalCaseSchema,
  evalDatasetSchema,
} from "./define-eval.ts";
export type {
  EvalCase,
  EvalDataset,
  DefineEvalConfig,
  ScoredCase,
  EvalRun,
} from "./define-eval.ts";

// Grader taxonomy.
export {
  exactGrader,
  regexGrader,
  jsonShapeGrader,
  schemaGrader,
  injectionGrader,
  judgeGrader,
} from "./graders.ts";
export type { Grader, GraderArgs, GraderResult } from "./graders.ts";

// Model-judge port + cassette record/replay.
export {
  JUDGE_VERDICTS,
  judgeRequestSchema,
  judgeVerdictSchema,
  cassetteSchema,
  parseCassette,
  cassetteJudge,
  recordingJudge,
} from "./judge.ts";
export type {
  Judge,
  JudgeRequest,
  JudgeVerdict,
  Cassette,
  CassetteSink,
} from "./judge.ts";

// Regression gate.
export {
  baselineEntrySchema,
  baselineFileSchema,
  compareToBaseline,
  loadBaseline,
  gateAgainstBaseline,
} from "./baseline.ts";
export type {
  BaselineEntry,
  BaselineFile,
  BaselineComparison,
  BaselineGateResult,
  RegressionFinding,
  RegressionKind,
} from "./baseline.ts";
