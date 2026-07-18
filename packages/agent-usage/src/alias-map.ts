// Dated-model-id -> pricebook-row alias map (ADR-0360 U-4, AR-3). A trajectory adapter reports the
// exact provider/model string it read off the wire (a dated snapshot id, e.g.
// `claude-sonnet-4-5-20250514`); ai-meter's `BUNDLED_PRICE_BOOK` is keyed by a small, hand-curated
// set of stable rows (e.g. `anthropic/claude-sonnet-4.5`). This map is the ONLY bridge between the
// two: an unknown model or a missing alias resolves to `null` and the caller stays `estimated` —
// never a guess, never a nearest-match heuristic (the ccusage `gpt-5` display-fallback failure mode
// this package's honesty bars explicitly reject).
export interface PriceBookAlias {
  readonly provider: string;
  readonly model: string;
}

/** `"<reported provider>/<reported model>"` -> the exact `BUNDLED_PRICE_BOOK` row it prices against.
 *  Extend deliberately, one dated id at a time — never a pattern/regex match. */
const MODEL_ALIASES: Readonly<Record<string, PriceBookAlias>> = {
  "anthropic/claude-sonnet-4-5-20250514": {
    provider: "anthropic",
    model: "claude-sonnet-4.5",
  },
  "anthropic/claude-3-5-haiku-20241022": {
    provider: "anthropic",
    model: "claude-3-5-haiku",
  },
  "openai/gpt-4o-mini-2024-07-18": {
    provider: "openai",
    model: "gpt-4o-mini",
  },
};

/** Resolve a reported `(provider, model)` to its price-book row, or `null` on any miss. */
export function resolveModelAlias(
  provider: string,
  model: string,
): PriceBookAlias | null {
  return MODEL_ALIASES[`${provider}/${model}`] ?? null;
}
