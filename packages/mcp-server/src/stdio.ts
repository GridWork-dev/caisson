// The @modelcontextprotocol/sdk transport binding for the transport-agnostic core in
// `server.ts`. STDIO ONLY — no SSE/HTTP listener (deferred: a network-reachable MCP gateway raises
// token-mint abuse stakes until license-persistence resolves; stdio is spawned 1:1 by a trusted
// local client, e.g. Claude Desktop / Claude Code, never exposed to the network).
//
// MCP-over-stdio carries no per-request headers, so there is no protocol-level slot for a Bearer on
// every call the way an HTTP-shaped `mcpQuery` host does. The idiomatic mapping
// (mirrors how stdio MCP clients configure one server process per credential, e.g. an env var in the
// client's server config) is: ONE stdio CONNECTION == ONE client session. `bearer` is authenticated
// ONCE, before the transport is ever constructed — an invalid token throws `AuthnError` synchronously
// and no `Server`/transport is built, so every tool the client could have reached is gated shut, not
// merely the first call. `listTools`/`handleToolCall` (incl. the ADR-0112 rate-limit hook, already
// awaited inside `handleToolCall`) are then driven verbatim per request — this file adds no new
// authorization logic, it only marshals JSON-RPC tool list/call requests onto the existing seam.
//
// Production wiring (a real token store keyed by hashed Bearer, a real `Transactor` driving
// `onGenerate`) is a DEPLOY-class seam: `McpServerOptions` stays the typed port a host process
// supplies (PGlite-doubled in tests, real Postgres in prod) — this module never reaches for real
// infra itself.
import {
  Server,
  type ServerOptions,
} from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
  type CallToolResult,
  type GetPromptResult,
  type ReadResourceResult,
} from "@modelcontextprotocol/sdk/types.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { toErrorResponse } from "@caisson-sh/kernel";
import { createMcpServer, type McpServerOptions } from "./server.ts";

// Reported to the MCP client as `Implementation.version` (protocol metadata only — no gate or test
// compares it to `package.json`). A literal, not a `../package.json` import: `tsconfig.json` scopes
// `rootDir` to `src`, so a relative read of the package root from inside `src` fails tsc (TS6059).
const SERVER_VERSION = "0.1.0";

/** Wiring input: the existing transport-agnostic port plus the ONE bearer this stdio connection
 *  authenticates as (see file header — one process, one client session). */
export interface StdioServerDeps {
  readonly mcp: McpServerOptions;
  readonly bearer: string;
}

/** A permissive discovery schema for every tool (MCP requires `inputSchema.type === "object"` on
 *  every listed tool). Each handler still enforces its own strict Zod shape via `parseStrict`
 *  (`server.ts`/`coach.ts`) — this is advertised-to-the-client shape only, not a relaxation of the
 *  real gate, matching the core's `unknown`-args contract (`ToolHandlerContext.args`). */
const PERMISSIVE_INPUT_SCHEMA = { type: "object" as const };

/**
 * Build (but do not connect) the `@modelcontextprotocol/sdk` `Server`, bound to the MCP core
 * via `deps.mcp`. Authenticates `deps.bearer` FIRST — fail-closed before any transport exists. Takes
 * the low-level `Server` (not the newer `McpServer` convenience wrapper) because the tool set is
 * registered at runtime through the seam (ADR-0076), read once at connect time from
 * `listTools(session)` rather than statically declared.
 */
