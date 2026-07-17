---
"@caisson/site": patch
---

Ask-AI: emit a PostHog `$ai_generation` LLM-observability event per model call

The public Ask-AI route calls OpenRouter directly (it bypasses the sold `@caisson/ai-kit`
package, which must never carry a hardcoded vendor sink), so its generations were invisible in
PostHog — the M4 audit finding of zero `$ai_*` events in caisson-prod. The route now surfaces the
OpenRouter usage token counts it previously discarded and, after each real model call, fires one
fire-and-forget, fail-soft `$ai_generation` capture carrying model, provider, input/output tokens,
total USD cost, latency, and HTTP/error status. No prompt or completion text ever leaves the box —
`$ai_input` and `$ai_output_choices` are never sent. Config-gated on `POSTHOG_CAPTURE_KEY`; when it is
unset there is no capture and zero behavior change.
