# @caisson/agent-usage

The AR-3 usage-adapter home (ADR-0360 U-4): price normalization + the Codex rollout adapter, sitting
one layer above `@caisson/agent-trajectory`'s engine-neutral event contract. This package answers
one question the contract deliberately leaves open — "how much did this real transcript cost?" —
without ever touching the credit ledger: every number here is a **cost statement**, never a charge.

## The `priced` band

`@caisson/agent-trajectory`'s `model.usage` events carry a `billingStatus`. `metered` is ledger-truth
(the ai-kit gateway path); `estimated` is real adapter-extracted counts that are NOT price-normalized
(`credits` is always `0`). This package's `priceUsage()` upgrades a qualifying `estimated` event to
`priced`: pricebook-computed integer credits attached to the SAME real counts, stamped with
`priceBookVersion` for provenance. `priced` is never ledger-settled — `metered` stays the only
billing-grade band.

```ts
import { parseCodexRollout, priceUsage } from "@caisson/agent-usage";

const { events } = parseCodexRollout(rolloutJsonl, { runId: "run-1" });
const priced = priceUsage(events); // estimated -> priced where the model resolves; miss -> unchanged
```

## Price normalization (`normalize.ts`)

`priceUsage(events, options?)` maps every `model.usage` event:

1. Not `estimated` (already `metered`/`priced`/`unsupported`, or a non-usage event) -> unchanged,
   returned by reference.
2. `estimated` but the reported `(provider, model)` has no `alias-map.ts` entry, or the alias's
   price-book row doesn't exist in the book -> unchanged, stays `estimated`. **Never a guess.**
3. `estimated` with a resolved price-book row -> reuses ai-meter's `resolvePriceEntry` +
   `computeCost` VERBATIM (integer micro-USD, ceil rounding per leg, `PRICE_BOOK_VERSION` stamped) to
   compute integer credits, then re-emits the event `priced` with those credits. The re-emitted event
   is re-validated through `TrajectoryEvent`/`parseStrict` before it leaves the function.

Pure and deterministic — never mutates an input event.

### The additive/inclusive reconciliation

`agent-trajectory`'s `inputTokens`/`cachedInputTokens` fields are **additive**: `inputTokens` is NEW
(non-cached) tokens only, `cachedInputTokens` is a separate cache-read count (the Claude adapter's
own reading of Anthropic's usage shape, where `input_tokens` excludes `cache_read_input_tokens`).
`@caisson/ai-meter`'s `Usage.inputTokens` is the opposite: cache-**inclusive**, with
`cachedInputTokens` a subset (`cachedInputTokens <= inputTokens`). `normalize.ts` reassembles the
inclusive total (`inputTokens + cachedInputTokens`) at the one seam where the two conventions meet —
every adapter in this package writes the additive schema convention; only the ai-meter call site
converts.

## The alias map (`alias-map.ts`)

`resolveModelAlias(provider, model)` maps a reported dated snapshot id (e.g.
`claude-sonnet-4-5-20250514`) to the exact `BUNDLED_PRICE_BOOK` row it prices against (e.g.
`anthropic/claude-sonnet-4.5`). A miss returns `null`. The map is a hand-curated, one-entry-at-a-time
table — never a pattern, prefix, or fuzzy match; extending price coverage to a new model means adding
a new alias row deliberately, dated.

## The Codex adapter (`adapters/codex-rollout.ts`)

`parseCodexRollout(jsonl, { runId })` reads a Codex CLI rollout JSONL file (`{ timestamp, type,
payload }` lines) into `model.usage` events, `billingStatus: 'estimated'`. Four binding, fixture-proven
honesty bars:

1. **Model/provider are latched, never guessed.** `model` comes from the nearest `turn_context.model`;
   `provider` comes only from `session_meta.model_provider`. A `token_count` event seen before both
   are latched is skipped (never attributed to a hardcoded fallback — the ccusage `gpt-5`
   display-fallback failure mode is explicitly rejected).
2. **Usage is the `last_token_usage` delta, never the cumulative counter.** `total_token_usage` is a
   running sum across the whole session; summing it turn-over-turn wildly overcounts (the "cumulative
   trap"). `last_token_usage.cached_input_tokens` is subtracted out of `input_tokens` to land on this
   package's additive convention (see above). The adapter test asserts delta-consistency: summing
   every emitted event's reconstructed total against the session's final cumulative counter.
3. **`reasoning_output_tokens` is already inside `output_tokens`.** It is never added a second time.
4. **A `token_count`-free rollout yields zero events and `unsupported: true`** on the result — never
   a zero-valued `estimated` event faking real adapter-extracted counts.

Robustness (matches the Claude adapter): a malformed line — invalid JSON, or a `token_count` event
with no usable usage shape — is **skipped and counted, never thrown**.

## The Claude adapter — wrapped, not re-homed

`@caisson/agent-trajectory`'s `parseClaudeTranscript` stays exactly where it is (byte-stable, the
package is indexed at 0.2.x); this package re-exports it so a caller gets both adapters plus
`priceUsage` from one surface:

```ts
import { parseClaudeTranscript, priceUsage } from "@caisson/agent-usage";

const priced = priceUsage(parseClaudeTranscript(jsonl, { runId }).events);
```

## Tests

`bun test packages/agent-usage/src` — the alias resolver (hit/miss), normalization (ceil rounding,
integer-only credits, unknown-model passthrough, re-parse through `TrajectoryEvent`), the four Codex
adapter honesty bars against synthetic fixtures, and skip-and-count robustness on malformed input.
