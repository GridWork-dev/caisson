// @caisson-sh/ai-evals — eval harness + grader taxonomy + regression-vs-committed-baseline gate
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

// Point-in-time reader seam (ADR-0214) — backtest-via-live-code-path replay: `defineEval`,
// `recordEvalSpend`, and `captureDisagreement` all take an optional `Clock` instead of reading
// `Date.now()`/`new Date()` internally, so a replay run takes the identical code path as a live run.
export { systemClock, fixedClock, sequencedClock } from "./clock.ts";
export type { Clock } from "./clock.ts";

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

// Regression gate — the pure rules (also on the `./browser` entry) …
export {
  baselineEntrySchema,
  baselineFileSchema,
  compareToBaseline,
  assertRunEligibleForBaseline,
  mergeIntoBaseline,
} from "./baseline-compare.ts";
export type {
  BaselineEntry,
  BaselineFile,
  BaselineComparison,
  RegressionFinding,
  RegressionKind,
} from "./baseline-compare.ts";
// … and the committed-file transport around them (node-only).
export { loadBaseline, gateAgainstBaseline } from "./baseline.ts";
export type { BaselineGateResult } from "./baseline.ts";

// Exit classifier (ADR-0214) — WHY a run exited, not whether it scored well.
export {
  classifyExit,
  EXIT_CLASSES,
  exitSignalSchema,
} from "./exit-classifier.ts";
export type { ExitClass, ExitSignal } from "./exit-classifier.ts";

// Wilson-CI (ADR-0214) — closed-form confidence-interval statistic, threaded opt-in into the gate.
export { wilsonLowerBound } from "./wilson.ts";

// Budget-isolated eval-spend ledger (ADR-0214) — never touches @caisson-sh/ai-meter or Postgres.
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

// Trajectory graders (ADR-0360 U-7) — the one accepted new dependency, on @caisson-sh/agent-trajectory
// (primitive->primitive). Deterministic: tool-choice vs allowlist, unnecessary-call detection,
// approval compliance, and budget adherence, over the agent-runtime bounded loop's own event log.
export {
  buildTrajectoryFixture,
  trajectoryApprovalComplianceGrader,
  trajectoryBudgetAdherenceGrader,
  trajectoryToolChoiceGrader,
  trajectoryUnnecessaryCallGrader,
} from "./trajectory-graders.ts";
export type {
  TrajectoryCaseKind,
  TrajectoryExpected,
  TrajectoryFixture,
} from "./trajectory-graders.ts";
