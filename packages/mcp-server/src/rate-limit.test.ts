// ADR-0112: the MCP server awaits the optional `checkRateLimit` PORT before EVERY tool dispatch.
// Proves: a denied hook (throws RateLimitError) blocks the tool and the handler never runs; the
// hook fires once per call across base AND registered tools; and an ABSENT hook runs unthrottled
// (the default backward-compatible contract). The store-backed fail-OPEN behaviour belongs to the
// host's hook implementation (this package is DB-free — it only declares + awaits the seam).
import { describe, expect, test } from "bun:test";
import { NotFoundError, RateLimitError } from "@caisson/kernel";
import { loadRegistryIndex } from "@caisson/registry-schema";
import {
  createMcpServer,
  type McpServerOptions,
  type RateLimitHook,
} from "./index.ts";

// A minimal but VALID built index — one base module is enough; these tests never call `generate`.
const index = loadRegistryIndex({
  schemaVersion: 1,
  modules: [
    {
      id: "@caisson/auth",
      latest: "0.1.0",
      versions: [
        {
          version: "0.1.0",
          manifest: {
            id: "@caisson/auth",
            version: "0.1.0",
            license: "Apache-2.0",
            description: "Fixture module.",
          },
          publishedAt: "2026-06-27T00:00:00.000Z",
          gateAttestation: "ci-fixture@0000000",
        },
      ],
    },
  ],
});

const TOKEN = "tok_acct_a_000000000000000000000000";
function baseOptions(): McpServerOptions {
  return {
    tokens: [{ token: TOKEN, accountId: "acct_a" }],
    index,
    onGenerate: async () => ({ generationId: "gen_1" }),
  };
}

describe("ADR-0112 rate-limit hook (mcp-server seam)", () => {
  test("an absent hook runs unthrottled (the default backward-compatible contract)", async () => {
    const server = createMcpServer(baseOptions());
    const session = server.authenticate(TOKEN);
    // Many calls, no hook → every one runs.
    for (let i = 0; i < 5; i++) {
      expect(await server.handleToolCall(session, "list_modules", {})).toEqual({
        modules: ["@caisson/auth"],
      });
    }
  });

  test("a denied hook blocks the tool with RateLimitError — the handler never runs", async () => {
    let handlerRuns = 0;
    const hook: RateLimitHook = async () => {
      throw new RateLimitError("over limit", { retryAfterMs: 1234 });
    };
    const server = createMcpServer({ ...baseOptions(), checkRateLimit: hook });
    // A registered base tool whose handler increments a counter — to prove it is never reached.
    server.registerTool({
      name: "probe",
      description: "Rate-limit probe fixture.",
      version: "1.0.0",
      audit: { logArgs: true },
      handler: async () => {
        handlerRuns += 1;
        return { ok: true };
      },
    });
    const session = server.authenticate(TOKEN);
    await expect(
      server.handleToolCall(session, "probe", {}),
    ).rejects.toBeInstanceOf(RateLimitError);
    expect(handlerRuns).toBe(0); // gated BEFORE dispatch
  });

  test("the hook fires exactly once per call, across base and registered tools", async () => {
    const seen: string[] = [];
    const hook: RateLimitHook = async (accountId) => {
      seen.push(accountId);
    };
    const server = createMcpServer({ ...baseOptions(), checkRateLimit: hook });
    server.registerTool({
      name: "kit_tool",
      description: "Rate-limit registered-tool fixture.",
      version: "1.0.0",
      audit: { logArgs: true },
      handler: async () => ({ ok: true }),
    });
    const session = server.authenticate(TOKEN);
    await server.handleToolCall(session, "list_modules", {});
    await server.handleToolCall(session, "describe_module", {
      name: "@caisson/auth",
    });
    await server.handleToolCall(session, "kit_tool", {});
    expect(seen).toEqual(["acct_a", "acct_a", "acct_a"]);
  });

  test("getPrompt awaits the hook once, AFTER the 404 (a not-found prompt burns no throttle)", async () => {
    const seen: string[] = [];
    const hook: RateLimitHook = async (accountId) => {
      seen.push(accountId);
    };
    const server = createMcpServer({ ...baseOptions(), checkRateLimit: hook });
    const session = server.authenticate(TOKEN);
    // A known base module → integrate_module resolves and the hook fires exactly once.
    await server.getPrompt(session, "integrate_module", {
      module_id: "@caisson/auth",
    });
    expect(seen).toEqual(["acct_a"]);
    // An unknown prompt is a 404 BEFORE the hook — no throttle consumed.
    await expect(
      server.getPrompt(session, "no_such_prompt", {}),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(seen).toEqual(["acct_a"]);
  });

  test("an unknown tool is still a 404 — the hook does not mask the not-found path", async () => {
    let hookCalls = 0;
    const hook: RateLimitHook = async () => {
      hookCalls += 1;
    };
    const server = createMcpServer({ ...baseOptions(), checkRateLimit: hook });
    const session = server.authenticate(TOKEN);
    await expect(
      server.handleToolCall(session, "does_not_exist", {}),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(hookCalls).toBe(0); // no dispatch ⇒ no throttle consumed
  });
});
