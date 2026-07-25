---
"@caisson/site": patch
---

Document the session-token HMAC key in the service env contract. The variable is required once the
database and auth secret are configured, and a missing value crashes the boot rather than degrading
sign-in, so it belongs in the same list as the other required service variables.
