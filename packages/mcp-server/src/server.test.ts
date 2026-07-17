// Proves (ADR-0008) that the buyer MCP answers an authed query and gates the `generate` write on
// the REGISTRY INDEX (id AND version, the same gate the CLI runs), an ADR-0071 entitlement
// EXPANSION (editions/bundle → member slugs), and a minted-or-reused idempotency key — then
// delegates the debit + generation to the host via `onGenerate`.
import { describe, expect, test } from "bun:test";
import {
  AuthnError,
  EntitlementError,
  NotFoundError,
  ValidationError,
} from "@caisson/kernel";
import { loadRegistryIndex } from "@caisson/registry-schema";
import {
  createMcpServer,
  type GenerateContext,
  type McpSession,
} from "./index.ts";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// --- A synthetic but VALID built registry index (ADR-0047): base modules + a compliance edition
// (with an edition-scoped member) + an ai-kit edition (with a member). Editions resolve through
// `expandEntitlements`; every {id, version} the generate path sees is validated against this. ---
function baseModule(id: string, editions: string[] = []) {
  return {
    id,
    latest: "0.1.0",
    versions: [
      {
        version: "0.1.0",
        manifest: {
          id,
          version: "0.1.0",
          kind: "base",
          editions,
          tier: "paid",
          priceCents: 4900,
          license: "LicenseRef-Caisson-Commercial",
          description: `Fixture module ${id}.`,
        },
        publishedAt: "2026-06-27T00:00:00.000Z",
        gateAttestation: "ci-fixture@0000000",
      },
    ],
  };
}

