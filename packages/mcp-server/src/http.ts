// Follow-on (ADR-0161): the Streamable-HTTP transport binding for the SAME transport-agnostic
// core `stdio.ts` binds — `server.ts` is reused verbatim, unedited. Unlike stdio (spawned 1:1 by a
// trusted local client, never network-exposed), this listener is network-reachable, so the auth +
// network-surface posture differs from stdio in two load-bearing ways documented in the ADR:
//
// 1. STATELESS, per-request auth (ADR-0161 decision 2, Option B): stdio authenticates ONCE per
//    connection because one process == one buyer session; HTTP has no such 1:1 binding (one
//    listener serves every buyer), so EVERY request re-extracts `Authorization: Bearer <token>`
//    and re-runs `mcp.authenticate` before a `Server`/transport is ever built — a missing/invalid
//    token is a 401 with no transport constructed, mirroring stdio's fail-closed shape per-request
//    instead of per-connection. `sessionIdGenerator: undefined` keeps the SDK transport itself
//    stateless too: no session map, no TTL sweep, no DELETE lifecycle, no cross-tenant mixups.
// 2. The network surface is BINDING (ADR-0161 decision 4): DNS-rebinding protection + an explicit
//    host/origin allowlist are constructor-time requirements, not optional hardening — an empty
//    allowlist fails closed at `createHttpMcpHandler(deps)` construction, before the handler can
//    ever serve a request. TLS termination is the host's job (this binds plain `node:http`).
//
// The tool-dispatch wiring (list_tools / tools/call, including the ADR-0112 rate-limit hook already
// awaited inside `mcp.handleToolCall`, and the `toErrorResponse`-rendered `isError` envelope) is
// IDENTICAL to `stdio.ts`'s — duplicated here rather than exported from `stdio.ts`, because ADR-0161
// decision 1 requires zero edits to `stdio.ts` (its exports/behavior stay exactly as shipped).
import {
  createServer,
  type IncomingMessage,
  type Server as NodeHttpServer,
  type ServerResponse,
} from "node:http";
import {
  Server,
  type ServerOptions,
} from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
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
import { ConfigError, ValidationError, toErrorResponse } from "@caisson/kernel";
import {
  createMcpServer,
  type McpServerOptions,
  type McpSession,
} from "./server.ts";

// Reported to the MCP client as `Implementation.version` — same literal as `stdio.ts` (protocol
// metadata only, no gate compares it to `package.json`; see that file's header for why it's not a
// `../package.json` import).
const SERVER_VERSION = "0.1.0";

/** Mirrors `stdio.ts`'s `PERMISSIVE_INPUT_SCHEMA` — advertised-to-the-client shape only; each
 *  handler still enforces its own strict Zod shape via `parseStrict`. */
const PERMISSIVE_INPUT_SCHEMA = { type: "object" as const };

/** Wiring input: the existing transport-agnostic port plus the network-surface allowlists ADR-0161
 *  decision 4 requires. Both allowlists are REQUIRED and must be non-empty — `createHttpMcpHandler`
 *  fails closed rather than silently disable the SDK's rebinding protection (the security floor's
 *  "no localhost fallback in production code": the host supplies its real values, this package
 *  never defaults one in). */
export interface HttpServerDeps {
  readonly mcp: McpServerOptions;
  /** Host header allowlist (DNS rebinding protection). */
  readonly allowedHosts: readonly string[];
  /** Origin header allowlist — never `*`, never reflected. */
  readonly allowedOrigins: readonly string[];
}

export type HttpMcpHandler = (
  req: IncomingMessage,
  res: ServerResponse,
) => Promise<void>;

// b719aff8: the SDK's StreamableHTTP transport reads the POST body with NO size cap (an uncapped
// `await req.json()`), so an authenticated caller's giant body would be fully buffered + JSON.parsed
// on the shared event loop before any handler runs. We read POST bodies ourselves under this hard
// byte ceiling and hand the SDK the already-parsed value, so its own uncapped read never fires. 256
// KiB is ~10x the largest legitimate `generate` call (MAX_MODULES × {id≤128, version≤64} ≈ 25 KiB);
// raise it in lockstep if MAX_MODULES grows.
const MAX_BODY_BYTES = 256 * 1024;

const BEARER_PATTERN = /^Bearer +(.+)$/;

/** The security-floor response headers (`identity/security.md` Headers clause). TLS termination is
 *  upstream of this plain `node:http` listener; HSTS is what the terminating proxy forwards. */
const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
};

/** Pre-sets the floor headers via `setHeader` (never `writeHead`) so they merge with, rather than
 *  get overwritten by, whatever writes the response next — a raw `res.writeHead` call on the error
 *  path, or the SDK transport's own `writeHead`/`setHeader` calls on the success path. */
