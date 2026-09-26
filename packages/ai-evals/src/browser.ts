// The browser-safe entry (`@caisson-sh/ai-evals/browser`): the regression gate's pure half — the
// baseline boundary schema, `compareToBaseline`, the pre-BLESS eligibility check, the BLESS merge,
// and the Wilson lower bound the gate's opt-in confidence floor is computed from. ADDITIVE — the
// `.` barrel is untouched and stays the full node-capable surface; every name here is also on `.`
// (the subset test in browser-safety.test.ts pins that direction, one way only).
//
// DELIBERATELY EXCLUDED, so the next reader does not "complete" this entry:
//   - baseline.ts's `loadBaseline`/`gateAgainstBaseline` — the committed-file transport
//     (node:fs, node:path) and `process.env.BLESS`. Irreducibly node-only.
//   - define-eval.ts's `defineEval` and the grader/judge taxonomy — no node builtin today, but a
//     harness that RUNS a dataset has no browser consumer; admission is by need, not by absence of
//     taint. Its `EvalRun`/`ScoredCase` TYPES are re-exported below (erased at emit, no edge).
// ponytail: the harness joins the day something client-side actually runs an eval.
export * from "./baseline-compare.ts";
export { wilsonLowerBound } from "./wilson.ts";
export type { EvalRun, ScoredCase } from "./define-eval.ts";
