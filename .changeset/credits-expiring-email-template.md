---
"@caisson/email": minor
---

Add the `credits-expiring` T-30d expiry notice (ADR-0252 Decision 6b) — the first
transactional/billing template. The template registry is now keyed by a per-template
`TemplateDataMap` (the three auth templates keep their `{ url }` shape; `credits-expiring` takes
`{ credits, expiresOn, url }` and renders a dynamic subject). `tryRenderEmailTemplate` coerces
free-form driver data per template and still falls back to `null` on a shape mismatch, so every
driver's generic mapping is unchanged.
