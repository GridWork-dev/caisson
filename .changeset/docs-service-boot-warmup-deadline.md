---
"@caisson/service-docs": patch
---

Boot no longer blocks on embedding the docs corpus before the server starts listening: the port
binds immediately and answers a `{"ok":false,"warming":true}` 503 on every route until the real
index is ready, then swaps in the live handler in place. A degraded or rate-limited embedding
provider can no longer stretch that warmup window past a few minutes either — the whole
embedding phase now has a hard deadline (independent of corpus size or any single chunk's
in-flight retry/backoff), past which every remaining chunk falls back to the text-search floor
instead of blocking startup, with a log line naming how many chunks got a real embedding versus
how many fell back. Private package only; no publishable release.
