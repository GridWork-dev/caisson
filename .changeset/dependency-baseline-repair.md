---
"@caisson/site": patch
"@caisson/observability": patch
"@caisson/ui": patch
---

Dependency baseline repair: the marketing site's motion library moves from the retired
framer-motion package to its motion successor (same API, new import path — the Living Chain
scroll sequence keeps its exact spring behavior), alongside a routine non-major refresh of
auth, telemetry, and UI-tooling dependencies across the site, observability, and UI packages.
