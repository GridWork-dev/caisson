---
"@caisson/ai-kit": patch
---

The metered gateway now accepts an optional trajectory recorder. When one is wired, `infer()` and
`inferStream()` emit a `model.call` event (model id plus a sha256 prompt digest only, never the
prompt text) before the provider call and a `model.usage` event (`billingStatus: 'metered'`, the same
integer token and credit numbers the ledger just settled) after reconcile. The instrumentation is
purely additive: with no recorder the gateway behaves byte-for-byte as before, and a recorder that
throws is swallowed and surfaced as a `trajectory.record_failed` ops warning — observation never fails
the metered call.
