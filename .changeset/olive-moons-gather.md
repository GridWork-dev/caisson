---
"@caisson/org-controls": minor
"@caisson/site": patch
---

The package gains a browser-safe `./browser` entry point carrying `assertCanManageMembers`, so a
client bundle can render the owner-only gate using the exact function the server enforces instead
of a second copy of the rule. The gate now lives in its own internal module with no database, SSO,
or Node dependencies; the main entry is unchanged and keeps the full surface, every public export
keeps its name and shape, and every browser-entry export is also available on the main entry. The
site's org-controls interactive demo now runs that real gate instead of a hand-maintained copy.
