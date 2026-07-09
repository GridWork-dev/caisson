---
"@caisson/registry": patch
---

The registry read Worker now app-level rate-limits anonymous traffic via the native
Cloudflare Workers Rate Limiting binding (CAISSON-55): three independent per-IP budgets
— catalog reads (300/60s), npm packument reads (120/60s), and tarball bytes (60/60s) —
each checked before its route class's entitlement gate. A missing binding (not yet
provisioned) or a limiter error fails OPEN; only a genuine bucket-empty deny returns 429.
Private package only; no publishable release — the wrangler.toml binding config is
inert until the operator provisions the three `[[ratelimits]]` namespaces at DEPLOY.
