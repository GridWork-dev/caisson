/**
 * Pure SVG chart geometry behind the Charts pack — scales, "nice" axis ticks, and path builders.
 * No React, no DOM, no dependency: a component maps its data through these to plain SVG attributes,
 * so the math is unit-tested directly and reused server-side (SSR charts, static reports). Values are
 * plotted in an SVG coordinate space where y grows downward, which the caller's y-scale inverts.
 */

export interface Point {
  x: number;
  y: number;
}

/** `[min, max]` of a numeric series (`[0, 0]` when empty). A loop, never `Math.min(...values)` —
 *  the spread blows the engine's argument limit on large series. */
export function extent(values: readonly number[]): [number, number] {
  if (values.length === 0) return [0, 0];
  let min = values[0]!;
  let max = values[0]!;
  for (let i = 1; i < values.length; i++) {
    const v = values[i]!;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return [min, max];
}

/**
 * A linear map from domain `[d0, d1]` to range `[r0, r1]`. A degenerate domain (`d0 === d1`, e.g. a
 * flat series) maps everything to the range midpoint so a single value plots centered, never NaN.
 */
export function linearScale(
  d0: number,
  d1: number,
  r0: number,
  r1: number,
): (v: number) => number {
  if (d0 === d1) {
    const mid = (r0 + r1) / 2;
    return () => mid;
  }
  const m = (r1 - r0) / (d1 - d0);
  return (v) => r0 + (v - d0) * m;
}

function niceNum(range: number, round: boolean): number {
  const exp = Math.floor(Math.log10(range));
  const frac = range / 10 ** exp;
  let nice: number;
  if (round) nice = frac < 1.5 ? 1 : frac < 3 ? 2 : frac < 7 ? 5 : 10;
  else nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  return nice * 10 ** exp;
}

/**
 * Evenly-spaced "nice" round tick values covering `[min, max]` with about `count` steps (the classic
 * Heckbert nice-numbers algorithm). A zero-width or non-finite domain returns a single tick so an
 * axis always has a label. Ticks are rounded to the step's precision to avoid float dust.
 */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    return [Number.isFinite(min) ? min : 0];
  }
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const step = niceNum(niceNum(hi - lo, false) / Math.max(1, count - 1), true);
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const decimals = Math.max(0, -Math.floor(Math.log10(step)));
  const ticks: number[] = [];
  for (let v = start; v <= end + step * 0.5; v += step) {
    ticks.push(Number(v.toFixed(decimals)));
  }
  return ticks;
}

/** SVG path (`M x y L x y …`) through `points` in order (`""` for an empty series). */
export function linePath(points: readonly Point[]): string {
  if (points.length === 0) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");
}

/** Closed area path: the line through `points`, dropped to `baselineY` and closed back. */
export function areaPath(points: readonly Point[], baselineY: number): string {
  if (points.length === 0) return "";
  const first = points[0]!;
  const last = points[points.length - 1]!;
  return `${linePath(points)} L${last.x} ${baselineY} L${first.x} ${baselineY} Z`;
}
