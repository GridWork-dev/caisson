import { estimateTokens } from "@caisson/ai-meter";
import type { Usage } from "@caisson/ai-meter";

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

function safeTokenCount(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

/**
 * Normalize language usage into Caisson's integer meter shape. A provider that omits both primary
 * token counts remains distinct from one that explicitly reports zero, because completed calls
 * with unreported usage settle at their reservation instead of receiving a silent full refund.
 */
export function normalizeLanguageUsage(usage: LanguageUsageLike): Usage | null {
  if (usage.inputTokens === undefined && usage.outputTokens === undefined) {
    return null;
  }

  const inputTokens = safeTokenCount(usage.inputTokens);
  const outputTokens = safeTokenCount(usage.outputTokens);
  const cacheReadTokens = safeTokenCount(
    usage.inputTokenDetails?.cacheReadTokens ?? usage.cachedInputTokens,
  );

  return {
    inputTokens,
    outputTokens,
    cachedInputTokens: Math.min(cacheReadTokens, inputTokens),
  };
}

/** Normalize embedding usage as input-only billing, falling back only when usage is unreported. */
export function normalizeEmbeddingUsage(
  usage: EmbeddingUsageLike,
  values: readonly string[],
): Usage {
  const inputTokens = Number.isFinite(usage.tokens)
    ? safeTokenCount(usage.tokens)
    : values.reduce((sum, value) => sum + estimateTokens(value), 0);

  return { inputTokens, outputTokens: 0, cachedInputTokens: 0 };
}
