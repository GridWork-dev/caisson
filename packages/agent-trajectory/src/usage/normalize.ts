// Price normalization (ADR-0360 U-4, AR-3): upgrade a `model.usage` event's `billingStatus` from
// `estimated` to `priced` when the reported provider/model resolves through the alias map to a
// `BUNDLED_PRICE_BOOK` row. `priced` is a cost STATEMENT, never a charge — it reuses ai-meter's
// `resolvePriceEntry`/`computeCost` (integer micro-USD, ceil rounding, ADR-0060) VERBATIM; this
// module never re-implements the pricing math, it only reshapes a trajectory event into ai-meter's
// `Usage` and reshapes the `CostBreakdown` back into the trajectory schema's credit field.
//
// Pure and deterministic: never mutates an input event, and an event that does not qualify (already
// `metered`/`priced`/`unsupported`, or `estimated` with no alias hit) is returned BY REFERENCE
// unchanged. Every emitted `priced` event is re-validated through `TrajectoryEvent`/`parseStrict` so
// a normalizer bug surfaces as a thrown `ValidationError`, never a silently malformed event.
import {
  BUNDLED_PRICE_BOOK,
  CREDIT_CONVERSION,
  PRICE_BOOK_VERSION,
  computeCost,
  resolvePriceEntry,
  type CreditConversion,
  type PriceBook,
  type Usage,
} from "@caisson-sh/ai-meter";
import { parseStrict } from "@caisson-sh/kernel";
import { TrajectoryEvent } from "../browser.ts";
import { resolveModelAlias } from "./alias-map.ts";

export interface PriceUsageOptions {
  /** Defaults to ai-meter's `BUNDLED_PRICE_BOOK`; a `forge.config` override may be threaded in. */
  readonly book?: PriceBook;
  readonly conversion?: CreditConversion;
}

/**
 * `inputTokens`/`cachedInputTokens` on the trajectory schema are ADDITIVE (the Claude adapter's own
 * reading of Anthropic's usage shape: `input_tokens` excludes cache, `cache_read_input_tokens` is a
 * separate count) — every adapter in this package writes that same convention so `replay.ts`'s blind
 * per-band sum stays meaningful regardless of source adapter. ai-meter's `Usage.inputTokens` is the
 * opposite: cache-INCLUSIVE, with `cachedInputTokens` a subset (`cachedInputTokens <= inputTokens`).
 * Reassembling the inclusive total here (`inputTokens + cachedInputTokens`) is the one, sole place
 * that reconciles the two conventions.
 */
function toMeterUsage(payload: {
  readonly inputTokens: number;
  readonly cachedInputTokens: number;
  readonly outputTokens: number;
}): Usage {
  return {
    inputTokens: payload.inputTokens + payload.cachedInputTokens,
    cachedInputTokens: payload.cachedInputTokens,
    outputTokens: payload.outputTokens,
  };
}

/**
 * Price-normalize every `estimated` `model.usage` event in `events` that resolves through the alias
 * map; every other event (already `metered`/`priced`/`unsupported`, a non-usage kind, or an
 * `estimated` event with no alias hit) passes through unchanged. Never throws on a miss — an unknown
 * model, an unpriced price-book row (`resolvePriceEntry`'s `ConfigError`), stays `estimated`.
 */
export function priceUsage(
  events: readonly TrajectoryEvent[],
  options: PriceUsageOptions = {},
): TrajectoryEvent[] {
  const book = options.book ?? BUNDLED_PRICE_BOOK;
  const conversion = options.conversion ?? CREDIT_CONVERSION;

  return events.map((event) => {
    if (
      event.kind !== "model.usage" ||
      event.payload.billingStatus !== "estimated"
    ) {
      return event;
    }

    const alias = resolveModelAlias(
      event.payload.provider,
      event.payload.model,
    );
    if (alias === null) return event; // no alias -> stays estimated, never a guess

    let entry;
    try {
      entry = resolvePriceEntry(book, alias.provider, alias.model);
    } catch {
      return event; // unpriced book row -> stays estimated, never a guess
    }

    const cost = computeCost(toMeterUsage(event.payload), entry, conversion);

    return parseStrict(TrajectoryEvent, {
      ...event,
      payload: {
        ...event.payload,
        credits: cost.credits,
        billingStatus: "priced",
        priceBookVersion: PRICE_BOOK_VERSION,
      },
    });
  });
}
