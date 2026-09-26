// @caisson-sh/ai-evals — the Wilson score interval (ADR-0214). Closed-form, dependency-free: a small
// golden set at 100% pass isn't the same confidence as a large one at 100% — the lower bound narrows
// the gap between "we got lucky" and "this is actually reliable". Threaded into `baseline.ts` as an
// opt-in, additive gate augmentation (see `wilsonFloor` there).

/**
 * The lower bound of the Wilson score confidence interval for `successes` out of `n` trials, at
 * z-score `z` (default 1.96 ≈ 95%). `n = 0` has no evidence at all — the most conservative answer is
 * a lower bound of `0`.
 */
export function wilsonLowerBound(
  successes: number,
  n: number,
  z = 1.96,
): number {
  if (n <= 0) return 0;
  const phat = successes / n;
  const z2 = z * z;
  const denominator = 1 + z2 / n;
  const center = phat + z2 / (2 * n);
  const margin = z * Math.sqrt((phat * (1 - phat)) / n + z2 / (4 * n * n));
  // Clamp: the closed form is exactly in [0,1] mathematically; float sqrt error can nudge a 0%/100%
  // edge case a few ULPs outside that range (e.g. -2e-17 for 0 successes).
  return Math.min(1, Math.max(0, (center - margin) / denominator));
}