function applySecurityHeaders(res: ServerResponse): void {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    res.setHeader(name, value);
  }
}

/**
 * Read a POST body under a hard byte ceiling and JSON-parse it, so the SDK's own uncapped
 * `await req.json()` (b719aff8) never runs. Accumulation stops the instant the total exceeds
 * `maxBytes` — a giant body is rejected without being fully buffered or parsed, capping the
 * event-loop cost at O(maxBytes). Throws `ValidationError` (client 400) on overflow or invalid JSON.
 */
function readJsonBody(
  req: IncomingMessage,
  maxBytes: number,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let done = false;
    const onData = (chunk: Buffer): void => {
      if (done) return;
      total += chunk.length;
      if (total > maxBytes) {
        done = true;
        req.off("data", onData);
        reject(new ValidationError("Request body too large", { maxBytes }));
        return;
      }
      chunks.push(chunk);
    };
    req.on("data", onData);
    req.once("end", () => {
      if (done) return;
      done = true;
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new ValidationError("Invalid JSON body"));
      }
    });
    req.once("error", (err: Error) => {
      if (done) return;
      done = true;
      reject(err);
    });
  });
}

/** Extracts the raw bearer token from `Authorization: Bearer <token>`, or `""` when absent/
 *  malformed — an empty string never matches a real (non-empty) token in `mcp.authenticate`'s
 *  constant-time compare, so this collapses cleanly to the same 401 path as a wrong token. */
function extractBearer(req: IncomingMessage): string {
  const header = req.headers.authorization;
  if (typeof header !== "string") return "";
  return BEARER_PATTERN.exec(header)?.[1]?.trim() ?? "";
}

/** Builds (but does not connect) the low-level SDK `Server` bound to one authenticated session.
 *  Identical wiring to `stdio.ts`'s `createStdioMcpServer` body — see the file header for why it's
 *  duplicated rather than shared. */
