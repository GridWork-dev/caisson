---
"@caisson/service-intel": patch
---

The cassette recorder's judge-verdict parse now tolerates fence-wrapped JSON: OpenRouter drops
`response_format` for anthropic models and the judge wraps its object in markdown fences, which
the strict parse read as non-JSON and threw on every finding. The recorder extracts the outermost
object before parsing and stays fail-closed when no JSON is present. Surfaced by the first live
recording run (CAISSON-101 session-4 operator act).
