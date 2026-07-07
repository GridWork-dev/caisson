---
"@caisson/license-issue": minor
---

Add an optional embeddable issuance-log surface at the `@caisson/license-issue/ui` subpath for the
admin issuer app. It renders the issued-license records — tier, live/expired status, entitlement
count, and coverage — with the active-vs-total split up front. The surface is read-only and
server-render safe: it holds no signing key and opens no database, drawing only the records handed
to it, and composes the `@caisson/ui` kit. Importing the package root stays React-free.
