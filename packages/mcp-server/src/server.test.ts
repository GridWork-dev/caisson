// P1 exit-gate proof (ADR-0008): the buyer MCP answers an authed query and gates the generation
// write on the registry allowlist + entitlement + a credit hook.
import { describe, expect, test } from "bun:test";
import {
  AuthnError,
  EntitlementError,
  NotFoundError,
  ValidationError,
} from "@caisson/kernel";
import { createMcpServer, type GenerateContext } from "./index.ts";

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
