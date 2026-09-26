// Provider token-rate normalization (ADR-0060/0007). A bundled, versioned price book maps a
// `provider/model` to its per-million-token rates in INTEGER micro-USD, and `computeCost` folds a
// usage shape into an integer micro-USD cost + integer credit units. The whole path is integer-only
// (BigInt internally, never a float) so a metered charge is reproducible to the unit — the rounding
// is fixed and pinned by the `src/__golden__/cost.json` fixture (ADR-0013). The book is
// `forge.config`-overridable: a buyer parses an override through `parsePriceBook` at the edge.
//
// Algorithm (per leg, then summed): each token leg (non-cached input, cached input, output) is
// `ceil(tokens * perMTok / 1_000_000)` micro-USD — rounded UP per leg so a partial-cache mix can
// never under-bill — and the call's credit charge is `ceil(costMicroUsd / microUsdPerCredit)`.
import { z } from "zod";
import {
  ConfigError,
  CREDIT_CONVERSION,
  asCredits,
  type CreditConversion,
  type Credits,
  creditConversionSchema,
  type MicroUsd,
  parseCreditConversion,
  parseStrict,
  type RoundedMoney,
  strictObject,
} from "@caisson-sh/kernel";

// The credit denomination moved to @caisson-sh/kernel (ADR-0098, SD-3): exactly ONE definition across
// the codebase, shared by this token-rate COST book (rounds up) and @caisson-sh/pricebook's COMMERCE book (rounds
// down). The schema + parser keep their names on the re-export; the constant was intentionally renamed
// DEFAULT_CREDIT_CONVERSION -> CREDIT_CONVERSION to match the kernel home (pre-launch, no consumers).
export { CREDIT_CONVERSION, creditConversionSchema, parseCreditConversion };
export type { CreditConversion };

/** Rates are quoted per MILLION tokens; a leg divides the token·rate product by this. */
const MICRO_PER_MTOK = 1_000_000n;

/** A single model's rates, all integer micro-USD per million tokens. */
export const priceBookEntrySchema = strictObject({
  inputPerMTok: z.number().int().nonnegative(),
  cachedInputPerMTok: z.number().int().nonnegative(),
  outputPerMTok: z.number().int().nonnegative(),
});
export type PriceBookEntry = z.infer<typeof priceBookEntrySchema>;

/** `provider/model` → rates. Keyed by `priceKey()`. */
export const priceBookSchema = z.record(z.string(), priceBookEntrySchema);
export type PriceBook = z.infer<typeof priceBookSchema>;

/** Actual (or estimated) token usage for one call. `cachedInputTokens` is the cache-read subset of
 *  `inputTokens` — the non-cached remainder is billed at the full input rate. */
export const usageSchema = strictObject({
  inputTokens: z.number().int().nonnegative(),
  cachedInputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
}).refine((u) => u.cachedInputTokens <= u.inputTokens, {
  message: "cachedInputTokens cannot exceed inputTokens",
  path: ["cachedInputTokens"],
});
export type Usage = z.infer<typeof usageSchema>;

export interface CostBreakdown {
  /** Integer micro-USD the provider price book normalized to (branded, ADR-0212). */
  costMicroUsd: MicroUsd;
  /** Integer credit units charged (ceil of cost ÷ conversion; branded, ADR-0212). */
  credits: Credits;
  /**
   * Rounding provenance (ADR-0212) for the micro-USD → credits leg: `raw` is the pre-rounding
   * integer micro-USD cost, `mode` is this book's fixed direction ("up", ADR-0060 — never
   * under-bill), `result` equals `credits`. Thread it into the credit-ledger write so the charge
   * is auditable after the fact.
   */
  roundingCredits: RoundedMoney<MicroUsd, Credits>;
}

/** The bundled price book version stamp (append-only: a new price set bumps this). */
export const PRICE_BOOK_VERSION = "2026-07-06";

