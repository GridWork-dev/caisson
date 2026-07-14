---
"@caisson/ds-manifest": minor
---

Add a new shared package holding the component-manifest schema, a typed reader, and a pure WCAG
contrast checker — the common data and analysis layer the CLI, the buyer MCP, and the kit's own
build-time generator all import so a coding agent can discover and verify correct usage of the
design-system kit without duplicating that logic in each front end.
