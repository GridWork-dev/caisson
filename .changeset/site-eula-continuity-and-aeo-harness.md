---
"@caisson/site": patch
---

EULA vendor-continuity clause landed (ADR-0276/ADR-0282 with the five operator-approved polish
edits: §365(n) runs-with successor language, the narrowed trigger-(ii) unremediated-vulnerability
condition, as-delivered scoping on self-maintenance, prospective-only cure semantics, and the new
Affiliate definition), Last-updated bumped to 10 July 2026; docs pages now route generateMetadata
through buildMetadata for canonical/OG/Twitter (AEO audit 2026-07-09 carry-forward); the visual
harness stubs GET /api/auth/get-session on signed-out shots so a 4-worker sweep no longer trips
the CF /api/auth/* rate limit (CAISSON-71). Private app; no publishable release.