function editionModule(
  id: string,
  name: string,
  members: Record<string, string>,
) {
  return {
    id,
    latest: "0.1.0",
    versions: [
      {
        version: "0.1.0",
        manifest: {
          id,
          version: "0.1.0",
          kind: "edition",
          editions: [name],
          tier: "paid",
          priceCents: 4900,
          license: "LicenseRef-Caisson-Commercial",
          members,
          description: `Fixture ${name} edition.`,
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
    baseModule("@caisson/auth"),
    baseModule("@caisson/billing"),
    baseModule("@caisson/kernel"),
    editionModule("@caisson/compliance", "compliance", {
      "@caisson/compliance": "0.1.0",
      "@caisson/evidence-pack": "0.1.0",
    }),
    baseModule("@caisson/evidence-pack", ["compliance"]),
    editionModule("@caisson/ai-kit", "ai-kit", {
      "@caisson/ai-kit": "0.1.0",
      "@caisson/gateway": "0.1.0",
    }),
    baseModule("@caisson/gateway", ["ai-kit"]),
  ],
});

const calls: GenerateContext[] = [];
const server = createMcpServer({
  tokens: [
    {
      token: "tok_acct_a_000000000000",
      accountId: "acct_a",
      // Purchases: the compliance EDITION + two à-la-carte base modules. Expanded ⇒
      // {@caisson/compliance, @caisson/evidence-pack, @caisson/auth, @caisson/billing}.
      entitlements: ["compliance", "@caisson/auth", "@caisson/billing"],
    },
  ],
  index,
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
      modules: ["@caisson/auth", "@caisson/billing", "compliance"],
    });
  });

  test("describe_module is entitlement-gated", async () => {
    expect(
      await server.handleToolCall(session, "describe_module", {
        name: "@caisson/auth",
      }),
    ).toMatchObject({ name: "@caisson/auth" });
    await expect(
      server.handleToolCall(session, "describe_module", {
        name: "@caisson/gateway",
      }),
    ).rejects.toBeInstanceOf(EntitlementError);
  });

  test("generate runs for an indexed, entitled selection — host hook fires with the converged ctx", async () => {
    const out = await server.handleToolCall(session, "generate", {
      projectName: "my-app",
      edition: "compliance",
      modules: [
        { id: "@caisson/compliance", version: "0.1.0" },
        { id: "@caisson/auth", version: "0.1.0" },
      ],
    });
    expect(out).toEqual({ generationId: "gen_1" });
    const ctx = calls.at(-1);
    expect(ctx?.accountId).toBe("acct_a");
    expect(ctx?.selection).toEqual({
      projectName: "my-app",
      edition: "compliance",
      modules: [
        { id: "@caisson/compliance", version: "0.1.0" },
        { id: "@caisson/auth", version: "0.1.0" },
      ],
    });
    // A minted key when the caller omitted one.
    expect(ctx?.idempotencyKey).toMatch(UUID_RE);
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
        modules: [{ id: "@caisson/auth", version: "9.9.9" }],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(calls.length).toBe(before);
  });

  test("generate denies an indexed module the buyer has not purchased (expanded-set gate)", async () => {
    // @caisson/gateway IS in the index (an ai-kit member) but acct_a never bought ai-kit — so it is
    // absent from the expanded entitlement set and the generation is denied before the host call.
    const before = calls.length;
    await expect(
      server.handleToolCall(session, "generate", {
        projectName: "my-app",
        modules: [{ id: "@caisson/gateway", version: "0.1.0" }],
      }),
    ).rejects.toBeInstanceOf(EntitlementError);
    expect(calls.length).toBe(before);
  });

  test("generate mints an idempotency key when omitted, reuses a caller-supplied one verbatim (T21a)", async () => {
    // Minted: two key-less calls each get a fresh UUID.
    await server.handleToolCall(session, "generate", {
      projectName: "app-1",
      modules: [{ id: "@caisson/auth", version: "0.1.0" }],
    });
    const minted1 = calls.at(-1)?.idempotencyKey;
    await server.handleToolCall(session, "generate", {
      projectName: "app-2",
      modules: [{ id: "@caisson/auth", version: "0.1.0" }],
    });
    const minted2 = calls.at(-1)?.idempotencyKey;
    expect(minted1).toMatch(UUID_RE);
    expect(minted2).toMatch(UUID_RE);
    expect(minted1).not.toBe(minted2);

    // Reused: a true retry with the SAME supplied key passes it through unchanged (so runGeneration's
    // dedup debits once). Both calls carry the identical key to the host.
    const retryKey = "11111111-1111-4111-8111-111111111111";
    await server.handleToolCall(session, "generate", {
      projectName: "app-3",
      modules: [{ id: "@caisson/auth", version: "0.1.0" }],
      idempotencyKey: retryKey,
    });
    const first = calls.at(-1)?.idempotencyKey;
    await server.handleToolCall(session, "generate", {
      projectName: "app-3",
      modules: [{ id: "@caisson/auth", version: "0.1.0" }],
      idempotencyKey: retryKey,
    });
    const second = calls.at(-1)?.idempotencyKey;
    expect(first).toBe(retryKey);
    expect(second).toBe(retryKey);
  });

  test("generate rejects a non-UUID idempotency key + unknown fields at the boundary (strict)", async () => {
    await expect(
      server.handleToolCall(session, "generate", {
        projectName: "my-app",
        modules: [{ id: "@caisson/auth", version: "0.1.0" }],
        idempotencyKey: "not-a-uuid",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      server.handleToolCall(session, "generate", {
        projectName: "my-app",
        modules: [{ id: "@caisson/auth", version: "0.1.0" }],
        edition: "compliance",
        smuggled: "x",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
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
        modules: [{ id: `@caisson/${"a".repeat(200)}`, version: "0.1.0" }],
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
      tokens: [
        {
          token: "tok_manifest_x00000000000000",
          accountId: "a",
          entitlements: [],
        },
      ],
      index,
      onGenerate: async () => ({ generationId: "gen_manifest" }),
    });
  }

  test("a manifest with an empty description is rejected at registration time", () => {
    expect(() =>
      freshServer().registerTool({
        name: "bad_tool",
        requiredEntitlement: null,
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
        requiredEntitlement: null,
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
        requiredEntitlement: null,
        description: "A tool.",
        version: "1.0.0",
        // @ts-expect-error — smuggled extra key, proving the strict schema rejects it at runtime.
        audit: { logArgs: true, extra: true },
        handler: async () => ({}),
      }),
    ).toThrow(ValidationError);
  });
});

describe("ADR-0076 tool-registration seam (per-tool entitlement gating)", () => {
  // Fresh server so registrations don't bleed across the suite. acct_a owns the base modules
  // but NOT the "ai-kit" edition; acct_b owns "ai-kit". (Neither path calls `generate`, so the raw
  // slug entitlements are only read by `list_modules` + the per-tool gate.)
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
    index,
    onGenerate: async () => ({ generationId: "gen_x" }),
  });

  const evalCalls: McpSession[] = [];
  ed.registerTool({
    name: "run_eval",
    requiredEntitlement: "ai-kit",
    description: "Run an eval suite (fixture tool).",
    version: "1.0.0",
    audit: { logArgs: true },
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
        description: "Duplicate fixture.",
        version: "1.0.0",
        audit: { logArgs: true },
        handler: async () => ({}),
      }),
    ).toThrow(ValidationError);
  });

  test("edition tool is hidden from a non-entitled caller's tool list", () => {
    const names = ed.listTools(nonEntitled).map((reg) => reg.name);
    expect(names).toEqual(["describe_module", "generate", "list_modules"]);
    expect(names).not.toContain("run_eval");
  });

  test("edition tool is invisible (404, not 403) to a non-entitled caller", async () => {
    await expect(
      ed.handleToolCall(nonEntitled, "run_eval", {}),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(evalCalls).toHaveLength(0);
  });

  test("edition tool is visible + callable for an entitled caller", async () => {
    expect(ed.listTools(entitled).map((reg) => reg.name)).toContain("run_eval");
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

describe("ADR-0257/0270 bundle vocabulary through the server gate", () => {
  // The buyer MCP consumes `expandEntitlements` — the single ADR-0257 alias point. Post
  // edition-trace purge (ADR-0270) the alias map is EMPTY: a dissolved edition id ("ai-kit")
  // resolves only as its still-indexed meta-package, never its member fold; the new bundle id
  // ("ai-production") folds members via `membersOfBundle`, and a first-class kind:"bundle" index
  // entry expands via its members map exactly like an edition.
  const bundleIndex = loadRegistryIndex({
    schemaVersion: 1,
    modules: [
      baseModule("@caisson/kernel"),
      editionModule("@caisson/ai-kit", "ai-kit", {
        "@caisson/ai-kit": "0.1.0",
        "@caisson/gateway": "0.1.0",
      }),
      baseModule("@caisson/gateway", ["ai-kit"]),
      {
        id: "@caisson/provenance",
        latest: "0.1.0",
        versions: [
          {
            version: "0.1.0",
            manifest: {
              id: "@caisson/provenance",
              version: "0.1.0",
              kind: "bundle",
              editions: [],
              tier: "paid",
              priceCents: 39900,
              license: "LicenseRef-Caisson-Commercial",
              members: { "@caisson/kernel": "0.1.0" },
              description: "Provenance bundle fixture (ADR-0257).",
            },
            publishedAt: "2026-07-06T00:00:00.000Z",
            gateAttestation: "ci-fixture@0000000",
          },
        ],
      },
    ],
  });

  const srv = createMcpServer({
    tokens: [
      {
        token: "tok_acct_l_000000000000",
        accountId: "acct_legacy",
        entitlements: ["ai-kit"], // dissolved edition id — resolves ONLY as its indexed meta (ADR-0270)
      },
      {
        token: "tok_acct_n_111111111111",
        accountId: "acct_new",
        entitlements: ["ai-production"], // the new bundle id — folds members via membersOfBundle
      },
      {
        token: "tok_acct_p_222222222222",
        accountId: "acct_prov",
        entitlements: ["provenance"], // a kind:"bundle" entry expands via its members map
      },
    ],
    index: bundleIndex,
    onGenerate: async () => ({ generationId: "gen_b" }),
  });

  test("the new bundle id folds the member set through the generate gate (ADR-0257)", async () => {
    // The generate gate is the server's `expandEntitlements` consumer (ADR-0071): "ai-production"
    // resolves @caisson/gateway through the edition-member derivation in `membersOfBundle`.
    const modern = srv.authenticate("tok_acct_n_111111111111");
    expect(
      await srv.handleToolCall(modern, "generate", {
        projectName: "my-app",
        modules: [{ id: "@caisson/gateway", version: "0.1.0" }],
      }),
    ).toEqual({ generationId: "gen_b" });
  });

  test("a dissolved edition id no longer folds members — only its indexed meta resolves (ADR-0270)", async () => {
    // Post-purge, "ai-kit" grants exactly the still-indexed @caisson/ai-kit meta-package; its
    // member fold is gone, so a member module is DENIED fail-closed. (On the real index ADR-0271
    // delists the meta too and the bare id throws — pinned in registry-schema's expansion tests.)
    const legacy = srv.authenticate("tok_acct_l_000000000000");
    expect(
      await srv.handleToolCall(legacy, "generate", {
        projectName: "my-app",
        modules: [{ id: "@caisson/ai-kit", version: "0.1.0" }],
      }),
    ).toEqual({ generationId: "gen_b" });
    await expect(
      srv.handleToolCall(legacy, "generate", {
        projectName: "my-app",
        modules: [{ id: "@caisson/gateway", version: "0.1.0" }],
      }),
    ).rejects.toBeInstanceOf(EntitlementError);
  });

  test('a kind:"bundle" entitlement expands via its members map (edition parity)', async () => {
    const prov = srv.authenticate("tok_acct_p_222222222222");
    expect(
      await srv.handleToolCall(prov, "generate", {
        projectName: "my-app",
        modules: [{ id: "@caisson/kernel", version: "0.1.0" }],
      }),
    ).toEqual({ generationId: "gen_b" });
    // gateway is NOT in the provenance members map — denied before the host call (fail-closed).
    await expect(
      srv.handleToolCall(prov, "generate", {
        projectName: "my-app",
        modules: [{ id: "@caisson/gateway", version: "0.1.0" }],
      }),
    ).rejects.toBeInstanceOf(EntitlementError);
  });
});

// --- Prompts: the prompt-side mirror of the tool/resource registries. Drives
//     registerPrompt/listPrompts/getPrompt directly (no transport). ---
describe("prompt registry (registerPrompt / listPrompts / getPrompt)", () => {
  test("integrate_module is a base prompt visible to every authenticated buyer", () => {
    expect(server.listPrompts(session).map((p) => p.name)).toContain(
      "integrate_module",
    );
  });

  test("integrate_module renders a describe_module -> generate recipe for a known module", async () => {
    const out = await server.getPrompt(session, "integrate_module", {
      module_id: "@caisson/auth",
      project_name: "shop",
    });
    expect(out.messages).toHaveLength(1);
    const text = out.messages[0]?.content.text ?? "";
    expect(text).toContain("describe_module");
    expect(text).toContain("generate");
    expect(text).toContain("@caisson/auth");
    expect(text).toContain("shop");
    // The recipe pins the CONCRETE latest from the index — the literal "latest" is a pointer
    // the generate gate (assertKnownVersion) rejects with a 400.
    expect(text).toContain('"version": "0.1.0"');
    expect(text).not.toContain('"version": "latest"');
  });

  test("integrate_module rejects a module the registry does not know (400, never recommends it)", async () => {
    await expect(
      server.getPrompt(session, "integrate_module", {
        module_id: "@caisson/does-not-exist",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  test("an unknown prompt name is a NotFoundError", async () => {
    await expect(
      server.getPrompt(session, "no_such_prompt", {}),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  test("an unentitled prompt is the SAME NotFoundError as an unknown one (invisible)", async () => {
    server.registerPrompt({
      name: "edition_only_prompt",
      requiredEntitlement: "ai-kit",
      description: "Edition-gated prompt fixture.",
      version: "1.0.0",
      arguments: [],
      handler: async () => ({
        messages: [{ role: "user", content: { type: "text", text: "x" } }],
      }),
    });
    // session owns compliance/auth/billing, NOT ai-kit → invisible.
    expect(server.listPrompts(session).map((p) => p.name)).not.toContain(
      "edition_only_prompt",
    );
    const gated = await server
      .getPrompt(session, "edition_only_prompt", {})
      .catch((e: unknown) => e);
    const unknown = await server
      .getPrompt(session, "totally_unknown", {})
      .catch((e: unknown) => e);
    expect(gated).toBeInstanceOf(NotFoundError);
    expect((gated as NotFoundError).code).toBe((unknown as NotFoundError).code);
  });

  test("a duplicate prompt name is a fail-closed ValidationError", () => {
    expect(() =>
      server.registerPrompt({
        name: "integrate_module",
        requiredEntitlement: null,
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
        requiredEntitlement: null,
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
        requiredEntitlement: null,
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
        module_id: "@caisson/auth",
        bogus: "y",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    // args are length-bounded at the boundary like every tool arg (max 512).
    await expect(
      server.getPrompt(session, "integrate_module", {
        module_id: "@caisson/auth",
        project_name: "x".repeat(513),
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
