---
"@caisson/analytics": minor
---

New package: a provider-agnostic server-side analytics port. One `AnalyticsProvider` interface with
an in-memory capture driver for tests plus production drivers for Plausible, PostHog, and GA4 — record
events from a backend, queue handler, or webhook through a single seam, swap the vendor without
touching call sites. Config is injected (the API key or measurement id is passed in, never read from
the environment inside the package) and every call is timeout-bounded. Capture is fail-open by design:
a network error or a non-2xx response is reported through an optional error sink, never thrown, so a
dropped analytics event can never break the surface it measures.
