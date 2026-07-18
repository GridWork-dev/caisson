// `caisson run start` — the thin MCP client end-to-end (ADR-0360 S5, mirrors `doctor.test.ts`): it
// calls the REAL buyer MCP `run_start` tool over an in-memory transport. An entitled buyer (the
// dedicated agent-trajectory slug, ADR-0362) gets the loop result; an unentitled buyer hits the
// seam's invisible 404, surfaced as a clear error.
import { describe, expect, test } from "bun:test";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { loadRegistryIndex } from "@caisson/registry-schema";
import {
  createStdioMcpServer,
  DEFAULT_RUN_ENTITLEMENT,
} from "@caisson/mcp-server";
import { runStartClient } from "./run.ts";

const INDEX = loadRegistryIndex({ schemaVersion: 1, modules: [] });
const TOKEN = "tok_cli_run_start_".padEnd(40, "0");

function buildServer(entitlements: string[], captured: unknown[]) {
  return createStdioMcpServer({
    mcp: {
      tokens: [{ token: TOKEN, accountId: "acct", entitlements }],
      index: INDEX,
      onGenerate: async () => ({ generationId: "g" }),
      runTools: {
        runStart: async (ctx) => {
          captured.push(ctx.args);
          return { runId: "run-42", status: "completed", text: "done" };
        },
        runStatus: async () => ({ status: "unused-in-this-test" }),
      },
    },
    bearer: TOKEN,
  });
}

describe("caisson run start — thin client of the buyer MCP (ADR-0360 S5)", () => {
  test("an entitled buyer gets the governed run result", async () => {
    const captured: unknown[] = [];
    const server = buildServer([DEFAULT_RUN_ENTITLEMENT], captured);
    const [serverTransport, clientTransport] =
      InMemoryTransport.createLinkedPair();
    const [, result] = await Promise.all([
      server.connect(serverTransport),
      runStartClient({ transport: clientTransport, prompt: "book a flight" }),
    ]);
    expect(result).toMatchObject({ runId: "run-42", status: "completed" });
    expect(captured).toEqual([{ prompt: "book a flight" }]);
  });

  test("an unentitled buyer is denied (invisible 404 surfaced as an error)", async () => {
    const server = buildServer([], []);
    const [serverTransport, clientTransport] =
      InMemoryTransport.createLinkedPair();
    await expect(
      Promise.all([
        server.connect(serverTransport),
        runStartClient({ transport: clientTransport, prompt: "book a flight" }),
      ]),
    ).rejects.toThrow(/not_found/);
  });
});
