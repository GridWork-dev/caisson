---
"@caisson/ai-meter": minor
---

Add an optional embeddable usage chart at the `@caisson/ai-meter/ui` subpath. It rolls your metered
inference events up by model into credit, cost, and token totals, then draws a per-model spend bar
chart and a numeric breakdown table. Credits and cost stay integer units end to end. The surface
renders only the events you hand it — no database, no meter call. Presentational and server-render
safe; composes the `@caisson/ui` kit. Importing the package root stays React-free.
