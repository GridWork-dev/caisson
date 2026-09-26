// @caisson-sh/ai-evals — the point-in-time reader seam (ADR-0214, glossread `backfill-one.ts` pattern,
// rebuild-clean). Every entry point in this package that stamps a decision timestamp (`defineEval`'s
// `ranAt`, `recordEvalSpend`'s `ranAt`, `captureDisagreement`'s `capturedAt`) takes a `Clock` instead
// of reading `Date.now()`/`new Date()` directly. A backtest then replays through the EXACT SAME
// function with a fixed/sequenced `Clock` injected — there is no separate "replay mode" branch to
// drift out of sync with the live path.
export interface Clock {
  now(): Date;
}

/** LIVE implementation — wall-clock time. The default everywhere a `Clock` is left unset. */
export const systemClock: Clock = {
  now: () => new Date(),
};

/** REPLAY implementation — returns the same fixed instant on every call. */
export function fixedClock(at: Date | string): Clock {
  const instant = typeof at === "string" ? new Date(at) : at;
  return { now: () => instant };
}

/**
 * REPLAY implementation — returns each timestamp in `timestamps` once, in call order, then keeps
 * returning the last one for any further calls (a backtest re-running more cases than the source
 * decision log seeded should keep replaying, not throw).
 */
export function sequencedClock(timestamps: readonly (Date | string)[]): Clock {
  if (timestamps.length === 0) {
    throw new Error("sequencedClock: at least one timestamp is required");
  }
  const instants = timestamps.map((t) =>
    typeof t === "string" ? new Date(t) : t,
  );
  let cursor = 0;
  return {
    now: () => {
      const instant = instants[Math.min(cursor, instants.length - 1)]!;
      cursor += 1;
      return instant;
    },
  };
}
