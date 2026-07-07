---
"@caisson/audit-worm": minor
---

Add an optional embeddable audit-chain viewer at the `@caisson/audit-worm/ui` subpath. It renders
your tenant's hash-chain entries alongside the verification verdict, flagging the exact entry where
a chain breaks. The surface is presentational and server-render safe — it draws only the data you
hand it, opens no database, and composes the `@caisson/ui` component kit. Importing the package root
stays React-free; React and the kit are optional peers pulled in only when you use `/ui`.
