---
"@caisson/ai-meter": patch
---

Added the missing `anthropic/claude-sonnet-4.5` price-book row (input $3.00 / output $15.00 per
MTok) — Sonnet-tier usage was fail-closed with a `ConfigError` for lack of a rate, blocking all
metering of that tier.
