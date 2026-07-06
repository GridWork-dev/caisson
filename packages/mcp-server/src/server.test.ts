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

describe("ADR-0257 bundle vocabulary through the server gate (legacy aliases keep resolving)", () => {
  // The buyer MCP consumes `expandEntitlements` — the single ADR-0257 alias point — so a legacy
  // purchased id ("ai-kit") and its new bundle id ("ai-production") must gate identically, and a
  // first-class kind:"bundle" index entry must expand via its members map exactly like an edition.
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
        entitlements: ["ai-kit"], // legacy purchased id — must never 422/downgrade (ADR-0257)
      },
      {
        token: "tok_acct_n_111111111111",
        accountId: "acct_new",
        entitlements: ["ai-production"], // the new bundle id — same leaf set via the alias map
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

  test("a legacy purchased id and its new bundle id gate the generate path identically", async () => {
    // The generate gate is the server's `expandEntitlements` consumer (ADR-0071) — both tokens
    // must resolve @caisson/gateway (an ai-kit member) through the ADR-0257 alias map.
    const legacy = srv.authenticate("tok_acct_l_000000000000");
    const modern = srv.authenticate("tok_acct_n_111111111111");
    for (const s of [legacy, modern]) {
      expect(
        await srv.handleToolCall(s, "generate", {
          projectName: "my-app",
          modules: [{ id: "@caisson/gateway", version: "0.1.0" }],
        }),
      ).toEqual({ generationId: "gen_b" });
    }
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
