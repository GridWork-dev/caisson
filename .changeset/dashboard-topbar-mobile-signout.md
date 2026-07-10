---
"@caisson/ui": patch
---

AppShell (dashboard shell) mobile fixes (CAISSON-69): the topbar account pill truncates with an
ellipsis instead of clipping past `.cs-shell`'s grid-level overflow, and a new optional
`mobileNavFooter` prop lets a consumer render extra content (e.g. Sign-out) inside the mobile
off-canvas drawer, reachable even when the topbar has no room for it.
