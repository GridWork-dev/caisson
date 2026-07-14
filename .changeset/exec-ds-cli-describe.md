---
"@caisson/cli": minor
---

Add a second `caisson` bin alongside `create-caisson`. `caisson describe --json` prints the full
committed @caisson/ui component manifest (or one component by name, case-insensitive) as
deterministic JSON — the same data layer the MCP tools serve, free and with no Caisson account. The
`caisson doctor` verify command rides the same bin as a thin authed client of the buyer MCP.
