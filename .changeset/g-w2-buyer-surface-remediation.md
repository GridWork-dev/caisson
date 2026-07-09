---
"@caisson/site": patch
---

Buyer-surface remediation (Kickoff G, CAISSON-64/61/69): fixes the /dashboard/ai-keys P0 crash by
unifying the apps/site-local migration list (`deploy-migrate.ts` and the dev PGlite double now
apply the SAME list, closing a prod/dev migration drift that left `byok_key_meta` never created in
production); adds a fail-closed AI-Production entitlement gate to /dashboard/ai-keys (page load +
every `/api/byok` action); fixes the dashboard topbar account pill clipping and adds Sign-out to
the mobile nav drawer; fixes the login form so an invalid-submit error renders visually distinct
from a success message; corrects purchase-row labels to the canonical bundle names and the plan
page's "Bundles & modules" heading; and adds the EULA's Credits clause (expiry, FIFO burn order,
rollover) — pending operator sign-off on the exact wording.
