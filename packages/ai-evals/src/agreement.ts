// @caisson-sh/ai-evals — multi-rater agreement + counterfactual stability (ADR-0214). `fleissKappa` is
// the standard items×categories count-matrix formula, dependency-free. This package never generates
// the counterfactual variants themselves (that's an ai-kit/agent-dev concern) — it only scores
// agreement over verdicts a caller already produced.
const CATEGORIES = ["pass", "fail"] as const;
type Verdict = (typeof CATEGORIES)[number];

/**
 * Fleiss' kappa over an items×categories count matrix: `counts[i][j]` = number of raters who assigned
 * item `i` to category `j`. Every row must have the same rater count `n` (>= 2) and the same number of
 * categories. Returns `1` for the degenerate zero-variance case (every rater picks the same category
 * for every item) — pBar is also 1 there, so `0/0` resolves to perfect agreement, not undefined.
 */
export function fleissKappa(counts: readonly (readonly number[])[]): number {
  if (counts.length === 0) {
    throw new Error("fleissKappa: at least one item is required");
  }
  const itemCount = counts.length;
  const categoryCount = counts[0]!.length;
  const raterCount = counts[0]!.reduce((a, b) => a + b, 0);
  if (raterCount < 2) {
    throw new Error("fleissKappa: at least 2 raters per item are required");
  }

  const categoryTotals = new Array<number>(categoryCount).fill(0);
  let sumOfItemAgreement = 0;

  for (const row of counts) {
    if (row.length !== categoryCount) {
      throw new Error(
        "fleissKappa: every item must report the same categories",
      );
    }
    let rowSum = 0;
    let squaredSum = 0;
    for (let j = 0; j < categoryCount; j++) {
      const c = row[j]!;
      categoryTotals[j] = categoryTotals[j]! + c;
      rowSum += c;
      squaredSum += c * c;
    }
    if (rowSum !== raterCount) {
      throw new Error("fleissKappa: every item must have the same rater count");
    }
    sumOfItemAgreement +=
      (squaredSum - raterCount) / (raterCount * (raterCount - 1));
  }

  const pBar = sumOfItemAgreement / itemCount;
  const peBar = categoryTotals.reduce(
    (acc, total) => acc + (total / (itemCount * raterCount)) ** 2,
    0,
  );

  const denominator = 1 - peBar;
  if (Math.abs(denominator) < 1e-12) return 1;
  return (pBar - peBar) / denominator;
}

/**
 * Tally `verdicts` (one `"pass"|"fail"` array per item, one entry per rater) into a count matrix and
 * score it with `fleissKappa`.
 */
export function ensembleAgreement(
  verdicts: readonly (readonly Verdict[])[],
): number {
  const counts = verdicts.map((item) => {
    const row = [0, 0];
    for (const v of item) {
      row[CATEGORIES.indexOf(v)]! += 1;
    }
    return row;
  });
  return fleissKappa(counts);
}

export interface StabilityResult {
  readonly agree: number;
  readonly total: number;
  /** `agree / total`, normalized 0..1. */
  readonly stabilityScore: number;
}

/**
 * How many of `variants` (verdicts from an already-produced perturbation re-run) match `base` (the
 * verdict on the original input). The caller drives the re-run; this only scores agreement.
 */
export function counterfactualStability(
  base: Verdict,
  variants: readonly Verdict[],
): StabilityResult {
  const total = variants.length;
  const agree = variants.filter((v) => v === base).length;
  // 0 variants → vacuously stable (1, no counterexample observed). Revisit if a real
  // zero-variant call needs to distinguish "stable" from "untested".
  const stabilityScore = total === 0 ? 1 : agree / total;
  return { agree, total, stabilityScore };
}
