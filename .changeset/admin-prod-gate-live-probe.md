---
"@caisson/admin": patch
---

Added a small live production check for the admin control-plane: it confirms the deployed
readiness endpoint reports healthy and that visiting the control-plane while signed out sends
you to the sign-in page. It runs on demand and touches only already-public, unauthenticated
endpoints. No product code changed, no runtime behavior change.
