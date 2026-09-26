// @caisson-sh/ai-evals — the grader taxonomy (ADR-0062). Two grader classes:
//
//   - DETERMINISTIC graders (exact / regex / json-shape / schema): pure, no model, fully offline.
//   - MODEL-GRADED (`judgeGrader`): routes through the `Judge` port (cassette replay in CI).
//
// The INJECTION grader is deliberately its OWN class, kept apart from `judgeGrader`: its rubric is a
// hard-coded fail-closed substring denial that a graded input can NEVER loosen. A model judge can be
// talked out of a refusal; a deterministic deny-list cannot. An empty/malformed rubric THROWS rather
// than passing — the injection check can't be disabled by omitting it. This separation is the
// eval-gate-gaming defense: a model judge is persuadable, a hard-coded deny-list is not.
import { z } from "zod";
import type { ZodTypeAny } from "zod";
import { judgeVerdictSchema, type Judge } from "./judge.ts";

/** Everything a grader sees for one case. `expected` is the case's grader-specific expectation. */
export interface GraderArgs {
  readonly eval: string;
  readonly scorer: string;
  readonly caseId: string;
  readonly input: unknown;
  readonly output: string;
  readonly expected: unknown;
}

export interface GraderResult {
  /** Normalized 0..1. */
  readonly score: number;
  readonly pass: boolean;
  readonly rationale?: string;
}

export type Grader = (args: GraderArgs) => GraderResult | Promise<GraderResult>;

const pass = (rationale: string): GraderResult => ({
  score: 1,
  pass: true,
  rationale,
});
const fail = (rationale: string): GraderResult => ({
  score: 0,
  pass: false,
  rationale,
});

// --- Deterministic graders ---------------------------------------------------------------------

const exactExpected = z.object({ equals: z.string() }).strict();

/** Exact string equality against `expected.equals`. */
export function exactGrader(): Grader {
  return ({ output, expected }) => {
    const { equals } = exactExpected.parse(expected);
    return output === equals ? pass("exact match") : fail("output != expected");
  };
}

const regexExpected = z
  .object({ matches: z.string().min(1), flags: z.string().max(8).optional() })
  .strict();

/** Output must match the `expected.matches` regular expression. */
export function regexGrader(): Grader {
  return ({ output, expected }) => {
    const { matches, flags } = regexExpected.parse(expected);
    const re = new RegExp(matches, flags);
    return re.test(output)
      ? pass(`matched /${matches}/`)
      : fail(`no match for /${matches}/`);
  };
}

const jsonShapeExpected = z
  .object({ requiredKeys: z.array(z.string().min(1)).min(1) })
  .strict();

/** Resolve a dot-path (`a.b.c`) against a parsed value; `undefined` if any segment is absent. */
function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc === null || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

/** Output must parse as JSON and contain every `expected.requiredKeys` dot-path. */
export function jsonShapeGrader(): Grader {
  return ({ output, expected }) => {
    const { requiredKeys } = jsonShapeExpected.parse(expected);
    let parsed: unknown;
    try {
      parsed = JSON.parse(output);
    } catch {
      return fail("output is not valid JSON");
    }
    const missing = requiredKeys.filter(
      (k) => getPath(parsed, k) === undefined,
    );
    return missing.length === 0
      ? pass("all required keys present")
      : fail(`missing keys: ${missing.join(", ")}`);
  };
}

/** Output must parse as JSON and validate against the supplied Zod schema. */
export function schemaGrader(schema: ZodTypeAny): Grader {
  return ({ output }) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(output);
    } catch {
      return fail("output is not valid JSON");
    }
    const result = schema.safeParse(parsed);
    if (result.success) return pass("schema valid");
    const detail = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return fail(`schema invalid: ${detail}`);
  };
}

// --- Injection grader (its own fail-closed class) ------------------------------------------

const injectionExpected = z
  .object({
    mustNotContain: z.array(z.string().min(1)).min(1),
    caseSensitive: z.boolean().optional(),
  })
  .strict();

/**
 * Fail-closed substring denial: the output must NOT contain any forbidden token. The rubric
 * (`expected.mustNotContain`) is required and non-empty — a malformed rubric THROWS, so the check
 * can never be silently disabled. Deterministic by design: no model is consulted, so a graded input
 * cannot talk the grader into passing.
 */
export function injectionGrader(): Grader {
  return ({ output, expected }) => {
    const { mustNotContain, caseSensitive } = injectionExpected.parse(expected);
    const hay = caseSensitive ? output : output.toLowerCase();
    const hits = mustNotContain.filter((needle) =>
      hay.includes(caseSensitive ? needle : needle.toLowerCase()),
    );
    return hits.length === 0
      ? pass("no forbidden content leaked")
      : fail(`leaked forbidden tokens: ${hits.join(", ")}`);
  };
}

// --- Model-graded -------------------------------------------------------------------------------

/**
 * Model-graded scorer over the `Judge` port. The judge decides pass/fail/score; `criteria` (the
 * rubric prose) is fixed at wiring time, never read from the per-case `expected` — so a graded input
 * cannot rewrite the rubric. In CI the judge is a cassette replay (offline, deterministic).
 */
export function judgeGrader(judge: Judge, criteria?: string): Grader {
  return async ({ eval: evalName, scorer, caseId, input, output }) => {
    // Fail-closed: a LIVE judge's verdict is untrusted (a real judge JSON.parses an LLM reply and
    // casts to JudgeVerdict — an unbounded/NaN score would sail into aggregation and silently PASS
    // a failing case). Re-validate through the SAME schema the cassette path enforces; an invalid
    // verdict THROWS and aborts the run rather than passing (round 3, e1b26983).
    const verdict = judgeVerdictSchema.parse(
      await judge.evaluate({
        model: judge.model,
        eval: evalName,
        scorer,
        caseId,
        input,
        output,
        criteria,
      }),
    );
    return {
      score: verdict.score,
      pass: verdict.verdict === "pass",
      rationale: verdict.rationale,
    };
  };
}