function buildBoundServer(
  mcp: ReturnType<typeof createMcpServer>,
  session: McpSession,
): Server {
  // `resources: {}` and `prompts: {}` declared alongside `tools: {}` — advertises the capabilities
  // AND admits the resources/* and prompts/* handlers. Deliberately duplicated from `stdio.ts` per
  // ADR-0161 decision 1 (zero edits to stdio's exports/behaviour), same as the tool wiring.
  const options: ServerOptions = {
    capabilities: { tools: {}, resources: {}, prompts: {} },
  };
  const server = new Server(
    { name: "caisson-buyer-mcp", version: SERVER_VERSION },
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
        // Same client-safe envelope as every other host boundary (`toErrorResponse`, ADR-0019),
        // surfaced as an MCP `isError` result — never a thrown protocol-level error.
        const { body } = toErrorResponse(err);
        return {
          isError: true,
          content: [{ type: "text", text: JSON.stringify(body) }],
        };
      }
    },
  );

  // Resource wiring, identical to `stdio.ts`'s — duplicated per ADR-0161 decision 1.
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
        // resources/read has no `isError` result arm — surface the same client-safe envelope
        // (`toErrorResponse`, ADR-0019) as a JSON-RPC error; an unknown URI surfaces as the
        // not_found envelope.
        const { body } = toErrorResponse(err);
        throw new McpError(
          ErrorCode.InvalidParams,
          body.error.message,
          body.error,
        );
      }
    },
  );

  // Prompt wiring, identical to `stdio.ts`'s — duplicated per ADR-0161 decision 1.
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
        // The core returns readonly PromptResult; cast to the SDK's mutable-structural result at
        // this boundary (identical shape, no runtime copy) — same as `stdio.ts`.
        return (await mcp.getPrompt(
          session,
          request.params.name,
          request.params.arguments ?? {},
        )) as GetPromptResult;
      } catch (err) {
        // prompts/get has no `isError` result arm (like resources/read) — surface the same
        // client-safe not_found envelope for an unknown name.
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
 * Build a plain `node:http` request handler bound to the buyer-MCP core via `deps.mcp`. Per
 * request: re-authenticate the Bearer, fail closed with `401` before any `Server`/transport exists
 * (ADR-0161 decision 2), then build a fresh bound `Server` + a stateless
 * `StreamableHTTPServerTransport` (`sessionIdGenerator: undefined`) and hand the request to it.
 *
 * Throws `ConfigError` at construction time when either allowlist is empty — a network-reachable
 * listener with rebinding protection silently disabled is not a safe default (ADR-0161 decision 4).
 */
export function createHttpMcpHandler(deps: HttpServerDeps): HttpMcpHandler {
  if (deps.allowedHosts.length === 0) {
    throw new ConfigError(
      "createHttpMcpHandler requires a non-empty allowedHosts allowlist",
    );
  }
  if (deps.allowedOrigins.length === 0) {
    throw new ConfigError(
      "createHttpMcpHandler requires a non-empty allowedOrigins allowlist",
    );
  }
  // The floor ("CORS uses an explicit origin allowlist. Never `*` and never reflected origin.")
  // is a CONTENTS check, not just a non-empty check — a caller passing `["*"]` would otherwise
  // sail through. The SDK's `allowedOrigins` does literal-equality matching (no pattern parsing),
  // so a narrow literal-`*` reject is the whole gate; a full CORS-pattern parser is slop.
  if (deps.allowedOrigins.some((origin) => origin === "*")) {
    throw new ConfigError(
      'createHttpMcpHandler rejects a literal "*" in allowedOrigins — CORS requires an explicit origin allowlist',
    );
  }

  const mcp = createMcpServer(deps.mcp);
  const allowedHosts = [...deps.allowedHosts];
  const allowedOrigins = [...deps.allowedOrigins];

  return async function handleHttpMcpRequest(req, res): Promise<void> {
    let session: McpSession;
    let parsedBody: unknown;
    try {
      // Fail-closed BEFORE any transport exists — an unauthenticated caller cannot reach
      // list_tools OR tools/call, mirroring stdio's authenticate-before-transport per request
      // instead of per connection (this listener has no 1:1 connection-to-buyer binding).
      session = mcp.authenticate(extractBearer(req));
      // Read POST bodies under the byte ceiling ourselves (b719aff8) and hand the parsed value to
      // `handleRequest` below, so the SDK skips its own uncapped `req.json()`. GET (SSE) / DELETE
      // carry no body — left as `undefined`, which the SDK treats as "no pre-parsed body".
      if (req.method === "POST") {
        parsedBody = await readJsonBody(req, MAX_BODY_BYTES);
      }
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      applySecurityHeaders(res);
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
      return;
    }

    const server = buildBoundServer(mcp, session);
    // `sessionIdGenerator` is OMITTED, not set to `undefined` — the SDK docs treat the two as
    // equivalent ("if not provided, session management is disabled"), but under this repo's
    // `exactOptionalPropertyTypes` an explicit `undefined` value is a type error for an optional
    // field typed without `| undefined`. Omitting the key is the stateless mode (ADR-0161
    // decision 2) with no type-narrowing cost.
    const transport = new StreamableHTTPServerTransport({
      enableDnsRebindingProtection: true,
      allowedHosts,
      allowedOrigins,
    });

    // Stateless mode builds a fresh Server + transport per request (no session to keep alive) —
    // tear both down when the response closes, the SDK's own documented cleanup point for this
    // mode (fires on success, client disconnect, and error alike).
    res.on("close", () => {
      transport.close().catch(() => undefined);
      server.close().catch(() => undefined);
    });

    // `StreamableHTTPServerTransport`'s onclose/onerror/onmessage are accessor pairs typed
    // `T | undefined`, one notch looser than `Transport`'s plain optional `T` fields — a real
    // upstream declaration-file gap (the class's own doc header declares `implements Transport`)
    // that only surfaces under `exactOptionalPropertyTypes`. `StdioServerTransport` doesn't hit
    // this because it declares plain fields instead of accessors.
    await server.connect(transport as unknown as Transport);
    // Pre-set via `setHeader`, not `writeHead` — the SDK transport's own `writeHead`/`setHeader`
    // calls inside `handleRequest` merge with these rather than overwrite them.
    applySecurityHeaders(res);
    await transport.handleRequest(req, res, parsedBody);
  };
}

export interface HttpListenOptions {
  readonly port: number;
  /** No default — the security floor forbids a `localhost`/`127.0.0.1` fallback in shipped code;
   *  the host supplies its real bind address. */
  readonly host: string;
}

/**
 * Convenience wrapper (parity with `runStdioServer`): build the handler and bind a real
 * `node:http` server to it. Returns the listening server so the caller can close it.
 */
export async function runHttpServer(
  deps: HttpServerDeps,
  listen: HttpListenOptions,
): Promise<NodeHttpServer> {
  const handler = createHttpMcpHandler(deps);
  const server = createServer((req, res) => {
    // bun-types augments IncomingMessage with a required signal, while @types/node 26's
    // createServer callback exposes the unaugmented Node shape. This server runs on Bun; bridge
    // that declaration-only mismatch at the callback boundary without weakening the public type.
    handler(req as IncomingMessage, res).catch((err: unknown) => {
      if (!res.headersSent) {
        const { status, body } = toErrorResponse(err);
        applySecurityHeaders(res);
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(body));
        return;
      }
      res.end();
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(listen.port, listen.host, resolve);
  });
  return server;
}
