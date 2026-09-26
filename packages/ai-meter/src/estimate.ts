// Pre-call token estimation (ADR-0060). The reserve leg needs a cost BEFORE the provider answers,
// so it estimates input tokens with the cheap `chars / 4` heuristic and assumes a full output
// budget (the caller's `maxOutputTokens`, else a conservative default). The estimate only sizes the
// reservation — `reconcile()` trues the charge to the provider's actual usage — so it deliberately
// rounds the reservation UP (no cache assumed) rather than risk under-reserving.
import { z } from "zod";
import { parseStrict, strictObject } from "@caisson-sh/kernel";
import { computeCost } from "./token-rates.ts";
import type {
  CostBreakdown,
  CreditConversion,
  PriceBookEntry,
  Usage,
} from "./token-rates.ts";

/** The heuristic divisor: ~4 characters per token across common tokenizers. */
export const CHARS_PER_TOKEN = 4;

/** The assumed output budget when the caller does not cap `maxOutputTokens`. */
export const DEFAULT_OUTPUT_TOKENS = 1024;

/** A minimal chat message — only the content length matters to the estimate. */
export const estimateMessageSchema = strictObject({
  role: z.string(),
  content: z.string(),
});
export type EstimateMessage = z.infer<typeof estimateMessageSchema>;
export const estimateMessagesSchema = z.array(estimateMessageSchema);

/** Heuristic token count for a string (`ceil(chars / 4)`; empty → 0). */
export function estimateTokens(text: string): number {
  if (text.length === 0) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/** Estimated input tokens across a message array. */
export function estimateInputTokens(messages: EstimateMessage[]): number {
  return messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
}

/** Build the conservative usage shape the reservation is priced against (no cache assumed). */
export function estimateUsage(
  messages: EstimateMessage[],
  maxOutputTokens?: number,
): Usage {
  const parsed = parseStrict(estimateMessagesSchema, messages);
  return {
    inputTokens: estimateInputTokens(parsed),
    cachedInputTokens: 0,
    outputTokens: maxOutputTokens ?? DEFAULT_OUTPUT_TOKENS,
  };
}

/** Estimated cost (integer micro-USD + credits) for the reservation. */
export function estimateCost(
  messages: EstimateMessage[],
  entry: PriceBookEntry,
  conversion: CreditConversion,
  maxOutputTokens?: number,
): CostBreakdown {
  return computeCost(
    estimateUsage(messages, maxOutputTokens),
    entry,
    conversion,
  );
}
