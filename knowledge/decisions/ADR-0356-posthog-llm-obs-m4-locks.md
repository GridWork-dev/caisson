# ADR-0356 — PostHog LLM-observability M4: first-party wiring, ai-kit stays vendor-clean

Status: accepted · 2026-07-17 (Kickoff-U mini-lane 5, CAISSON-120, PR #250; operator-locked
build-NOW at the 2026-07-17 picker after research overturned the SPEC framing; filed at the
reconcile sitting per the ADR-0328 wave convention.)

## Decision

1. **The M4 gap lives in the two first-party surfaces that bypass ai-kit** — the site Ask-AI lane
   and the support-bot inference path — so the wiring lands THERE and
   **`packages/ai-kit` stays untouched**. `@posthog/ai` is version-incompatible with `ai@7`, and
   ai-kit is a sold package that stays vendor-clean: no PostHog dependency enters the catalog.
2. **Manual `$ai_generation` capture, one event per real model call**, fire-and-forget +
   fail-soft on both surfaces. **No prompt/completion text ever** — `$ai_input` /
   `$ai_output_choices` are never sent. Properties: `$ai_trace_id`/`$ai_parent_id` (fresh UUID),
   `$ai_model`, `$ai_provider: "openrouter"`, input/output tokens, `$ai_total_cost_usd` when the
   provider reports it, `$ai_latency`, `$ai_is_error` (+ `$ai_http_status`/`$ai_error` per path).
   The site emits only when the model actually ran (no event on spend-cap/retrieval
   escalations); `distinct_id` sentinels are `"server"` (site, house pattern) and
   `"support:server"` (support-bot, non-PII server-side cost events).
3. **Dormant until deploy-gated activation:** `POSTHOG_CAPTURE_KEY` (caisson-prod `phc_…`) —
   new on caisson-site, value-only on support-bot — plus optional `POSTHOG_CAPTURE_HOST`
   (default `https://us.i.posthog.com`). Unset ⇒ capture disabled, both surfaces behave exactly
   as before. Setting the keys is an operator DEPLOY act.

## Rejected

- **Wiring `@posthog/ai` into ai-kit** — version-incompatible with ai@7 and puts a vendor
  dependency in a sold package the buyers run.
- **Capturing prompt/completion text** — the privacy floor for a surface that sees buyer and
  support traffic; token/cost/latency metadata delivers the M4 observability goal.
