# AGENTS — @caisson/agent-usage

Agent-facing authoring/usage contract (ADR-0020 `agents`). What a producer (a Codex/Claude session
reader) or a consumer (a price-normalization caller) must know to use this package correctly.

## Invariants (do not violate)

- **`priced` is a cost statement, never a charge.** `priceUsage()` never touches the credit ledger;
  `metered` stays the only billing-grade band. Do not wire a `priced` event's `credits` into any
  settle/reconcile path.
- **Never guess a model or provider.** The Codex adapter latches `model` from `turn_context` and
  `provider` from `session_meta.model_provider` only; the alias map resolves a reported id to a
  price-book row or returns `null`. No fallback, no pattern match, no nearest-neighbor guess anywhere
  in this package.
- **Pricing math lives in ai-meter, not here.** `resolvePriceEntry`/`computeCost` are reused verbatim
  (integer micro-USD, ceil rounding). This package only reshapes a trajectory event into ai-meter's
  `Usage` and reshapes the result back — it never re-derives a rate or a rounding rule.
- **Adapter failures skip-and-count, never throw.** A malformed line — invalid JSON, an unusable
  `token_count` shape — increments `linesSkipped`, not an exception.
- **`priceUsage` is pure.** It never mutates an input event; an unchanged event is returned by
  reference.

## Producing events

`parseCodexRollout(jsonl, { runId })` and (re-exported) `parseClaudeTranscript(jsonl, { runId })`
both emit `estimated` `model.usage` events. Pass either adapter's `events` through `priceUsage()` to
attempt the `priced` upgrade before persisting/replaying them through `@caisson/agent-trajectory`.

## Consuming events

Treat `billingStatus` as authoritative for trust (per agent-trajectory's own contract): `priced`
credits are pricebook-computed, not ledger-settled; `estimated` credits are always `0`.

## Out of scope (this slice)

No CLI/MCP exposure, no bundle membership or pricing, no subagent-depth attribution (ADR-0360 U-5,
deferred), no re-implementation of the Claude adapter (wrapped only, per the PLAN-gate lock).
