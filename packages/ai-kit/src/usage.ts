import {
  BUNDLED_PRICE_BOOK,
  CREDIT_CONVERSION,
  computeCost,
  estimateTokens,
  resolvePriceEntry,
} from "@caisson-sh/ai-meter";
import type { MeterConfig, Usage } from "@caisson-sh/ai-meter";

/** SDK-independent projection of the language usage fields Caisson bills. */
export interface LanguageUsageLike {
  readonly inputTokens?: number | undefined;
  readonly outputTokens?: number | undefined;
  /** Legacy checkpoint field retained only to prove migration compatibility. */
  readonly cachedInputTokens?: number | undefined;
  /** AI SDK v7 cache-read field. */
  readonly inputTokenDetails?:
    | {
        readonly cacheReadTokens?: number | undefined;
      }
    | undefined;
}

/** SDK-independent projection of embedding usage. */
export interface EmbeddingUsageLike {
  readonly tokens?: number | undefined;
}

// `usage_event` stores token totals, cost, and credits in PostgreSQL `integer` columns. Values
// outside this range are not authoritative provider usage: treating them as reported would either
// under-bill (invalid → 0) or make reconciliation fail after the reservation has already been taken.
const MAX_POSTGRES_INTEGER = 2_147_483_647;

function isLedgerInteger(value: number): boolean {
  return (
    Number.isSafeInteger(value) && value >= 0 && value <= MAX_POSTGRES_INTEGER
  );
}

function reportedTokenCount(value: number): number | null {
  return isLedgerInteger(value) ? value : null;
}

function cacheReadTokenCount(
  value: number | undefined,
  inputTokens: number,
): number {
  if (value === undefined) return 0;
  const normalized = reportedTokenCount(value);
  return normalized !== null && normalized <= inputTokens ? normalized : 0;
}

/**
 * Normalize language usage into Caisson's integer meter shape. A provider that omits both primary
 * token counts remains distinct from one that explicitly reports zero, because completed calls
 * with unreported usage settle at their reservation instead of receiving a silent full refund.
 */
export function normalizeLanguageUsage(usage: LanguageUsageLike): Usage | null {
  if (usage.inputTokens === undefined || usage.outputTokens === undefined) {
    return null;
  }

  const inputTokens = reportedTokenCount(usage.inputTokens);
  const outputTokens = reportedTokenCount(usage.outputTokens);
  if (inputTokens === null || outputTokens === null) return null;

  const cacheReadTokens = cacheReadTokenCount(
    usage.inputTokenDetails?.cacheReadTokens ?? usage.cachedInputTokens,
    inputTokens,
  );

  return {
    inputTokens,
    outputTokens,
    cachedInputTokens: cacheReadTokens,
  };
}

/** Normalize embedding usage as input-only billing, falling back when usage is missing/malformed. */
export function normalizeEmbeddingUsage(
  usage: EmbeddingUsageLike,
  values: readonly string[],
): Usage {
  const reported =
    usage.tokens === undefined ? null : reportedTokenCount(usage.tokens);
  const inputTokens =
    reported ?? values.reduce((sum, value) => sum + estimateTokens(value), 0);

  return { inputTokens, outputTokens: 0, cachedInputTokens: 0 };
}

export interface UsageLedgerCost {
  readonly costMicroUsd: number;
  readonly credits: number;
}

function computeUsageLedgerCost(
  usage: Usage,
  provider: string,
  model: string,
  meter?: MeterConfig,
): UsageLedgerCost | null {
  if (
    !isLedgerInteger(usage.inputTokens) ||
    !isLedgerInteger(usage.outputTokens) ||
    !isLedgerInteger(usage.cachedInputTokens)
  ) {
    return null;
  }

  const entry = resolvePriceEntry(
    meter?.priceBook ?? BUNDLED_PRICE_BOOK,
    provider,
    model,
  );
  const cost = computeCost(
    usage,
    entry,
    meter?.conversion ?? CREDIT_CONVERSION,
  );
  return isLedgerInteger(cost.costMicroUsd) && isLedgerInteger(cost.credits)
    ? { costMicroUsd: cost.costMicroUsd, credits: cost.credits }
    : null;
}

/** Return the persistable derived money values, or null for malformed/ledger-unsafe usage. */
export function usageLedgerCost(
  usage: Usage,
  provider: string,
  model: string,
  meter?: MeterConfig,
): UsageLedgerCost | null {
  try {
    return computeUsageLedgerCost(usage, provider, model, meter);
  } catch {
    return null;
  }
}

/** Whether every integer derived from a usage report fits the current PostgreSQL usage ledger. */
export function canPersistUsage(
  usage: Usage,
  provider: string,
  model: string,
  meter?: MeterConfig,
): boolean {
  return usageLedgerCost(usage, provider, model, meter) !== null;
}

/** Fail before reserve/provider execution when even the reservation estimate cannot be persisted. */
export function assertUsageFitsLedger(
  usage: Usage,
  provider: string,
  model: string,
  meter?: MeterConfig,
): void {
  if (computeUsageLedgerCost(usage, provider, model, meter) === null) {
    throw new RangeError(
      "usage estimate cannot be represented by the PostgreSQL integer ledger",
    );
  }
}
