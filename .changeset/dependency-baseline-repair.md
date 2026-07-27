---
"@caisson/site": patch
"@caisson/observability": patch
"@caisson/ui": patch
---

Dependency baseline repair: the marketing site's motion library moves from the retired
framer-motion package to its motion successor (same API, new import path — the Living Chain
scroll sequence keeps its exact spring behavior), alongside a routine kysely and vite patch
refresh across the site and UI packages. The auth, telemetry, storybook, and playwright
version bumps from the original non-major batch were reverted pending their supply-chain
release-age window clearing naturally; none of them fixed a known vulnerability.
