// @caisson/agent-usage — the AR-3 usage-adapter home (ADR-0360 U-4): price normalization + the
// Codex rollout adapter, WRAPPING (never re-homing) agent-trajectory's existing Claude adapter so a
// buyer gets one surface for "turn a real transcript into priced trajectory events" regardless of
// engine: `priceUsage(parseClaudeTranscript(jsonl, opts).events)` and
// `priceUsage(parseCodexRollout(jsonl, opts).events)` are the same one-line composition.
export { resolveModelAlias, type PriceBookAlias } from "./alias-map.ts";
export { priceUsage, type PriceUsageOptions } from "./normalize.ts";
export {
  parseCodexRollout,
  type ParseCodexRolloutOptions,
  type CodexRolloutParseResult,
} from "./adapters/codex-rollout.ts";

// Re-exported, byte-stable: agent-trajectory owns this adapter and its schema; this package only
// adds price normalization on top (the PLAN-gate lock — see the S2b PLAN, "Claude adapter: WRAP,
// not re-home").
export {
  parseClaudeTranscript,
  type ParseClaudeTranscriptOptions,
  type ClaudeTranscriptParseResult,
} from "@caisson/agent-trajectory";
