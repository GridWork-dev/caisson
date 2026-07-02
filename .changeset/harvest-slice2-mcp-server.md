---
"@caisson/mcp-server": patch
---

ADR-0216: `ToolRegistration` gains a Zod-validated declarative manifest
(`description`/`version`/`audit.logArgs`) checked in `registerTool()` before the
duplicate-name guard, so a malformed manifest is a registration-time `ValidationError`,
never a call-time surprise; all 7 existing registrations (3 base + 4 coach) are
annotated (`logArgs: false` on every coach tool — unchanged secrets-safe posture).
`listTools` now returns `readonly ToolRegistration[]` (both callers already only read
`.name`); `stdio.ts`/`http.ts` surface `description` in `ListToolsRequestSchema`. New
append-only retired-tool ledger: `retireTool()` + a `RetiredToolError` (410,
`{reason, retiredAt}`) checked in `handleToolCall` before the existing `NotFoundError` —
a deliberately-retired tool now answers a distinct, actionable error instead of the same
404 an unknown tool gets. No auth/entitlement/rate-limit logic touched.
