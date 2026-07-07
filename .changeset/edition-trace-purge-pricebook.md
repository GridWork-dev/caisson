---
"@caisson/pricebook": patch
---

Edition-trace purge (ADR-0270): repoint every mint site off the dissolved edition ids. The four
archived-edition + bundle-sentinel rows in `PURCHASE_BOOK` and `RENEWAL_BOOK` now emit the canonical
six-bundle ids (`ai-production`/`local-first`/`agentic-dev`/`everything`), so no new purchase or renewal
can mint a legacy id, and a replay of any historical sandbox event grants the canonical id. `resolveRenewal`
drops its now-dead bundle-alias normalization (every row stores a canonical id; the read-side alias fold for
a future module rename stays where a grant id is consumed). Version stamps bumped (append-only, ADR-0006).
