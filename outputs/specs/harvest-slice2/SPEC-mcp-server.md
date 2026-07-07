# SPEC — `@caisson/mcp-server` tool manifest + retirement ledger

**Status: EXECUTED — ADR-0216, harvest slice-2 wave, 2026-07-02 operator picker, shipped PR #47.**

- **Package:** `packages/mcp-server` (Apache-2.0, `oss` tier, base — never an edition, ADR-0003).
- **Source (pattern, not port):** gridwork-core's `McpManifestSchema` governance shape, role
  inverted — Caisson **exposes** tools to buyers, gridwork-core's manifest governs consumed ones.
- **Type:** HARDEN IN PLACE (ADR-0210 lock 1) — lands inside this base package; edition membership
  and `manifest.ts` deps/license/tier are unchanged. **Tags:** none (no auth/secrets/external-system
  logic touched — ADR-0112 rate-limit + `isEntitled` untouched).

## Goal (WHAT + WHY)

`ToolRegistration` (`server.ts:91-95`) carries no description/version/audit metadata, so
`listTools`/`ListToolsRequestSchema` (`stdio.ts:71-76`, `http.ts:148-152`) hand a connecting MCP
client bare names — no visible tool docs, no declared audit-loggability (coach tools are
secrets-safe by construction, `coach.ts:5-15`, but nothing marks that machine-readably). Separately,
`handleToolCall` collapses "never existed" and "we killed it" into the same 404
(`server.ts:242-247`) — a buyer integration hitting a retired tool gets an indistinguishable
"unknown tool" instead of a reason, a support-ticket generator once the tool surface evolves.

## Scope

**In:** `ToolRegistration` gains Zod-validated `description`/`version`/`audit.logArgs`; all 7
existing registrations (3 base + 4 coach) annotated; `listTools` surfaces `description` through
`stdio.ts`/`http.ts`; a `retireTool()` ledger checked in `handleToolCall` before the `NotFoundError`
throw, returning a distinct 410-style error + reason.

**Out:** no runtime retirement of a currently-shipped tool (mechanism only); no ledger list/admin
endpoint (YAGNI until a caller needs it); no change to entitlement/rate-limit gates; no
`@caisson/kernel` edit — the new error is a local subclass of the exported `CaissonError`.

## Design

**Manifest.** `registerTool()` validates `{description: z.string().min(1).max(280), version:
z.string().regex(/^\d+\.\d+\.\d+$/), audit: strictObject({logArgs: z.boolean()})}` (new
`toolManifestSchema`, `strictObject`) before the existing duplicate-name guard — a bad manifest
throws `ValidationError` at registration time, not call time. `logArgs: false` on all 4 coach
tools (unchanged secrets-safe posture); `true` on `list_modules`/`describe_module`/`generate`.
`listTools`'s return type changes from `readonly string[]` to `readonly ToolRegistration[]` (both
call sites already only read `.name`); `stdio.ts`/`http.ts` add `description: reg.description` to
their `ListToolsRequestSchema` map.

**Retirement ledger.** New `RetiredTool { name, reason, retiredAt: string }` and
`class RetiredToolError extends CaissonError { code = "tool_retired"; httpStatus = 410 }`
(details: `{reason, retiredAt}`) in `server.ts`. `McpServer` gains `retireTool(entry): void` —
mirrors `registerTool`'s fail-closed shape: throws `ValidationError` if the name is already
retired OR currently active in `registry` (never both). In `handleToolCall`, when
`registration === undefined || !isEntitled(...)`, check the retired-tools map first: a hit throws
`RetiredToolError`; a miss falls through to today's `NotFoundError`. Append-only by construction
(no `unretireTool`); per-server-instance, same seeding pattern as `registerTool` — no new
persistence surface. `toErrorResponse` (kernel) already renders any `CaissonError` subclass
generically, so the 410 surfaces through the existing `stdio.ts`/`http.ts` catch blocks unedited.

## Tasks

1. `toolManifestSchema` + extend `ToolRegistration` + validate in `registerTool()` — `server.ts`.
   Verify: `bun test packages/mcp-server/src/server.test.ts`.
2. Annotate the 3 base + 4 coach registrations with the new fields — `server.ts`, `coach.ts`.
   Verify: `bun test packages/mcp-server/src`.
3. `RetiredTool`, `RetiredToolError`, `retireTool()`, pre-404 branch in `handleToolCall` —
   `server.ts`. New `retired-tool.test.ts`: retired → 410+reason; unknown → unchanged 404;
   double-retire / retire-a-live-name both throw. Verify:
   `bun test packages/mcp-server/src/retired-tool.test.ts`.
4. Surface `description` in both `ListToolsRequestSchema` handlers — `stdio.ts`, `http.ts`.
   Verify: `bun test packages/mcp-server/src/stdio.test.ts packages/mcp-server/src/http.test.ts`.
5. Export `RetiredTool` from `index.ts`; changeset naming `@caisson/mcp-server` (`patch` — additive,
   no `McpServerOptions`/`onGenerate`/auth break). Verify: `bun run --filter=@caisson/mcp-server
build lint test` + `changeset status --since=origin/main`.

## Verify (goal-backward)

- Every pre-existing `packages/mcp-server/src/*.test.ts` behavior (auth/entitlement/rate-limit/
  generate) is unchanged — only new tests + new optional-field coverage added.
- A retired-tool call returns `tool_retired`/410 with `{reason, retiredAt}`; a truly-unknown tool
  still returns plain `not_found`/404 — the two are distinguishable by a client.
- `mcp.listTools(session)` entries carry non-empty `description`, visible over both transports.
- `bun run check` green; `manifest.ts` deps/license/tier byte-identical (no new `package.json`
  dependency — `zod` and kernel's `CaissonError` are already imported).

## Effort: S (~2-4 hrs). Value: MEDIUM (governance + support-load reduction, not revenue-additive).
