// @caisson-sh/ai-evals — the eval harness (ADR-0062). `defineEval({ name, cases, scorers, threshold })`
// runs each case through its scorers and returns a deterministic `EvalRun` summary; the regression
// gate (see `baseline.ts`) then compares that summary to a committed JSON baseline, BLESS-style —
// the same golden discipline `@caisson-sh/testing` `matchGolden` enforces for fixtures (ADR-0013).
//
// Datasets are VERSION-BOUND: every dataset carries a `promptVersionId` FK to a `prompt_version` row
// (ADR-0061), so a score is always attributable to an exact, immutable prompt. The harness never
// resolves the prompt or calls a provider — cases carry the already-produced `output` for replay (or
// a `task` produces it from an injected model locally), keeping CI offline + deterministic.
import { z } from "zod";
import { systemClock, type Clock } from "./clock.ts";
import type { Grader } from "./graders.ts";

// --- Dataset boundary schemas (validated on load, `.strict()`) ----------------------------------

export const evalCaseSchema = z
  .object({
    id: z.string().min(1).max(200),
    input: z.unknown(),
    /** The recorded output to grade (replay datasets). Optional when a live `task` produces it. */
    output: z.string().optional(),
    /** The grader-specific expectation; its shape is owned by the scorer that reads it. */
    expected: z.unknown().optional(),
  })
  .strict();
export type EvalCase = z.infer<typeof evalCaseSchema>;

/** FK → `prompt_version.id` (ADR-0061): the eval is bound to one immutable prompt version. */
const promptVersionFk = z.string().uuid();

export const evalDatasetSchema = z
  .object({
    eval: z.string().min(1).max(200),
    promptVersionId: promptVersionFk,
    promptRef: z.string().min(1).max(256).optional(),
    threshold: z.number().min(0).max(1),
    scorers: z.array(z.string().min(1)).min(1),
    cases: z.array(evalCaseSchema).min(1),
  })
  .strict();
export type EvalDataset = z.infer<typeof evalDatasetSchema>;

/** Parse + validate a raw dataset JSON document. */
export function parseDataset(raw: unknown): EvalDataset {
  return evalDatasetSchema.parse(raw);
}

// --- Run shapes ---------------------------------------------------------------------------------

export interface DefineEvalConfig {
  readonly name: string;
  readonly promptVersionId: string;
  readonly promptRef?: string;
  readonly threshold: number;
  readonly cases: readonly EvalCase[];
  /**
   * Produce the output to grade for a case. Defaults to the case's recorded `output` (replay). A
   * local live run injects a `task` backed by a real model — never imported here (down-only).
   */
  readonly task?: (caseItem: EvalCase) => string | Promise<string>;
  /** scorer name → grader. Keys SHOULD match the dataset's declared `scorers`. */
  readonly scorers: Readonly<Record<string, Grader>>;
  /**
   * Opt-in Wilson-CI confidence floor (ADR-0214), threaded into `compareToBaseline`. Unset → zero
   * behavior change. A confidence floor is distinct from `threshold` (which gates the mean): it's
   * looser, to catch a lucky-draw small sample rather than a genuinely low score.
   */
  readonly wilsonFloor?: number;
  /**
   * The point-in-time reader stamped onto `EvalRun.ranAt` (ADR-0214). Defaults to `systemClock`
   * (live wall-clock). A backtest injects `fixedClock`/`sequencedClock` here instead — the SAME
   * `defineEval` runs, scores, and aggregates identically; only the stamped timestamp differs.
   */
  readonly clock?: Clock;
}

export interface ScoredCase {
  readonly caseId: string;
  readonly scores: Readonly<Record<string, number>>;
  readonly passes: Readonly<Record<string, boolean>>;
  /** Mean of this case's scorer scores. */
  readonly score: number;
}

export interface EvalRun {
  readonly name: string;
  readonly promptVersionId: string;
  readonly promptRef?: string;
  readonly threshold: number;
  readonly cases: number;
  /** Mean case score across the dataset. */
  readonly score: number;
  /** Mean score per scorer across the dataset. */
  readonly scorers: Readonly<Record<string, number>>;
  readonly passed: boolean;
  readonly scoredCases: readonly ScoredCase[];
  /** Carried through from `DefineEvalConfig.wilsonFloor` (ADR-0214) — unset by default. */
  readonly wilsonFloor?: number;
  /**
   * ISO-8601, stamped from `DefineEvalConfig.clock` (ADR-0214) — `systemClock` unless overridden.
   * Optional on the type (a hand-built `EvalRun`, e.g. in a baseline-gate test, need not set it);
   * `defineEval` itself always populates it.
   */
  readonly ranAt?: string;
}

// Scores are means → fractional; round to a fixed precision so a baseline JSON stays byte-stable
// across runs (no float drift). Eval scores are quality ratios, NOT money — floats are correct here.
const PRECISION = 1e4;
const round = (n: number): number => Math.round(n * PRECISION) / PRECISION;

/**
 * Run an eval: grade every case with every scorer, aggregate to a deterministic `EvalRun`. Scorers
 * are applied in a name-sorted order so the run is order-independent. Fail-closed: a case with no
 * task output AND no recorded output throws rather than scoring a phantom 0.
 */
export async function defineEval(config: DefineEvalConfig): Promise<EvalRun> {
  // The seam (ADR-0214): read the decision instant from the injected clock, never `Date.now()`
  // directly, so a backtest replaying this same function with `fixedClock`/`sequencedClock` takes
  // the identical code path as a live run — no replay-only branch to drift out of sync.
  const clock = config.clock ?? systemClock;
  const ranAt = clock.now().toISOString();

  const entries = Object.entries(config.scorers).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  if (entries.length === 0) {
    throw new Error(`eval "${config.name}" has no scorers`);
  }

  const scorerTotals = new Map<string, number>();
  const scoredCases: ScoredCase[] = [];

  for (const caseItem of config.cases) {
    const output = config.task ? await config.task(caseItem) : caseItem.output;
    if (output === undefined) {
      throw new Error(
        `case "${caseItem.id}" of eval "${config.name}" has no task output and no recorded output`,
      );
    }

    const scores: Record<string, number> = {};
    const passes: Record<string, boolean> = {};
    let caseSum = 0;

    for (const [name, grader] of entries) {
      const result = await grader({
        eval: config.name,
        scorer: name,
        caseId: caseItem.id,
        input: caseItem.input,
        output,
        expected: caseItem.expected,
      });
      const score = round(result.score);
      scores[name] = score;
      passes[name] = result.pass;
      caseSum += score;
      scorerTotals.set(name, (scorerTotals.get(name) ?? 0) + score);
    }

    scoredCases.push({
      caseId: caseItem.id,
      scores,
      passes,
      score: round(caseSum / entries.length),
    });
  }

  const caseCount = config.cases.length;
  const scorers: Record<string, number> = {};
  for (const [name] of entries) {
    scorers[name] = round((scorerTotals.get(name) ?? 0) / caseCount);
  }
  const score = round(
    scoredCases.reduce((acc, sc) => acc + sc.score, 0) / caseCount,
  );

  return {
    name: config.name,
    promptVersionId: config.promptVersionId,
    ...(config.promptRef !== undefined ? { promptRef: config.promptRef } : {}),
    threshold: config.threshold,
    cases: caseCount,
    score,
    scorers,
    passed: score >= config.threshold,
    scoredCases,
    ranAt,
    ...(config.wilsonFloor !== undefined
      ? { wilsonFloor: config.wilsonFloor }
      : {}),
  };
}
