---
"@caisson/guardrails": patch
---

Adds a small offline eval baseline for the PII detection/redaction path, built on the
existing eval harness package: one dataset pinning that obvious PII (including PII
pasted inside a fenced code block) gets redacted, and a second dataset pinning that
clean text and known near-miss shapes (a Luhn-invalid card-shaped number, a
Unicode-homoglyph-obfuscated email) are correctly left alone. Fully offline and
deterministic — no model call, no network — so it runs the real detector directly on
every test run and fails if that logic regresses. Adds the eval harness package as a
test-only dependency; no runtime behavior changes.
