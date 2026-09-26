// `caisson run start` — the thin MCP client end-to-end (ADR-0360 S5, mirrors `doctor.test.ts`): it
// calls the REAL MCP `run_start` tool over an in-memory transport. A server wired with the run
// tools returns the loop result; a server without them answers the seam's 404, surfaced as a clear
// error.
import { describe, expect, test } from "bun:test";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { loadRegistryIndex } from "@caisson/registry-schema";
import { createStdioMcpServer } from "@caisson/mcp-server";
import { runStartClient } from "./run.ts";

const INDEX = loadRegistryIndex({ schemaVersion: 1, modules: [] });
const TOKEN = "tok_cli_run_start_".padEnd(40, "0");

function buildServer(captured: unknown[], withRunTools = true) {
  return createStdioMcpServer({
    mcp: {
      tokens: [{ token: TOKEN, accountId: "acct" }],
      index: INDEX,
      onGenerate: async () => ({ generationId: "g" }),
      ...(withRunTools
        ? {
            runTools: {
              runStart: async (ctx: { args: unknown }) => {
                captured.push(ctx.args);
                return { runId: "run-42", status: "completed", text: "done" };
              },
              runStatus: async () => ({ status: "unused-in-this-test" }),
            },
          }
        : {}),
    },
    bearer: TOKEN,
  });
}

describe("caisson run start — thin client of the MCP server (ADR-0360 S5)", () => {
  test("a server with the run tools returns the governed run result", async () => {
    const captured: unknown[] = [];
    const server = buildServer(captured);
    const [serverTransport, clientTransport] =
      InMemoryTransport.createLinkedPair();
    const [, result] = await Promise.all([
      server.connect(serverTransport),
      runStartClient({ transport: clientTransport, prompt: "book a flight" }),
    ]);
    expect(result).toMatchObject({ runId: "run-42", status: "completed" });
    expect(captured).toEqual([{ prompt: "book a flight" }]);
  });

  test("a server without run_start is a clear error (404 surfaced)", async () => {
    const server = buildServer([], false);
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
