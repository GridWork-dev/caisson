// ADR-0161: end-to-end proof of the Streamable-HTTP transport binding — mirrors `stdio.test.ts`
// but drives a REAL loopback `node:http.Server` (via `runHttpServer`) with a real
// `@modelcontextprotocol/sdk` `Client` over `StreamableHTTPClientTransport` (a real socket, real
// JSON-RPC framing, real HTTP status codes) instead of the in-memory pipe stdio uses — this is the
// genuinely new surface (network-reachable, one process serving N clients) the ADR calls out.
// Loopback only: no real external egress. The host (`onGenerate`) stays an in-memory fixture,
// mirroring the rest of this DB-free package.
import { createServer, type Server as NodeHttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  ConfigError,
  RateLimitError,
  fetchWithTimeout,
} from "@caisson-sh/kernel";
import { loadRegistryIndex } from "@caisson-sh/registry-schema";
import {
  createHttpMcpHandler,
  runHttpServer,
  type HttpServerDeps,
} from "./http.ts";
import type { McpServerOptions } from "./server.ts";

const index = loadRegistryIndex({
  schemaVersion: 1,
  modules: [
    {
      id: "@caisson-sh/auth",
      latest: "0.1.0",
      versions: [
        {
          version: "0.1.0",
          manifest: {
            id: "@caisson-sh/auth",
            version: "0.1.0",
            license: "Apache-2.0",
            description: "Fixture module for the HTTP transport test.",
          },
          publishedAt: "2026-06-27T00:00:00.000Z",
          gateAttestation: "ci-fixture@0000000",
        },
      ],
    },
  ],
});

// Two distinct callers on two accounts — used to prove the stateless per-request transport never
// leaks one caller's session into another's response (run_status echoes the session's account).
const TOKEN_A = "mcp_tok_http_buyer_a000000000000";
const TOKEN_B = "mcp_tok_http_buyer_b000000000000";

function baseMcpOptions(): McpServerOptions {
  return {
    tokens: [
      { token: TOKEN_A, accountId: "acct_http_a" },
      { token: TOKEN_B, accountId: "acct_http_b" },
    ],
    index,
    onGenerate: () => Promise.resolve({ generationId: "gen_http_1" }),
  };
}

function deps(
  mcp: McpServerOptions = baseMcpOptions(),
  hostHeader = "127.0.0.1",
): HttpServerDeps {
  return {
    mcp,
    allowedHosts: [hostHeader],
    allowedOrigins: ["https://buyer.example.test"],
  };
}

/**
 * Starts a real loopback MCP HTTP server and returns its endpoint URL. The SDK's rebinding
 * protection matches the raw `Host` header verbatim (`host:port`), so a free port is grabbed
 * FIRST (a throwaway probe listener) and fed into `allowedHosts` before the real server — carrying
 * the fixture's `checkRateLimit` hook, etc. — is built and bound to that exact port.
 */
async function listen(mcp: McpServerOptions = baseMcpOptions()) {
  const probe = createServer();
  const port = await new Promise<number>((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      resolve((probe.address() as AddressInfo).port);
    });
  });
  await new Promise<void>((resolve) => probe.close(() => resolve()));

  const server = await runHttpServer(deps(mcp, `127.0.0.1:${port}`), {
    port,
    host: "127.0.0.1",
  });
  return { server, url: new URL(`http://127.0.0.1:${port}/`) };
}

function bearerTransport(url: URL, token: string): Transport {
  const transport = new StreamableHTTPClientTransport(url, {
    requestInit: { headers: { authorization: `Bearer ${token}` } },
  });
  // Same upstream declaration-file gap as `http.ts`'s server-side cast: this class's
  // onclose/onerror/onmessage/sessionId accessors are typed `T | undefined`, one notch looser
  // than `Transport`'s plain optional `T` fields — only surfaces under
  // `exactOptionalPropertyTypes`; the class implements `Transport` at runtime.
  return transport as unknown as Transport;
}

/** `callTool`'s declared return type is a union with a legacy `{ toolResult }` arm that has no
 *  `content` field — this server never returns that shape (see `buildBoundServer` in `http.ts`),
 *  so narrow it explicitly rather than widen the helper's parameter type to `unknown`. */
function textOf(result: Awaited<ReturnType<Client["callTool"]>>): unknown {
  if (!("content" in result) || !Array.isArray(result.content)) {
    throw new Error("expected a content-array tool result");
  }
  const [first] = result.content as { type: string; text: string }[];
  return JSON.parse(first?.text ?? "{}");
}

const openServers: NodeHttpServer[] = [];
const openClients: Client[] = [];

afterEach(async () => {
  await Promise.all(openClients.splice(0).map((c) => c.close()));
  await Promise.all(
    openServers
      .splice(0)
      .map((s) => new Promise<void>((resolve) => s.close(() => resolve()))),
  );
});