export function createStdioMcpServer(deps: StdioServerDeps): Server {
  const mcp = createMcpServer(deps.mcp);
  // Fail-closed: an invalid/missing token throws here, before `new Server(...)` even runs — no
  // handler is ever wired, so an unauthenticated caller cannot reach list_tools OR tools/call.
  const session = mcp.authenticate(deps.bearer);

  // `resources: {}` and `prompts: {}` are declared alongside `tools: {}` so the SDK advertises those
  // capabilities AND admits the resources/* and prompts/* request handlers below.
  const options: ServerOptions = {
    capabilities: { tools: {}, resources: {}, prompts: {} },
  };
  const server = new Server(
    { name: "caisson-mcp", version: SERVER_VERSION },
    options,
  );

  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: mcp.listTools(session).map((reg) => ({
      name: reg.name,
      description: reg.description,
      inputSchema: PERMISSIVE_INPUT_SCHEMA,
    })),
  }));

  server.setRequestHandler(
    CallToolRequestSchema,
    async (request): Promise<CallToolResult> => {
      try {
        const result = await mcp.handleToolCall(
          session,
          request.params.name,
          request.params.arguments ?? {},
        );
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (err) {
        // Tool-level failures (validation/not-found/rate-limit) render through the
        // SAME client-safe envelope every other host boundary uses (`toErrorResponse`, ADR-0019) —
        // surfaced as an MCP `isError` result, never a thrown protocol-level error, so the calling
        // agent can see and self-correct (per the SDK's `CallToolResult.isError` contract).
        const { body } = toErrorResponse(err);
        return {
          isError: true,
          content: [{ type: "text", text: JSON.stringify(body) }],
        };
      }
    },
  );

  // Resource wiring, the read-side mirror of the tool wiring above. An unknown URI is a 404.
  server.setRequestHandler(ListResourcesRequestSchema, () => ({
    resources: mcp.listResources(session).map((reg) => ({
      uri: reg.uri,
      name: reg.name,
      description: reg.description,
      mimeType: reg.mimeType,
    })),
  }));

  server.setRequestHandler(
    ReadResourceRequestSchema,
    async (request): Promise<ReadResourceResult> => {
      try {
        const result = await mcp.readResource(session, request.params.uri);
        return {
          contents: [
            {
              uri: request.params.uri,
              mimeType: "application/json",
              text: JSON.stringify(result),
            },
          ],
        };
      } catch (err) {
        // resources/read has no `isError` result arm (unlike tools/call), so a failure surfaces as
        // a JSON-RPC error carrying the SAME client-safe envelope in `data` (`toErrorResponse`,
        // ADR-0019). An unknown URI surfaces as the not_found envelope.
        const { body } = toErrorResponse(err);
        throw new McpError(
          ErrorCode.InvalidParams,
          body.error.message,
          body.error,
        );
      }
    },
  );

  // Prompt wiring, the prompt-side mirror of the tool/resource wiring above. An unknown name is a
  // 404.
  server.setRequestHandler(ListPromptsRequestSchema, () => ({
    prompts: mcp.listPrompts(session).map((reg) => ({
      name: reg.name,
      description: reg.description,
      ...(reg.arguments.length > 0
        ? {
            arguments: reg.arguments.map((a) => ({
              name: a.name,
              ...(a.description !== undefined
                ? { description: a.description }
                : {}),
              required: a.required,
            })),
          }
        : {}),
    })),
  }));

  server.setRequestHandler(
    GetPromptRequestSchema,
    async (request): Promise<GetPromptResult> => {
      try {
        // The core returns readonly PromptResult; the SDK result type is mutable-structural — cast
        // at this boundary (the shape is identical; no runtime copy needed).
        return (await mcp.getPrompt(
          session,
          request.params.name,
          request.params.arguments ?? {},
        )) as GetPromptResult;
      } catch (err) {
        // prompts/get has no `isError` result arm (like resources/read) — surface the same
        // client-safe envelope (`toErrorResponse`, ADR-0019) as a JSON-RPC error; an unknown name
        // surfaces as the not_found envelope.
        const { body } = toErrorResponse(err);
        throw new McpError(
          ErrorCode.InvalidParams,
          body.error.message,
          body.error,
        );
      }
    },
  );

  return server;
}

/**
 * Connect the bound server to the given transport (default: real process stdin/stdout). Exposed as
 * a single async entrypoint a host process calls directly; the transport is injectable for tests
 * (`InMemoryTransport.createLinkedPair()`) without spawning a real stdio pipe.
 */
export async function runStdioServer(
  deps: StdioServerDeps,
  transport: Transport = new StdioServerTransport(),
): Promise<Server> {
  const server = createStdioMcpServer(deps);
  await server.connect(transport);
  return server;
}
