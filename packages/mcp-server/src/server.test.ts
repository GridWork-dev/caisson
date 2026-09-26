// Proves (ADR-0008) that the MCP server authenticates every caller with a timing-safe Bearer
// compare, answers an authed query, and gates the `generate` write on the REGISTRY INDEX (id AND
// version, the same gate the CLI runs) before delegating generation to the host via `onGenerate`.
import { describe, expect, test } from "bun:test";
import { AuthnError, NotFoundError, ValidationError } from "@caisson-sh/kernel";
import { loadRegistryIndex } from "@caisson-sh/registry-schema";
import {
  createMcpServer,
  type GenerateContext,
  type McpSession,
} from "./index.ts";

// --- A synthetic but VALID built registry index (ADR-0047); every {id, version} the generate path
// sees is validated against this. ---
function catalogModule(id: string) {
  return {
    id,
    latest: "0.1.0",
    versions: [
      {
        version: "0.1.0",
        manifest: {
          id,
          version: "0.1.0",
          license: "Apache-2.0",
          description: `Fixture module ${id}.`,
        },
        publishedAt: "2026-06-27T00:00:00.000Z",
        gateAttestation: "ci-fixture@0000000",
      },
    ],
  };
}

const index = loadRegistryIndex({
  schemaVersion: 1,
  modules: [
    catalogModule("@caisson-sh/auth"),
    catalogModule("@caisson-sh/billing"),
    catalogModule("@caisson-sh/kernel"),
  ],
});

const calls: GenerateContext[] = [];
const server = createMcpServer({
  tokens: [
    { token: "tok_acct_a_000000000000000000000000", accountId: "acct_a" },
  ],
  index,
  onGenerate: async (ctx) => {
    calls.push(ctx);
    return { generationId: "gen_1" };
  },
});

const session = server.authenticate("tok_acct_a_000000000000000000000000");

