---
"@caisson/compliance-core": minor
---

The OSCAL export adapter can now push a Security Assessment Results / Plan of Action &
Milestones bundle to a configured GRC ingest endpoint over live HTTPS, instead of only
returning the documents for a caller to deliver themselves. The new
`createOscalHttpTransport` factory and `OscalDeliveryConfigSchema` validate the
destination URL (public HTTPS only), send an optional Bearer credential, and fail closed
on a non-2xx response with a single attempt per document — no automatic retries.