describe("createHttpMcpHandler construction (ADR-0161 decision 4 — fail-closed)", () => {
  test("an empty allowedHosts allowlist is rejected at construction", () => {
    expect(() => createHttpMcpHandler({ ...deps(), allowedHosts: [] })).toThrow(
      ConfigError,
    );
  });

  test("an empty allowedOrigins allowlist is rejected at construction", () => {
    expect(() =>
      createHttpMcpHandler({ ...deps(), allowedOrigins: [] }),
    ).toThrow(ConfigError);
  });

  test("a literal wildcard allowedOrigins entry is rejected at construction (CORS floor)", () => {
    expect(() =>
      createHttpMcpHandler({ ...deps(), allowedOrigins: ["*"] }),
    ).toThrow(ConfigError);
  });

  test("a real origin entry is accepted", () => {
    expect(() =>
      createHttpMcpHandler({
        ...deps(),
        allowedOrigins: ["https://example.com"],
      }),
    ).not.toThrow();
  });
});

describe("HTTP transport binding (ADR-0161)", () => {
  test("missing Authorization: 401, before any tool is reachable", async () => {
    const { server, url } = await listen();
    openServers.push(server);

    const res = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({
      error: { code: "unauthenticated" },
    });
    // Security-floor headers must be present even on the error path (b272c2150353492e).
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("strict-transport-security")).toBe(
      "max-age=63072000; includeSubDomains",
    );
  });

  test("an oversized POST body is rejected 400 before the SDK's uncapped JSON.parse (DoS b719aff8)", async () => {
    const { server, url } = await listen();
    openServers.push(server);

    // > MAX_BODY_BYTES (256 KiB): the handler stops accumulating and rejects with a client 400
    // before the body is fully buffered or JSON-parsed on the shared event loop. Auth is valid, so
    // this proves the cap fires AFTER auth but BEFORE the transport's own uncapped read.
    const res = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        authorization: `Bearer ${TOKEN_A}`,
      },
      body: "a".repeat(300 * 1024),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error: { code: "validation_error" },
    });
  });

  test("an invalid bearer: 401, before any tool is reachable", async () => {
    const { server, url } = await listen();
    openServers.push(server);

    const res = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer not-a-real-token",
      },
      body: "{}",
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({
      error: { code: "unauthenticated" },
    });
  });

  test("the Authorization scheme: extra spaces are accepted, a wrong or unspaced scheme is 401", async () => {
    const { server, url } = await listen();
    openServers.push(server);

    const statusFor = async (authorization: string): Promise<number> => {
      const res = await fetchWithTimeout(url, {
        method: "POST",
        headers: { "content-type": "application/json", authorization },
        body: "{}",
      });
      await res.text();
      return res.status;
    };
    expect(await statusFor(`Bearer   ${TOKEN_A}`)).not.toBe(401);
    expect(await statusFor(`bearer ${TOKEN_A}`)).toBe(401);
    expect(await statusFor(`Bearer${TOKEN_A}`)).toBe(401);
    expect(await statusFor("Bearer ")).toBe(401);
  });

  test("security-floor headers are present on the authenticated SDK success path", async () => {
    const { server, url } = await listen();
    openServers.push(server);

    // A raw fetch (not the SDK client) so we can read response headers directly — the SDK's
    // `handleRequest` writes its own headers, which must MERGE with, not drop, the pre-set ones.
    const res = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        authorization: `Bearer ${TOKEN_A}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      }),
    });
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("strict-transport-security")).toBe(
      "max-age=63072000; includeSubDomains",
    );
  });

  test("a valid bearer: list_tools + tools/call round-trip through the real HTTP transport", async () => {
    const { server, url } = await listen();
    openServers.push(server);

    const client = new Client({ name: "http-test-client", version: "0.0.0" });
    openClients.push(client);
    await client.connect(bearerTransport(url, TOKEN_A));

    const tools = await client.listTools();
    expect(tools.tools.map((t) => t.name)).toEqual([
      "describe_module",
      "generate",
      "list_modules",
    ]);
    // ADR-0216: every listed tool carries a non-empty description over this transport too.
    for (const t of tools.tools) {
      expect(typeof t.description).toBe("string");
      expect((t.description ?? "").length).toBeGreaterThan(0);
    }

    const result = await client.callTool({
      name: "list_modules",
      arguments: {},
    });
    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toEqual({ modules: ["@caisson-sh/auth"] });
  });

  test("a tool-level failure surfaces as an MCP isError result, not a thrown protocol error", async () => {
    const { server, url } = await listen();
    openServers.push(server);

    const client = new Client({ name: "http-test-client", version: "0.0.0" });
    openClients.push(client);
    await client.connect(bearerTransport(url, TOKEN_A));

    const result = await client.callTool({
      name: "describe_module",
      arguments: { name: "@caisson-sh/billing" },
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatchObject({ error: { code: "not_found" } });
  });

  test("capabilities advertise resources, and resources/list + read round-trip over HTTP", async () => {
    const { server, url } = await listen();
    openServers.push(server);

    const client = new Client({ name: "http-test-client", version: "0.0.0" });
    openClients.push(client);
    await client.connect(bearerTransport(url, TOKEN_A));

    // (v) the resources capability is advertised over the network transport too.
    expect(client.getServerCapabilities()?.resources).toBeDefined();

    const list = await client.listResources();
    expect(list.resources.map((r) => r.uri)).toContain(
      "caisson://registry/index",
    );

    const read = await client.readResource({ uri: "caisson://registry/index" });
    const contents = read.contents as { uri: string; text: string }[];
    const parsed = JSON.parse(contents[0]?.text ?? "{}") as {
      modules: { id: string }[];
    };
    expect(parsed.modules.map((m) => m.id)).toEqual(["@caisson-sh/auth"]);

    await expect(
      client.readResource({ uri: "caisson://nope/missing" }),
    ).rejects.toThrow();
  });

  test("capabilities advertise prompts, and prompts/list + get round-trip over HTTP", async () => {
    const { server, url } = await listen();
    openServers.push(server);

    const client = new Client({ name: "http-test-client", version: "0.0.0" });
    openClients.push(client);
    await client.connect(bearerTransport(url, TOKEN_A));

    expect(client.getServerCapabilities()?.prompts).toBeDefined();

    const list = await client.listPrompts();
    expect(list.prompts.map((p) => p.name)).toContain("integrate_module");

    const got = await client.getPrompt({
      name: "integrate_module",
      arguments: { module_id: "@caisson-sh/auth" },
    });
    expect(got.messages).toHaveLength(1);
    expect((got.messages[0]!.content as { text: string }).text).toContain(
      "@caisson-sh/auth",
    );

    await expect(
      client.getPrompt({ name: "nope_missing", arguments: {} }),
    ).rejects.toThrow();
  });

  test("two different bearers get two independent, non-cross-talking sessions", async () => {
    const { server, url } = await listen({
      ...baseMcpOptions(),
      runTools: {
        runStart: async ({ accountId }) => ({ accountId }),
        runStatus: async ({ accountId }) => ({ accountId }),
      },
    });
    openServers.push(server);

    const clientA = new Client({
      name: "http-test-client-a",
      version: "0.0.0",
    });
    const clientB = new Client({
      name: "http-test-client-b",
      version: "0.0.0",
    });
    openClients.push(clientA, clientB);
    await Promise.all([
      clientA.connect(bearerTransport(url, TOKEN_A)),
      clientB.connect(bearerTransport(url, TOKEN_B)),
    ]);

    // Same tool, same server process, two concurrent callers — each must see ONLY their own
    // account (echoed back by the host's run_status callback), proving the per-request session is
    // never shared or reused across bearers.
    const [resultA, resultB] = await Promise.all([
      clientA.callTool({ name: "run_status", arguments: { runId: "r1" } }),
      clientB.callTool({ name: "run_status", arguments: { runId: "r1" } }),
    ]);
    expect(textOf(resultA)).toEqual({ accountId: "acct_http_a" });
    expect(textOf(resultB)).toEqual({ accountId: "acct_http_b" });

    // A failing call from B (unknown module) leaves A unaffected — no shared mutable session state.
    const describeB = await clientB.callTool({
      name: "describe_module",
      arguments: { name: "@caisson-sh/nope" },
    });
    expect(describeB.isError).toBe(true);
    expect(textOf(describeB)).toMatchObject({ error: { code: "not_found" } });
    const describeA = await clientA.callTool({
      name: "describe_module",
      arguments: { name: "@caisson-sh/auth" },
    });
    expect(describeA.isError).toBeFalsy();
  });

  test("an over-limit checkRateLimit hook blocks the call and renders isError, matching stdio", async () => {
    const limited: McpServerOptions = {
      ...baseMcpOptions(),
      checkRateLimit: () =>
        Promise.reject(
          new RateLimitError("over limit", { retryAfterMs: 1000 }),
        ),
    };
    const { server, url } = await listen(limited);
    openServers.push(server);

    const client = new Client({ name: "http-test-client", version: "0.0.0" });
    openClients.push(client);
    await client.connect(bearerTransport(url, TOKEN_A));

    const result = await client.callTool({
      name: "list_modules",
      arguments: {},
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatchObject({ error: { code: "rate_limited" } });
  });
});
