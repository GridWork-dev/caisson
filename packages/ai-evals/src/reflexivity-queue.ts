// @caisson-sh/ai-evals — the reflexivity queue (ADR-0214). Captures
// production judge/human disagreements so they can be recycled into the golden set — but this module
// NEVER auto-produces an `EvalCase`: the rubric is scorer-owned, and a human merges a consolidated
// candidate into a committed dataset (ADR-0061). Storage is an injected port, mirroring `Judge`.
import { z } from "zod";
import { systemClock, type Clock } from "./clock.ts";

const VERDICTS = ["pass", "fail"] as const;
type Verdict = (typeof VERDICTS)[number];

/** One captured production disagreement, awaiting operator review. `.strict()`. */
export const reflexivityCandidateSchema = z
  .object({
    id: z.string().uuid(),
    evalName: z.string().min(1).max(200),
    caseId: z.string().min(1).max(200),
    input: z.unknown(),
    output: z.string(),
    modelVerdict: z.enum(VERDICTS),
    humanVerdict: z.enum(VERDICTS),
    capturedAt: z.string().datetime(),
  })
  .strict();
export type ReflexivityCandidate = z.infer<typeof reflexivityCandidateSchema>;

/** The queue port. `InMemoryReflexivityQueueStore` backs tests/local dev. */
export interface ReflexivityQueueStore {
  enqueue(candidate: ReflexivityCandidate): void | Promise<void>;
  list(
    evalName: string,
  ): readonly ReflexivityCandidate[] | Promise<readonly ReflexivityCandidate[]>;
}

/** In-memory queue, keyed by `evalName`, for tests + local development. */
export class InMemoryReflexivityQueueStore implements ReflexivityQueueStore {
  readonly #byEval = new Map<string, ReflexivityCandidate[]>();

  enqueue(candidate: ReflexivityCandidate): void {
    const list = this.#byEval.get(candidate.evalName) ?? [];
    list.push(candidate);
    this.#byEval.set(candidate.evalName, list);
  }

  list(evalName: string): readonly ReflexivityCandidate[] {
    return this.#byEval.get(evalName) ?? [];
  }
}

/** True when the model's verdict disagrees with the human's — the sole capture trigger. */
export function flagsDisagreement(model: Verdict, human: Verdict): boolean {
  return model !== human;
}

export interface CaptureDisagreementArgs {
  readonly evalName: string;
  readonly caseId: string;
  readonly input: unknown;
  readonly output: string;
  readonly modelVerdict: Verdict;
  readonly humanVerdict: Verdict;
  /** The point-in-time reader stamped onto `capturedAt` (ADR-0214). Defaults to `systemClock`. */
  readonly clock?: Clock;
}

/**
 * Stamp `id`/`capturedAt` and enqueue — but ONLY when the verdicts disagree. Agreement is not
 * interesting to the reflexivity queue (there's nothing to recycle) so it's a silent no-op.
 * `capturedAt` reads `args.clock` (default `systemClock`), never `Date.now()` directly — a backtest
 * replays this same function with a fixed/sequenced clock injected.
 */
export async function captureDisagreement(
  store: ReflexivityQueueStore,
  args: CaptureDisagreementArgs,
): Promise<ReflexivityCandidate | undefined> {
  if (!flagsDisagreement(args.modelVerdict, args.humanVerdict)) {
    return undefined;
  }
  const clock = args.clock ?? systemClock;
  const candidate = reflexivityCandidateSchema.parse({
    id: crypto.randomUUID(),
    evalName: args.evalName,
    caseId: args.caseId,
    input: args.input,
    output: args.output,
    modelVerdict: args.modelVerdict,
    humanVerdict: args.humanVerdict,
    capturedAt: clock.now().toISOString(),
  });
  await store.enqueue(candidate);
  return candidate;
}

export interface ConsolidateOptions {
  /** Cap the returned list to at most this many candidates. Unset → no cap. */
  readonly maxCases?: number;
}

/**
 * Read the queue for `evalName`, dedup by `caseId` (latest enqueue wins), cap at `maxCases`, and
 * return it for OPERATOR REVIEW. Never writes back — merging into a committed dataset is a human
 * act (ADR-0061); this is a read-side consolidation only.
 */
export async function consolidateReflexivityQueue(
  store: ReflexivityQueueStore,
  evalName: string,
  opts: ConsolidateOptions = {},
): Promise<readonly ReflexivityCandidate[]> {
  const all = await store.list(evalName);
  const byCaseLatest = new Map<string, ReflexivityCandidate>();
  // Later entries in list order overwrite earlier ones for the same caseId — "latest wins" without
  // relying on capturedAt tie-breaking (two captures in the same millisecond are otherwise ambiguous).
  for (const candidate of all) {
    byCaseLatest.set(candidate.caseId, candidate);
  }
  const deduped = [...byCaseLatest.values()];
  return opts.maxCases !== undefined
    ? deduped.slice(0, opts.maxCases)
    : deduped;
}
