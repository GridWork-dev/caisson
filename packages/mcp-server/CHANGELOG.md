# @caisson/mcp-server

## 0.2.1

### Patch Changes

- c98d07b: ADR-0216: `ToolRegistration` gains a Zod-validated declarative manifest
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
- Updated dependencies [b5915e0]
- Updated dependencies [9558a46]
- Updated dependencies [e62c88d]
- Updated dependencies [ccf8b10]
- Updated dependencies [549dd4e]
  - @caisson/registry-schema@0.2.1
  - @caisson/ai-config@0.2.1
  - @caisson/kernel@0.3.0

## 0.2.0

### Minor Changes

- 9483a36: Initial public release (0.1.0) — publish-readiness flip (ADR-0111). The open Base substrate (Apache-2.0, tier `oss`) publishes to public npm; the commercial editions/primitives/generator (tier `paid`) publish to GitHub Packages restricted. Versions were aligned to 0.1.0 in lockstep with the registry ledger; this changeset records the 0.1.0 release and seeds the changeset-presence gate (ADR-0021).

### Patch Changes

- 22077d1: Whole-repo audit round-3 remediation (ledger 2026-07-01): emitted buyer CI templates get
  least-privilege `permissions:` + `persist-credentials: false`; verifyAccountJwt failure
  messages collapse to one generic reason (oracle closed); judgeGrader validates live judge
  verdicts fail-closed and judge output is bounded; MCP `generate` modules array + id/version
  strings are bounded with an O(1) pre-parse guard; the agent-dev emitter YAML-escapes all
  free-text frontmatter so the `tools:` allowlist is un-suppressible, and `@caisson/tool-exec`
  is wired into the Agentic-Dev edition (ADR-0199, honoring ADR-0178); guardrails cheapDeny is
  stateless across calls (global-regex lastIndex bypass closed); prompt-registry bounds rawVars
  values and total rendered content. Plus the round-4/5 audit domains (admin-plane,
  metering-byok, destructive-jobs, composition-roots, worm-integrity) added to AUDIT_DOMAINS.
- Updated dependencies [72ffd85]
- Updated dependencies [69817a1]
- Updated dependencies [9483a36]
  - @caisson/registry-schema@0.2.0
  - @caisson/kernel@0.2.0
  - @caisson/ai-config@0.2.0
