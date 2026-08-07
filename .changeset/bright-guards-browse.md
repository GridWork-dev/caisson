---
"@caisson/guardrails": minor
---

Add a browser-safe entry with the shared PII detector and mask, WebCrypto-based async hash and field-tokenization twins, and the fail-closed guard. The browser seam requires WebCrypto globals and now declares Node.js 20.12 or newer for supported server runtimes.

Note: this code already shipped in the packages published with v2026.08.06.1 — the version cut was
taken from a base that predated the merge, so this changeset records the bump only.
