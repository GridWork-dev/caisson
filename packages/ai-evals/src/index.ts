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

// Exit classifier (ADR-0214) — WHY a run exited, not whether it scored well.
export {
  classifyExit,
  EXIT_CLASSES,
  exitSignalSchema,
} from "./exit-classifier.ts";
export type { ExitClass, ExitSignal } from "./exit-classifier.ts";

// Wilson-CI (ADR-0214) — closed-form confidence-interval statistic, threaded opt-in into the gate.
export { wilsonLowerBound } from "./wilson.ts";

// Budget-isolated eval-spend ledger (ADR-0214) — never touches @caisson/ai-meter or Postgres.
export {
  evalSpendEntrySchema,
  InMemoryEvalLedgerSink,
  recordEvalSpend,
} from "./eval-ledger.ts";
export type {
  EvalLedgerSink,
  EvalSpendEntry,
  RecordEvalSpendArgs,
} from "./eval-ledger.ts";

// Reflexivity queue (ADR-0214) — production judge/human disagreements, queued for operator review.
export {
  captureDisagreement,
  consolidateReflexivityQueue,
  flagsDisagreement,
  InMemoryReflexivityQueueStore,
  reflexivityCandidateSchema,
} from "./reflexivity-queue.ts";
export type {
  CaptureDisagreementArgs,
  ConsolidateOptions,
  ReflexivityCandidate,
  ReflexivityQueueStore,
} from "./reflexivity-queue.ts";

// Fleiss-kappa ensemble agreement + counterfactual stability (ADR-0214).
export {
  counterfactualStability,
  ensembleAgreement,
  fleissKappa,
} from "./agreement.ts";
export type { StabilityResult } from "./agreement.ts";
