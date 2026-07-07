---
"@caisson/org-controls": minor
---

New Clerk session-verification driver, beside the existing WorkOS SSO transport. Verifies a Clerk
session token against Clerk's JWKS (networkless when a public key is configured) and maps the claims
onto the same session shape the rest of the product depends on — a Clerk-authenticated buyer resolves
through the identical seam as a WorkOS or password-based one. An active Clerk Organization maps to an
account and role; a personal (non-Organization) session falls back to the product's own single-user
account convention.
