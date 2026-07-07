# @caisson/mcp-server

## 0.2.5

### Patch Changes

- Updated dependencies [8170382]
- Updated dependencies [8c53ca3]
  - @caisson/registry-schema@0.4.0
  - @caisson/ai-config@0.3.0

## 0.2.4

### Patch Changes

- b791198: Documentation and metadata cleanup plus dependency-declaration hygiene: package descriptions, READMEs, changelogs, and source comments no longer carry internal build references, and shared external dependency ranges now resolve through the workspace dependency catalog (published dependency ranges unchanged; the TypeScript devDependency floor moves to ^5.7.3).
- d6cc28e: Adds the bundle vocabulary spine: a new additive "bundle" module kind (historical edition entries stay valid), the shared BUNDLE_IDS constant plus the legacy-purchased-id alias map with normalizeEntitlementId, and resolve-time alias normalization at the single entry point inside expandEntitlements — legacy edition and bundle-sentinel purchase ids keep resolving to the identical leaf sets forever, and a kind:"bundle" index entry expands via its members map exactly like an edition. The mcp-server change is test-only coverage of the alias and bundle paths through the generate gate.
- 6e48b18: The HTTP MCP transport now rejects a wildcard origin at server construction — an
  `allowedOrigins` allowlist containing a bare `"*"` throws immediately instead of being
  accepted, so a misconfigured deployment can never silently open MCP tool calls to every
  origin. Every response from the HTTP handler (success, auth failure, and body-parse
  error paths) also now carries the standard security response headers
  (`X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`).
- 0af4dbf: Rewrote README, AGENTS, CHANGELOG, package.json descriptions, and inline source comments to
  read as clean, buyer-facing documentation. Removed sibling-repository provenance framing,
  internal build-phase shorthand, and bare specification-id citations that had leaked into
  shipped copy. No runtime behavior changed in any package — documentation and comments only.
- Updated dependencies [b791198]
- Updated dependencies [d6cc28e]
- Updated dependencies [2834c3f]
- Updated dependencies [41e07b6]
- Updated dependencies [850b844]
- Updated dependencies [31d6a41]
- Updated dependencies [0af4dbf]
- Updated dependencies [0af4dbf]
- Updated dependencies [0af4dbf]
  - @caisson/ai-config@0.2.4
  - @caisson/kernel@0.4.2
  - @caisson/registry-schema@0.3.0

## 0.2.3

### Patch Changes

- Updated dependencies [cf66d65]
  - @caisson/kernel@0.4.1
  - @caisson/ai-config@0.2.3

## 0.2.2

### Patch Changes

- Updated dependencies [fb8d966]
  - @caisson/kernel@0.4.0
  - @caisson/ai-config@0.2.2

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
