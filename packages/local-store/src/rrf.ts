// src/rrf.ts — the Reciprocal Rank Fusion arithmetic, extracted from `LocalStore.hybridSearch`
// (ADR-0067) as a pure function so the fusion has exactly ONE implementation and can run anywhere.
//
// Nothing in here opens a database: it takes already-ranked legs (rowid → 1-based rank, exactly
// what `vecLeg`/`ftsLeg` produce) and returns the fused ranking. That keeps it free of `bun:sqlite`,
// `sqlite-vec`, and every node builtin — the reason it is also the whole of the package's
// `./browser` entry point (`browser-safety.test.ts` proves that by a static source-graph walk).
import { ValidationError } from "@caisson-sh/kernel";

/** RRF constant — standard 60; dampens the weight of any single ranking. */
export const RRF_K = 60;

/** One ranking to fuse: `rowid → 1-based rank`, scaled by `weight` (the classic form is 1.0). */
export interface RrfLeg {
  readonly ranks: ReadonlyMap<number, number>;
  readonly weight: number;
}

/** One fused row: the key it was ranked under, and its summed RRF score (higher = better). */
export interface RrfRow {
  readonly key: number;
  readonly score: number;
}

export interface RrfOptions {
  /**
   * The dampening constant. Defaults to {@link RRF_K}, which is what `hybridSearch` always fuses
   * at; it is a parameter because it is part of the formula's definition, not a store setting.
   */
  readonly rrfK?: number;
  /** Keep only the top N rows. Omitted ⇒ every row a leg reached. */
  readonly limit?: number;
}

/** Every RRF divisor and multiplier must be a positive finite number — flag-never-guess. */
function assertPositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new ValidationError(`${name} must be a positive finite number`, {
      received: value,
    });
  }
}

/**
 * Fuse N ranked legs by Reciprocal Rank Fusion: every leg a key appears in contributes
 * `weight / (rrfK + rank)`, the contributions sum per key, and the result sorts by score descending
 * with a deterministic key-ascending tie-break (stable, env-free — no wall clock, no run-to-run
 * ordering). A key absent from every leg never appears; it is not synthesized as a zero-score row.
 */
export function fuseByRrf(
  legs: readonly RrfLeg[],
  opts: RrfOptions = {},
): RrfRow[] {
  const rrfK = opts.rrfK ?? RRF_K;
  assertPositive(rrfK, "rrfK");
  if (
    opts.limit !== undefined &&
    !(Number.isInteger(opts.limit) && opts.limit >= 0)
  ) {
    throw new ValidationError("limit must be a non-negative integer", {
      received: opts.limit,
    });
  }
  const fused = new Map<number, number>();
  for (const leg of legs) {
    assertPositive(leg.weight, "RRF leg weight");
    for (const [key, rank] of leg.ranks) {
      fused.set(key, (fused.get(key) ?? 0) + leg.weight / (rrfK + rank));
    }
  }
  const ranked = [...fused.entries()].sort(
    (a, b) => b[1] - a[1] || a[0] - b[0],
  );
  const rows = opts.limit === undefined ? ranked : ranked.slice(0, opts.limit);
  return rows.map(([key, score]) => ({ key, score }));
}
