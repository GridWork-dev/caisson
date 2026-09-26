// @caisson-sh/agent-trajectory/usage — the AR-3 usage-adapter surface (ADR-0360 U-4, folded in from
// the retired @caisson-sh/agent-usage package by ADR-0402): price normalization + the Codex rollout
// adapter, composing with the package's own Claude adapter so a buyer gets one surface for "turn a
// real transcript into priced trajectory events" regardless of engine:
// `priceUsage(parseClaudeTranscript(jsonl, opts).events)` and
// `priceUsage(parseCodexRollout(jsonl, opts).events)` are the same one-line composition.
export { resolveModelAlias, type PriceBookAlias } from "./alias-map.ts";
export { priceUsage, type PriceUsageOptions } from "./normalize.ts";
export {
  parseCodexRollout,
  type ParseCodexRolloutOptions,
  type CodexRolloutParseResult,
} from "./adapters/codex-rollout.ts";

// Re-exported, byte-stable: the trajectory contract owns this adapter and its schema; the usage
// surface only adds price normalization on top (the PLAN-gate lock — see the S2b PLAN, "Claude
// adapter: WRAP, not re-home").
export {
  parseClaudeTranscript,
  type ParseClaudeTranscriptOptions,
  type ClaudeTranscriptParseResult,
} from "../browser.ts";