/** Bundled default rates (micro-USD per million tokens). `forge.config`-overridable. */
export const BUNDLED_PRICE_BOOK: PriceBook = {
  "openai/gpt-4o-mini": {
    inputPerMTok: 150_000,
    cachedInputPerMTok: 75_000,
    outputPerMTok: 600_000,
  },
  "anthropic/claude-3-5-haiku": {
    inputPerMTok: 800_000,
    cachedInputPerMTok: 80_000,
    outputPerMTok: 4_000_000,
  },
  // Sonnet-tier usage was fail-closed (ConfigError, no row) — a metering gap, not a
  // margin call. Verified rates $3.00 / $15.00 per MTok; cachedInputPerMTok mirrors every other
  // Anthropic row here at 10% of input (Anthropic's published prompt-cache-read discount).
  "anthropic/claude-sonnet-4.5": {
    inputPerMTok: 3_000_000,
    cachedInputPerMTok: 300_000,
    outputPerMTok: 15_000_000,
  },
  "google/gemini-1.5-flash": {
    inputPerMTok: 75_000,
    cachedInputPerMTok: 18_750,
    outputPerMTok: 300_000,
  },
  // The metered-embeddings gateway's default model (ADR-0213): an embedding model is just another
  // price-book ROW — config, not a schema change. `outputPerMTok: 0` because an embedding call has
  // no output tokens (ai-kit's embed() reconciles with outputTokens: 0 and the reserve-time phantom
  // output leg refunds in full). `cachedInputPerMTok` mirrors the input rate: embeddings have no
  // cache-read discount, so a caller reporting cached tokens is billed the full input rate — never
  // an accidental discount to $0.
  "openai/text-embedding-3-small": {
    inputPerMTok: 20_000, // $0.02 per 1M tokens, in integer micro-USD
    cachedInputPerMTok: 20_000,
    outputPerMTok: 0,
  },
};

/** The canonical price-book key for a `(provider, model)` pair. */
export function priceKey(provider: string, model: string): string {
  return `${provider}/${model}`;
}

/** Ceiling division over non-negative BigInts — the single rounding rule (round UP). */
function ceilDiv(numer: bigint, denom: bigint): bigint {
  return (numer + denom - 1n) / denom;
}

/** One token leg in integer micro-USD (rounded up). Inputs are validated non-negative integers. */
function legMicroUsd(tokens: number, perMTok: number): number {
  return Number(ceilDiv(BigInt(tokens) * BigInt(perMTok), MICRO_PER_MTOK));
}

/** Integer credit units for an integer micro-USD cost (rounded up; 0 → 0). */
export function creditsForMicroUsd(
  costMicroUsd: number,
  conversion: CreditConversion,
): Credits {
  if (costMicroUsd === 0) return asCredits(0);
  // Ceil over non-negative integers yields a non-negative integer — mint the brand directly.
  return Number(
    ceilDiv(BigInt(costMicroUsd), BigInt(conversion.microUsdPerCredit)),
  ) as Credits;
}

/** Look up a model's rates, fail-closed: an unknown model throws rather than metering at zero. */
export function resolvePriceEntry(
  book: PriceBook,
  provider: string,
  model: string,
): PriceBookEntry {
  const entry = book[priceKey(provider, model)];
  if (entry === undefined) {
    throw new ConfigError(
      `no price-book entry for ${priceKey(provider, model)}`,
    );
  }
  return entry;
}

/** Normalize a usage shape into integer micro-USD + integer credits (per-leg ceil, then sum). */
export function computeCost(
  usage: Usage,
  entry: PriceBookEntry,
  conversion: CreditConversion,
): CostBreakdown {
  const parsed = parseStrict(usageSchema, usage);
  const nonCachedInput = parsed.inputTokens - parsed.cachedInputTokens;
  // A sum of per-leg ceilings over non-negative integers is a non-negative integer — mint the brand.
  const costMicroUsd = (legMicroUsd(nonCachedInput, entry.inputPerMTok) +
    legMicroUsd(parsed.cachedInputTokens, entry.cachedInputPerMTok) +
    legMicroUsd(parsed.outputTokens, entry.outputPerMTok)) as MicroUsd;
  const credits = creditsForMicroUsd(costMicroUsd, conversion);
  return {
    costMicroUsd,
    credits,
    // ADR-0212: this book's fixed direction is UP (ADR-0060, never under-bill) — recorded even when
    // the division was exact.
    roundingCredits: { raw: costMicroUsd, mode: "up", result: credits },
  };
}

/** Validate a `forge.config` price-book override at the boundary (Zod `.strict()` per entry). */
export function parsePriceBook(input: unknown): PriceBook {
  return parseStrict(priceBookSchema, input);
}
