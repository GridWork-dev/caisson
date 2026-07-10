---
"@caisson/service-docs": patch
---

The docs service's embed-phase boot deadline is now tunable via `DOCS_EMBED_PHASE_DEADLINE_MS`
(bounded 1s-30min; invalid values fall back to the 3-minute default). The docs corpus outgrew
the default: only the first ~80 chunks were getting real embeddings per boot, which skewed the
vector leg of retrieval toward the alphabetically-first pages regardless of the question asked.
The Railway healthcheck timeout was raised alongside it so a long warmup is never mistaken for
a failed deploy.