describe("MCP server", () => {
  test("authenticates a valid token and rejects a wrong or missing one (timing-safe)", () => {
    expect(session.accountId).toBe("acct_a");
    expect(() => server.authenticate("wrong-token")).toThrow(AuthnError);
    expect(() => server.authenticate("")).toThrow(AuthnError);
  });

  test("list_modules lists the registry catalog", async () => {
    expect(await server.handleToolCall(session, "list_modules", {})).toEqual({
      modules: [
        "@caisson-sh/auth",
        "@caisson-sh/billing",
        "@caisson-sh/kernel",
      ],
    });
  });

  test("describe_module describes a catalog module and 404s an unknown one", async () => {
    expect(
      await server.handleToolCall(session, "describe_module", {
        name: "@caisson-sh/auth",
      }),
    ).toEqual({
      name: "@caisson-sh/auth",
      latest: "0.1.0",
      summary: "Fixture module @caisson-sh/auth.",
    });
    await expect(
      server.handleToolCall(session, "describe_module", {
        name: "@caisson-sh/gateway",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  test("generate runs for an indexed selection — host hook fires with the converged ctx", async () => {
    const out = await server.handleToolCall(session, "generate", {
      projectName: "my-app",
      modules: [
        { id: "@caisson-sh/kernel", version: "0.1.0" },
        { id: "@caisson-sh/auth", version: "0.1.0" },
      ],
    });
    expect(out).toEqual({ generationId: "gen_1" });
    expect(calls.at(-1)).toEqual({
      accountId: "acct_a",
      selection: {
        projectName: "my-app",
        modules: [
          { id: "@caisson-sh/kernel", version: "0.1.0" },
          { id: "@caisson-sh/auth", version: "0.1.0" },
        ],
      },
    });
  });

  test("generate rejects an unknown module id BEFORE any host call (anti-injection)", async () => {
    const before = calls.length;
    await expect(
      server.handleToolCall(session, "generate", {
        projectName: "my-app",
        modules: [{ id: "../../etc/passwd", version: "0.1.0" }],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(calls.length).toBe(before); // no side effect reached
  });

  test("generate rejects an unknown VERSION of a known module BEFORE any host call", async () => {
    const before = calls.length;
    await expect(
      server.handleToolCall(session, "generate", {
        projectName: "my-app",
        modules: [{ id: "@caisson-sh/auth", version: "9.9.9" }],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(calls.length).toBe(before);
  });

  test("generate rejects retired and unknown fields at the boundary (strict)", async () => {
    for (const extra of [
      { edition: "compliance" },
      { idempotencyKey: "11111111-1111-4111-8111-111111111111" },
      { smuggled: "x" },
    ]) {
      await expect(
        server.handleToolCall(session, "generate", {
          projectName: "my-app",
          modules: [{ id: "@caisson-sh/auth", version: "0.1.0" }],
          ...extra,
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    }
  });

  test("generate rejects an over-cap modules array O(1) BEFORE parsing any element (DoS b719aff8)", async () => {
    const before = calls.length;
    // 200k entries, each shaped so Zod's element schema would ALSO reject it (empty id/version).
    // The raw-length pre-guard runs first, so the failure carries the guard's own `details.max`,
    // NOT `parseStrict`'s per-element `{ issues }` — proving the O(N) element parse (which would
    // block the shared event loop, ~168ms at 500k) never runs. `.max()` alone does not short-circuit:
    // zod parses every element before the cap check fires, so the O(1) guard is what closes the DoS.
    let err: unknown;
    try {
      await server.handleToolCall(session, "generate", {
        projectName: "my-app",
        modules: Array.from({ length: 200_000 }, () => ({
          id: "",
          version: "",
        })),
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).details).toEqual({ max: 100 });
    expect(calls.length).toBe(before); // no host call reached
  });

  test("generate rejects an over-length module id at the boundary BEFORE any host/registry work", async () => {
    const before = calls.length;
    await expect(
      server.handleToolCall(session, "generate", {
        projectName: "my-app",
        modules: [{ id: `@caisson-sh/${"a".repeat(200)}`, version: "0.1.0" }],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(calls.length).toBe(before);
  });

  test("an unknown tool is a 404", async () => {
    await expect(
      server.handleToolCall(session, "rm_rf", {}),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  test("listTools entries carry a non-empty description (ADR-0216)", () => {
    const tools = server.listTools(session);
    expect(tools.length).toBeGreaterThan(0);
    for (const reg of tools) {
      expect(reg.description.length).toBeGreaterThan(0);
    }
  });
});

describe("ADR-0216 tool manifest validation (registerTool)", () => {
  function freshServer() {
    return createMcpServer({
      tokens: [{ token: "tok_manifest_x00000000000000000000", accountId: "a" }],
      index,
      onGenerate: async () => ({ generationId: "gen_manifest" }),
    });
  }

  test("a manifest with an empty description is rejected at registration time", () => {
    expect(() =>
      freshServer().registerTool({
        name: "bad_tool",
        description: "",
        version: "1.0.0",
        audit: { logArgs: true },
        handler: async () => ({}),
      }),
    ).toThrow(ValidationError);
  });

  test("a manifest with a non-semver version is rejected at registration time", () => {
    expect(() =>
      freshServer().registerTool({
        name: "bad_tool",
        description: "A tool.",
        version: "v1",
        audit: { logArgs: true },
        handler: async () => ({}),
      }),
    ).toThrow(ValidationError);
  });

  test("a manifest with an unknown audit field is rejected (strict)", () => {
    expect(() =>
      freshServer().registerTool({
        name: "bad_tool",
        description: "A tool.",
        version: "1.0.0",
        // @ts-expect-error — smuggled extra key, proving the strict schema rejects it at runtime.
        audit: { logArgs: true, extra: true },
        handler: async () => ({}),
      }),
    ).toThrow(ValidationError);
  });
});

describe("ADR-0076 tool-registration seam", () => {
  // Fresh server so registrations don't bleed across the suite.
  const ed = createMcpServer({
    tokens: [
      { token: "tok_acct_a_000000000000000000000000", accountId: "acct_a" },
      { token: "tok_acct_b_111111111111111111111111", accountId: "acct_b" },
    ],
    index,
    onGenerate: async () => ({ generationId: "gen_x" }),
  });

  const evalCalls: McpSession[] = [];
  ed.registerTool({
    name: "run_eval",
    description: "Run an eval suite (fixture tool).",
    version: "1.0.0",
    audit: { logArgs: true },
    handler: async ({ session: s }) => {
      evalCalls.push(s);
      return { ran: true };
    },
  });

  const callerA = ed.authenticate("tok_acct_a_000000000000000000000000");
  const callerB = ed.authenticate("tok_acct_b_111111111111111111111111");

  test("registering a duplicate tool name is rejected (fail-closed)", () => {
    expect(() =>
      ed.registerTool({
        name: "list_modules",
        description: "Duplicate fixture.",
        version: "1.0.0",
        audit: { logArgs: true },
        handler: async () => ({}),
      }),
    ).toThrow(ValidationError);
  });

  test("a registered tool is listed for every authenticated caller", () => {
    for (const caller of [callerA, callerB]) {
      expect(ed.listTools(caller).map((reg) => reg.name)).toEqual([
        "describe_module",
        "generate",
        "list_modules",
        "run_eval",
      ]);
    }
  });

  test("a registered tool runs with the calling session", async () => {
    expect(await ed.handleToolCall(callerB, "run_eval", {})).toEqual({
      ran: true,
    });
    expect(evalCalls.at(-1)?.accountId).toBe("acct_b");
  });
});

// --- Prompts: the prompt-side mirror of the tool/resource registries. Drives
//     registerPrompt/listPrompts/getPrompt directly (no transport). ---
describe("prompt registry (registerPrompt / listPrompts / getPrompt)", () => {
  test("integrate_module is a base prompt visible to every authenticated caller", () => {
    expect(server.listPrompts(session).map((p) => p.name)).toContain(
      "integrate_module",
    );
  });

  test("integrate_module renders a describe_module -> generate recipe for a known module", async () => {
    const out = await server.getPrompt(session, "integrate_module", {
      module_id: "@caisson-sh/auth",
      project_name: "shop",
    });
    expect(out.messages).toHaveLength(1);
    const text = out.messages[0]?.content.text ?? "";
    expect(text).toContain("describe_module");
    expect(text).toContain("generate");
    expect(text).toContain("@caisson-sh/auth");
    expect(text).toContain("shop");
    // The recipe pins the CONCRETE latest from the index — the literal "latest" is a pointer
    // the generate gate (assertKnownVersion) rejects with a 400.
    expect(text).toContain('"version": "0.1.0"');
    expect(text).not.toContain('"version": "latest"');
  });

  test("integrate_module rejects a module the registry does not know (400, never recommends it)", async () => {
    await expect(
      server.getPrompt(session, "integrate_module", {
        module_id: "@caisson-sh/does-not-exist",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  test("an unknown prompt name is a NotFoundError", async () => {
    await expect(
      server.getPrompt(session, "no_such_prompt", {}),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  test("a duplicate prompt name is a fail-closed ValidationError", () => {
    expect(() =>
      server.registerPrompt({
        name: "integrate_module",
        description: "Colliding prompt.",
        version: "1.0.0",
        arguments: [],
        handler: async () => ({
          messages: [{ role: "user", content: { type: "text", text: "x" } }],
        }),
      }),
    ).toThrow(ValidationError);
  });

  test("a malformed manifest is rejected at registration time", () => {
    expect(() =>
      server.registerPrompt({
        name: "Bad-Name",
        description: "Bad prompt name.",
        version: "1.0.0",
        arguments: [],
        handler: async () => ({
          messages: [{ role: "user", content: { type: "text", text: "x" } }],
        }),
      }),
    ).toThrow(ValidationError);
    expect(() =>
      server.registerPrompt({
        name: "ok_name",
        description: "Bad version.",
        version: "not-semver",
        arguments: [],
        handler: async () => ({
          messages: [{ role: "user", content: { type: "text", text: "x" } }],
        }),
      }),
    ).toThrow(ValidationError);
  });

  test("getPrompt strict-validates args: missing-required and unknown-extra both rejected", async () => {
    // integrate_module requires module_id; omit it.
    await expect(
      server.getPrompt(session, "integrate_module", { project_name: "x" }),
    ).rejects.toBeInstanceOf(ValidationError);
    // an undeclared extra key is rejected (strict).
    await expect(
      server.getPrompt(session, "integrate_module", {
        module_id: "@caisson-sh/auth",
        bogus: "y",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    // args are length-bounded at the boundary like every tool arg (max 512).
    await expect(
      server.getPrompt(session, "integrate_module", {
        module_id: "@caisson-sh/auth",
        project_name: "x".repeat(513),
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("token length is enforced at construction", () => {
  const build = (token: string) => () =>
    createMcpServer({
      tokens: [
        { token: "tok_ok_".padEnd(40, "0"), accountId: "acct_ok" },
        { token, accountId: "acct_weak" },
      ],
      index,
      onGenerate: async () => ({ generationId: "gen" }),
    });

  test("an empty token is refused, naming the account and never the token", () => {
    expect(build("")).toThrow(ValidationError);
    expect(build("")).toThrow(/acct_weak.*empty.*at least 32/);
  });

  test("a 31-character token is refused; 32 characters is accepted", () => {
    const short = "s".repeat(31);
    expect(build(short)).toThrow(ValidationError);
    let message = "";
    try {
      build(short)();
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/acct_weak.*31 characters/);
    expect(message).not.toContain(short);
    expect(build("s".repeat(32))).not.toThrow();
  });
});
