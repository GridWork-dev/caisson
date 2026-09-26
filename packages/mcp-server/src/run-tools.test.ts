// Exit-gate proof for the agent-runtime MCP tools (ADR-0360 S5, ADR-0361/0362). Mirrors
// `manifest-tools`/`coach`'s own test shape: register through `createMcpServer` with FAKE injected
// `runStart`/`runStatus` callbacks (the real ai-kit-backed wiring is proven end-to-end by the
// parent-demo test, not duplicated here), drive the seam over an in-memory transport.
import { describe, expect, test } from "bun:test";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { loadRegistryIndex } from "@caisson-sh/registry-schema";
import { createStdioMcpServer } from "./stdio.ts";

const INDEX = loadRegistryIndex({ schemaVersion: 1, modules: [] });
const TOKEN = "tok_mcp_run_tools_".padEnd(40, "0");

interface RunToolsHarness {
  readonly client: Client;
  readonly started: unknown[];
  readonly statused: unknown[];
}

async function withRunToolsServer(
  fn: (h: RunToolsHarness) => Promise<void>,
): Promise<void> {
  const started: unknown[] = [];
  const statused: unknown[] = [];
  const server = createStdioMcpServer({
    mcp: {
      tokens: [{ token: TOKEN, accountId: "acct-1" }],
      index: INDEX,
      onGenerate: async () => ({ generationId: "g" }),
      runTools: {
        runStart: async (ctx) => {
          started.push(ctx.args);
          return { runId: "run-1", status: "parked", toolCallId: "call-1" };
        },
        runStatus: async (ctx) => {
          statused.push(ctx.args);
          return {
            runState: { status: "parked" },
            projection: { status: "running" },
          };
        },
      },
    },
    bearer: TOKEN,
  });
  const [serverTransport, clientTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  try {
    await fn({ client, started, statused });
  } finally {
    await client.close();
  }
}

function textOf(result: {
  content?: { type: string; text: string }[];
}): unknown {
  return JSON.parse(result.content?.[0]?.text ?? "{}");
}

describe("run_start/run_status — the agent-runtime MCP tools (ADR-0360 S5)", () => {
  test("an authenticated caller can call run_start; the injected host callback receives the validated args", async () => {
    await withRunToolsServer(async ({ client, started }) => {
      const result = await client.callTool({
        name: "run_start",
        arguments: { prompt: "book a flight" },
      });
      expect(result.isError).toBeUndefined();
      expect(textOf(result as never)).toMatchObject({
        runId: "run-1",
        status: "parked",
      });
      expect(started).toEqual([{ prompt: "book a flight" }]);
    });
  });

  test("an authenticated caller can call run_status; the injected host callback receives the validated args", async () => {
    await withRunToolsServer(async ({ client, statused }) => {
      const result = await client.callTool({
        name: "run_status",
        arguments: { runId: "run-1" },
      });
      expect(result.isError).toBeUndefined();
      expect(textOf(result as never)).toMatchObject({
        runState: { status: "parked" },
        projection: { status: "running" },
      });
      expect(statused).toEqual([{ runId: "run-1" }]);
    });
  });

  test("run_start rejects a malformed arg shape before the host callback ever runs", async () => {
    await withRunToolsServer(async ({ client, started }) => {
      const result = await client.callTool({
        name: "run_start",
        arguments: { prompt: "" },
      });
      expect(result.isError).toBe(true);
      expect(started).toHaveLength(0);
    });
  });

  test("neither tool exists at all when runTools is omitted (fail-closed by construction)", async () => {
    const server = createStdioMcpServer({
      mcp: {
        tokens: [
          {
            token: TOKEN,
            accountId: "acct-1",
          },
        ],
        index: INDEX,
        onGenerate: async () => ({ generationId: "g" }),
      },
      bearer: TOKEN,
    });
    const [serverTransport, clientTransport] =
      InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test-client", version: "1.0.0" });
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
    try {
      const result = await client.callTool({
        name: "run_start",
        arguments: { prompt: "book a flight" },
      });
      expect(result.isError).toBe(true);
    } finally {
      await client.close();
    }
  });
});
