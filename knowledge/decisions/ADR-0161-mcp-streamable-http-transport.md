# ADR-0161 — MCP Streamable-HTTP remote transport (beside stdio)

Status: accepted · 2026-07-01 · Stage-2 Stream C (task C6) · implements ADR-0008 (buyer-MCP auth) +
ADR-0112 (rate limit); does NOT supersede either. Reserved range 0160–0169.

ADR-0008 locked the buyer-MCP server: an auth-gated, entitlement-scoped tool surface. Its transport
binder today is **stdio only** (`packages/mcp-server/src/stdio.ts`) — the file header records that
HTTP/SSE was _deferred_ because "a network-reachable MCP gateway raises token-mint abuse stakes until
license-persistence resolves." That blocker is now resolved: the license **issuer** (ADR-0110), the
per-account **rate limit** (ADR-0112), and the **entitlement store + revoke** (ADR-0113) all shipped in
P6. This ADR authorizes a Streamable-HTTP transport beside stdio. Append-only; supersede, never edit.

## Context

The transport-agnostic core (`server.ts` `createMcpServer`) already holds no per-connection state:
`authenticate(bearer)` is a pure timing-safe scan returning an `McpSession`; `handleToolCall` awaits
the ADR-0112 `checkRateLimit` hook and renders failures through `toErrorResponse` (ADR-0019) as an MCP
`isError` result. `@modelcontextprotocol/sdk@^1.29.0` (already a dependency) ships
`StreamableHTTPServerTransport` (`server/streamableHttp.js`) — the modern MCP transport that replaces
the deprecated HTTP+SSE, implements the same `Transport` interface as `StdioServerTransport`, and adds
`handleRequest(req,res,body)` plus a `sessionIdGenerator` option (stateful vs stateless mode).

## Decisions

1. **New `http.ts` binder beside `stdio.ts`; the core is reused UNCHANGED.** Zero edits to `server.ts`,
   `coach.ts`, or `stdio.ts`. `http.ts` exports `createHttpMcpHandler(deps)` (a
   `(req,res)=>Promise<void>` Node handler) + a `runHttpServer` convenience wrapper (parity with
   `runStdioServer`), exported from `index.ts` beside the stdio pair. Uses plain `node:http` +
   `StreamableHTTPServerTransport` — **no new dependency** (no express/fastify; the ladder says skip a
   framework the SDK transport already covers).

2. **Auth model — STATELESS, per-request (Option B).** `sessionIdGenerator: undefined`; every POST
   re-extracts `Authorization: Bearer <token>` and re-runs `mcp.authenticate(bearer)` before any tool
   dispatch — a missing/invalid token is a `401` before a `Server` is built (mirrors stdio's
   authenticate-before-transport, `stdio.ts:63`). Chosen over the stateful-session alternative (Option
   A: authenticate once per `Mcp-Session-Id`) because it matches ADR-0008's literal binding ("every
   request re-validates the license token in constant time" — stdio's once-per-connection auth was
   already a slight lag behind that text, on a non-network surface), removes the entire session-map
   lifecycle/leak class (no TTL sweep, no DELETE handling, no cross-tenant session mixups), and is
   trivially horizontally scalable (any process serves any request). The timing-safe compare per
   request is cheap. **A/B is a one-file decision** — if SSE-resumable long-lived streaming tools ever
   become a requirement, a later ADR may add Option A + an explicit idle-timeout sweep; not now.

3. **Rate limit + error envelope carry over unchanged.** The ADR-0112 `checkRateLimit` hook fires
   per-call inside `handleToolCall` regardless of transport; tool failures still surface as `isError`
   results, never thrown protocol errors. The HTTP binder gets both for free by routing `tools/call`
   through `mcp.handleToolCall`, exactly as `stdio.ts:82` does.

4. **The new network attack surface is locked as BINDING, not deferred.** Unlike stdio (spawned 1:1 by
   a trusted local client, never network-exposed), an HTTP listener is reachable, so `http.ts` MUST set
   the SDK's `enableDnsRebindingProtection` + `allowedHosts`, an explicit CORS `allowedOrigins`
   allowlist (never `*`, never reflected — per the security floor), and assume **TLS is terminated by
   the host** (this package binds `node:http`; production fronts it with a TLS-terminating proxy). No
   `localhost` fallback in the shipped path. These are conditions of the transport existing, not
   follow-ups.

## Tests

`http.test.ts` (mirrors `stdio.test.ts` over a real `node:http.Server` + `StreamableHTTPClientTransport`
/ the SDK harness): (1) missing/bad `Authorization` → `401`, no `Server` built (auth-gates-before-
transport); (2) valid Bearer → `list_tools`/`tools/call` round-trip; (3) two **different** Bearers get
two independent, non-cross-talking sessions (the genuinely new concern stdio never had — one process,
N buyers); (4) an over-limit `checkRateLimit` hook blocks the call and a tool-level failure renders as
`isError`, identical to stdio (no-regression). No real network egress (loopback test server only).

## Deferred (not blocking)

- **Stateful/SSE-resumable mode** (Option A + `eventStore`) — only if long-lived streaming tools appear.
- **Distributed session store** — moot under the stateless decision (no server-side session state).
- **An ops endpoint to list/kill live sessions** — no sessions to manage under Option B.

## Binding (carried from ADR-0008/0112)

Every tool call still passes the timing-safe Bearer + per-tool entitlement gate + the rate-limit gate;
the HTTP transport adds a network surface, not a new authorization path. Auth + entitlement remain
fail-closed; only the rate limit fails open (ADR-0112).
