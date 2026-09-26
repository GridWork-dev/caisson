// @caisson-sh/ai-evals — the model-judge port + cassette record/replay driver (ADR-0062).
//
// Model-graded scorers route every judgement through the `Judge` port. CI uses the cassette REPLAY
// driver: recorded verdicts loaded from a committed cassette, zero network, zero provider secret —
// the eval gate must be deterministic and offline. A LIVE judge (a real LLM) is INJECTED
// LOCALLY by the caller; this module never imports the `@caisson-sh/ai-kit` edition or any provider SDK
// (down-only: ai-evals is a base primitive, ADR-0003). A local live run can be wrapped in
// `recordingJudge` to mint a fresh cassette, reviewed, then committed.
import { z } from "zod";

export const JUDGE_VERDICTS = ["pass", "fail"] as const;

// A 100k-char ceiling on the evaluated output (the exact injection vector) — mirrors
// @caisson-sh/local-store MAX_TEXT; the largest plausible model response, not a hard product limit.
const MAX_OUTPUT = 100_000;

/** The request a model-grader hands the judge — never carries a secret or a provider handle. */
export const judgeRequestSchema = z
  .object({
    model: z.string().min(1).max(200),
    eval: z.string().min(1).max(200),
    scorer: z.string().min(1).max(200),
    caseId: z.string().min(1).max(200),
    input: z.unknown(),
    output: z.string().max(MAX_OUTPUT),
    criteria: z.string().max(4000).optional(),
  })
  .strict();
export type JudgeRequest = z.infer<typeof judgeRequestSchema>;

export const judgeVerdictSchema = z
  .object({
    verdict: z.enum(JUDGE_VERDICTS),
    score: z.number().min(0).max(1),
    rationale: z.string(),
  })
  .strict();
export type JudgeVerdict = z.infer<typeof judgeVerdictSchema>;

/** The model-judge port. The ONLY async grading surface; a deterministic grader never touches it. */
export interface Judge {
  readonly model: string;
  evaluate(req: JudgeRequest): Promise<JudgeVerdict>;
}

/** A recorded set of verdicts keyed by case id, for one `(eval, scorer)` pair. */
export const cassetteSchema = z
  .object({
    eval: z.string().min(1),
    scorer: z.string().min(1),
    model: z.string().min(1),
    responses: z.record(z.string(), judgeVerdictSchema),
  })
  .strict();
export type Cassette = z.infer<typeof cassetteSchema>;

/** Parse + validate raw cassette JSON at the load boundary (`.strict()`, ADR-0061 input rules). */
export function parseCassette(raw: unknown): Cassette {
  return cassetteSchema.parse(raw);
}

/**
 * REPLAY driver (the CI default). Returns the recorded verdict for `req.caseId`. Fail-closed: an
 * unknown case id is a HARD error, never a silent pass — a graded input can't dodge a model-grader
 * by being absent from the cassette. Re-record locally with a live judge under `BLESS`.
 */
export function cassetteJudge(cassette: Cassette): Judge {
  const { responses, eval: evalName, scorer, model } = parseCassette(cassette);
  return {
    model,
    evaluate(req: JudgeRequest): Promise<JudgeVerdict> {
      const hit = responses[req.caseId];
      if (hit === undefined) {
        return Promise.reject(
          new Error(
            `cassette miss: no recorded verdict for case "${req.caseId}" (eval "${evalName}", scorer "${scorer}"). Re-record with a live judge under BLESS.`,
          ),
        );
      }
      return Promise.resolve(hit);
    },
  };
}

/** The mutable sink a `recordingJudge` writes captured verdicts into (then serialized to a cassette). */
export interface CassetteSink {
  eval: string;
  scorer: string;
  model: string;
  responses: Record<string, JudgeVerdict>;
}

/**
 * RECORDING wrapper around a LIVE judge (local only). Delegates to `live`, captures each verdict into
 * `sink.responses`, and returns it. Used to mint a fresh cassette for review; never runs in CI (CI
 * has no live judge — `fetchWithTimeout` would gate any real outbound call in the live driver).
 */
export function recordingJudge(live: Judge, sink: CassetteSink): Judge {
  return {
    model: live.model,
    async evaluate(req: JudgeRequest): Promise<JudgeVerdict> {
      const verdict = await live.evaluate(req);
      sink.responses[req.caseId] = verdict;
      return verdict;
    },
  };
}
