---
"@caisson/site": patch
---

The Turnstile challenge widget and dashboard product analytics now actually arm in
production: their public configuration values are baked into the client bundle at image
build time (they were previously set on the service but never reached the build, so both
features silently no-opped). The production route sweep also drops its tolerance for the
Cloudflare-injected analytics beacon — the zone-level injection is disabled at the source,
so any beacon reappearing is flagged as a regression.
