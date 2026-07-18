# PLAN — S2b: the usage-adapter package (CAISSON-111 slice 2 of 6)

- **Executes:** ADR-0351 AR-3 · ADR-0360 U-1 · SPEC `SPEC-caisson-111-loop-slices.md` §5 (S2b).
- **Depends:** S2a merged (consumes the `priced` band). Tree-disjoint from S2; may run
  parallel to it per the DAG.
- **Branch:** `admin/caisson-111-s2b-agent-usage-adapters` (worktree, one PR).

## PLAN-gate decisions (SPEC §8 items 2–3, taken here)

- **Package name:** `@caisson/agent-usage` — joins the agent-* primitive family
  (agent-trajectory, agent-runner, agent-kernel). Manifest kind `primitive`, commercial
  (`LicenseRef-Caisson-Commercial`), NOT in any bundle member map. It will graduate into
  the index unsellable/unpriced at the next consume exactly as agent-trajectory did
  (the rider-3 accepted shape) — noted, not fought.
- **Claude adapter: WRAP, not re-home.** `agent-trajectory`'s published API stays
  byte-stable (append-only spirit; the package is indexed at 0.2.x). `agent-usage`
  imports the existing claude-transcript adapter's events and adds price normalization
  on top; only the NEW Codex adapter lives natively in `agent-usage`.

## Tasks

1. **Package scaffold** `packages/agent-usage/` — manifest/package.json/tsconfig/eslint/
   README following `packages/agent-trajectory` exactly. Deps: kernel + ai-meter +
   agent-trajectory (primitive→primitive, precedented).
2. **`src/alias-map.ts`** — dated-model-id → pricebook-id alias map
   (e.g. `claude-sonnet-4-5-20250514` → `anthropic/claude-sonnet-4.5`) + resolver.
   Unknown model or missing alias ⇒ `null` (caller stays `estimated`) — never a guess.
3. **`src/normalize.ts`** — `priceUsage(events)` over `model.usage` trajectory events:
   resolve via the alias map + ai-meter's `BUNDLED_PRICE_BOOK`/`resolvePriceEntry`/
   `computeCost` verbatim (integer micro-USD, ceil, `PRICE_BOOK_VERSION`); on success
   re-emit the event `priced` with computed integer credits + `priceBookVersion`; on
   miss, pass through unchanged (`estimated` stays `estimated`, credits 0). Never
   mutates input; deterministic.
4. **`src/adapters/codex-rollout.ts`** — the stateful scanner, four fixture-backed
   honesty bars (SPEC §5): (1) model latched from nearest `turn_context`, provider from
   `session_meta.model_provider`, never hardcoded/fallback-guessed; (2) usage from
   `last_token_usage` deltas with `cached_input_tokens` subtracted from `input_tokens`,
   delta-consistency asserted against `total_token_usage` cumulative diffs; (3) fixture
   proves `reasoning_output_tokens` is not double-counted; (4) a `token_count`-free
   session yields ZERO usage events + run `unsupported` — never zero-valued `estimated`.
   Adapter failures skip-and-count, never throw (slice-1 robustness contract).
5. **Fixtures** — synthetic rollout JSONL exercising every bar (vendor-internal format;
   fixtures document our read of it, dated).
6. **Tests** — alias resolver · normalization (ceil rounding, integer-only, unknown-model
   passthrough, refine-compatibility of emitted events via parseStrict) · the four
   adapter bars · skip-and-count robustness.
7. **Changeset** — new package minor, buyer prose.
8. **Verify** — `bunx turbo run build lint test --filter=@caisson/agent-usage...` +
   standards-gate (license split + no-depend-up) + sot. EVAL: `ai` tag — package tests
   are the eval surface (no baselines yet; S4 owns trajectory evals).

## Routing

Builder: `gw-typescript-pro` (sonnet) in a worktree off post-S2a main; SHIP review rides
the in-session lane with the S2 slice's audit (money-adjacent: the normalize path
computes credits — reviewer checks ceil/integer/never-settle claims explicitly).
