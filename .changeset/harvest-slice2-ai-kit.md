---
"@caisson/ai-kit": patch
---

Fetch-deadline floor fix + metered embeddings (ADR-0213, harden-in-place ADR-0210): every live
`@ai-sdk/*` provider factory now binds its outbound `fetch` to a configurable `timeoutMs` (default
60s, via `fetchWithTimeout`) instead of the ambient global fetch, closing a hang/DoS-adjacent gap on
every provider path; `infer()`'s `generateText` now forwards `opts.abortSignal`, mirroring
`inferStream()`'s existing wiring. New `embed()`/`embedMany()` join the gateway through the SAME
ai-meter reserve-before/reconcile-after chokepoint, provider-agnostic via the ai-config lane and
BYOK-routed — a metered, buyer-facing embeddings surface for RAG/semantic-search built on the proved
registry-resolver/reserve/reconcile machinery, no guardrails or prompt-registry render (an embed input
feeds a vector index, not a moderated chat turn). Zero diff in `@caisson/ai-config`,
`@caisson/ai-meter`, or `@caisson/pricebook` — a bundled embedding price-book row / bulk-embed SKU is
cross-package money, deferred to the ADR-0212 serialized wave.
