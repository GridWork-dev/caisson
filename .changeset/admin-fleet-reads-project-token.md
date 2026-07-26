---
"@caisson/admin": patch
---

Let the architecture fleet overlay use a Railway project-scoped token instead of the
account-scoped one, falling back to the account token when the narrower pair isn't set.
