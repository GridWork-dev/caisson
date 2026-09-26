// End-to-end proof of the stdio transport binding — drives the bound `Server` through a REAL
// `@modelcontextprotocol/sdk` `Client` over `InMemoryTransport` (the SDK's own pair-of-linked-pipes
// test utility: real JSON-RPC request/response framing, just not a real OS stdin/stdout pipe — the
// server-side code under test (`createStdioMcpServer`) is transport-agnostic over any `Transport`,
// so swapping in `InMemoryTransport` here exercises the exact same wiring `runStdioServer` connects
// to a real `StdioServerTransport`). The host (`onGenerate`) stays an in-memory fixture, mirroring
// the rest of this DB-free package (`rate-limit.test.ts`) — a real PGlite/Postgres `Transactor` is
// the deploying host's job, not this package's.
import { afterEach, describe, expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { AuthnError } from "@caisson-sh/kernel";
import { loadRegistryIndex } from "@caisson-sh/registry-schema";
import {
  createStdioMcpServer,
  runStdioServer,
  type StdioServerDeps,
} from "./stdio.ts";

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
            description: "Fixture module for the stdio transport test.",
          },
          publishedAt: "2026-06-27T00:00:00.000Z",
          gateAttestation: "ci-fixture@0000000",
        },
      ],
    },
  ],
});

const TOKEN = "mcp_tok_stdio_buyer_x000000000000";

function deps(): StdioServerDeps {
  return {
    mcp: {
      tokens: [
        {
          token: TOKEN,
          accountId: "acct_stdio",
        },
      ],
      index,
      onGenerate: () => Promise.resolve({ generationId: "gen_stdio_1" }),
    },
    bearer: TOKEN,
  };
}

let client: Client | undefined;

afterEach(async () => {
  await client?.close();
  client = undefined;
});

describe("stdio transport binding", () => {
  test("auth gates an unauthenticated call: a bad bearer never reaches a transport", () => {
    // No `Server` is constructed and no transport connects on a bad token — every tool a valid
    // client could call is unreachable, not just the first one (see stdio.ts file header).
    expect(() =>
      createStdioMcpServer({ ...deps(), bearer: "not-a-real-token" }),
    ).toThrow(AuthnError);
  });

  test("a valid bearer: list_tools + tools/call round-trip through the real transport", async () => {
    const server = createStdioMcpServer(deps());
    const [serverTransport, clientTransport] =
      InMemoryTransport.createLinkedPair();
    client = new Client({ name: "stdio-test-client", version: "0.0.0" });

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    const tools = await client.listTools();
    expect(tools.tools.map((t) => t.name)).toEqual([
      "describe_module",
      "generate",
      "list_modules",
    ]);
    // ADR-0216: every listed tool carries a non-empty description over this transport.
    for (const t of tools.tools) {
      expect(typeof t.description).toBe("string");
      expect((t.description ?? "").length).toBeGreaterThan(0);
    }

    const result = await client.callTool({
      name: "list_modules",
      arguments: {},
    });
    expect(result.isError).toBeFalsy();
    const content = result.content as { type: string; text: string }[];
    expect(JSON.parse(content[0]?.text ?? "{}")).toEqual({
      modules: ["@caisson-sh/auth"],
    });
  });

  test("a tool-level failure surfaces as an MCP isError result, not a thrown protocol error", async () => {
    const server = createStdioMcpServer(deps());
    const [serverTransport, clientTransport] =
      InMemoryTransport.createLinkedPair();
    client = new Client({ name: "stdio-test-client", version: "0.0.0" });

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    // @caisson-sh/billing is not in this fixture's catalog, so describe_module 404s.
    const result = await client.callTool({
      name: "describe_module",
      arguments: { name: "@caisson-sh/billing" },
    });
    expect(result.isError).toBe(true);
    const content = result.content as { type: string; text: string }[];
    expect(JSON.parse(content[0]?.text ?? "{}")).toMatchObject({
      error: { code: "not_found" },
    });
  });

  test("capabilities advertise resources, and resources/list + read round-trip", async () => {
    const server = createStdioMcpServer(deps());
    const [serverTransport, clientTransport] =
      InMemoryTransport.createLinkedPair();
    client = new Client({ name: "stdio-test-client", version: "0.0.0" });

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    // (v) the server advertises the resources capability over this transport.
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

    // A read on an unknown URI surfaces as a rejected JSON-RPC error (the mapped not-found).
    await expect(
      client.readResource({ uri: "caisson://nope/missing" }),
    ).rejects.toThrow();
  });

  test("capabilities advertise prompts, and prompts/list + get round-trip", async () => {
    const server = createStdioMcpServer(deps());
    const [serverTransport, clientTransport] =
      InMemoryTransport.createLinkedPair();
    client = new Client({ name: "stdio-test-client", version: "0.0.0" });

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    expect(client.getServerCapabilities()?.prompts).toBeDefined();

    const list = await client.listPrompts();
    expect(list.prompts.map((p) => p.name)).toContain("integrate_module");

    const got = await client.getPrompt({
      name: "integrate_module",
      arguments: { module_id: "@caisson-sh/auth" },
    });
    expect(got.messages).toHaveLength(1);
    const msg = got.messages[0];
    expect(msg?.content.type).toBe("text");
    expect((msg!.content as { text: string }).text).toContain(
      "@caisson-sh/auth",
    );

    // An unknown prompt surfaces as a rejected JSON-RPC error (the mapped not-found).
    await expect(
      client.getPrompt({ name: "nope_missing", arguments: {} }),
    ).rejects.toThrow();
  });

  test("runStdioServer connects the bound server to an injected transport and returns it", async () => {
    const [serverTransport, clientTransport] =
      InMemoryTransport.createLinkedPair();
    client = new Client({ name: "stdio-test-client", version: "0.0.0" });

    const [server] = await Promise.all([
      runStdioServer(deps(), serverTransport),
      client.connect(clientTransport),
    ]);

    expect(server.transport).toBeDefined();
    const tools = await client.listTools();
    expect(tools.tools.length).toBeGreaterThan(0);
  });
});
