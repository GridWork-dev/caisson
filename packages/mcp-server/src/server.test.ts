// P1 exit-gate proof (ADR-0008): the buyer MCP answers an authed query and gates the generation
// write on the registry allowlist + entitlement + a credit hook.
import { describe, expect, test } from "bun:test";
import {
  AuthnError,
  EntitlementError,
  NotFoundError,
  ValidationError,
} from "@caisson/kernel";
import {
  createMcpServer,
  type GenerateContext,
  type McpSession,
} from "./index.ts";

const calls: GenerateContext[] = [];
const server = createMcpServer({
  tokens: [
    {
      token: "tok_acct_a_000000000000",
      accountId: "acct_a",
      entitlements: ["compliance", "auth", "billing"],
    },
  ],
  registryAllowlist: ["compliance", "auth", "billing", "ai-kit"],
  onGenerate: async (ctx) => {
    calls.push(ctx);
    return { generationId: "gen_1" };
  },
});

const session = server.authenticate("tok_acct_a_000000000000");

describe("buyer MCP server", () => {
  test("authenticates a valid token and rejects a bad one (timing-safe)", () => {
    expect(session.accountId).toBe("acct_a");
    expect(() => server.authenticate("wrong-token")).toThrow(AuthnError);
  });

  test("answers an authed read scoped to entitlements", async () => {
    expect(await server.handleToolCall(session, "list_modules", {})).toEqual({
      modules: ["auth", "billing", "compliance"],
    });
  });

  test("describe_module is entitlement-gated", async () => {
    expect(
      await server.handleToolCall(session, "describe_module", { name: "auth" }),
    ).toMatchObject({
      name: "auth",
    });
    await expect(
      server.handleToolCall(session, "describe_module", { name: "ai-kit" }),
    ).rejects.toBeInstanceOf(EntitlementError);
  });

  test("generate runs for an allowlisted, entitled selection (credit hook fires)", async () => {
    const out = await server.handleToolCall(session, "generate", {
      edition: "compliance",
      modules: ["auth"],
    });
    expect(out).toEqual({ generationId: "gen_1" });
    expect(calls.at(-1)).toEqual({
      accountId: "acct_a",
      edition: "compliance",
      modules: ["auth"],
    });
  });

  test("generate rejects names outside the registry allowlist (anti-injection)", async () => {
    await expect(
      server.handleToolCall(session, "generate", {
        edition: "compliance",
        modules: ["../../etc/passwd"],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  test("generate rejects an allowlisted-but-unentitled edition", async () => {
    await expect(
      server.handleToolCall(session, "generate", {
        edition: "ai-kit",
        modules: [],
      }),
    ).rejects.toBeInstanceOf(EntitlementError);
  });

  test("an unknown tool is a 404", async () => {
    await expect(
      server.handleToolCall(session, "rm_rf", {}),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("ADR-0076 tool-registration seam (per-tool entitlement gating)", () => {
  // Fresh server so registrations don't bleed across the suite. acct_a owns the base modules
  // but NOT the "ai-kit" edition; acct_b owns "ai-kit".
  const ed = createMcpServer({
    tokens: [
      {
        token: "tok_acct_a_000000000000",
        accountId: "acct_a",
        entitlements: ["compliance", "auth", "billing"],
      },
      {
        token: "tok_acct_b_111111111111",
        accountId: "acct_b",
        entitlements: ["ai-kit"],
      },
    ],
    registryAllowlist: ["compliance", "auth", "billing", "ai-kit"],
    onGenerate: async () => ({ generationId: "gen_x" }),
  });

  const evalCalls: McpSession[] = [];
  ed.registerTool({
    name: "run_eval",
    requiredEntitlement: "ai-kit",
    handler: async ({ session: s }) => {
      evalCalls.push(s);
      return { ran: true };
    },
  });

  const nonEntitled = ed.authenticate("tok_acct_a_000000000000");
  const entitled = ed.authenticate("tok_acct_b_111111111111");

  test("registering a duplicate tool name is rejected (fail-closed)", () => {
    expect(() =>
      ed.registerTool({
        name: "list_modules",
        requiredEntitlement: null,
        handler: async () => ({}),
      }),
    ).toThrow(ValidationError);
  });

  test("edition tool is hidden from a non-entitled caller's tool list", () => {
    const tools = ed.listTools(nonEntitled);
    expect(tools).toEqual(["describe_module", "generate", "list_modules"]);
    expect(tools).not.toContain("run_eval");
  });

  test("edition tool is invisible (404, not 403) to a non-entitled caller", async () => {
    await expect(
      ed.handleToolCall(nonEntitled, "run_eval", {}),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(evalCalls).toHaveLength(0);
  });

  test("edition tool is visible + callable for an entitled caller", async () => {
    expect(ed.listTools(entitled)).toContain("run_eval");
    expect(await ed.handleToolCall(entitled, "run_eval", {})).toEqual({
      ran: true,
    });
    expect(evalCalls.at(-1)?.accountId).toBe("acct_b");
  });

  test("base tools still work through the seam for every authed caller", async () => {
    expect(await ed.handleToolCall(nonEntitled, "list_modules", {})).toEqual({
      modules: ["auth", "billing", "compliance"],
    });
    expect(await ed.handleToolCall(entitled, "list_modules", {})).toEqual({
      modules: ["ai-kit"],
    });
  });
});
