// Slice A — the MCP RESOURCES surface, the read-side mirror of the tool registry. These
// core-level tests drive `createMcpServer.listResources`/`readResource` directly (no transport) to
// prove the SPEC's non-negotiable boundaries:
//   (i)   resources/list shows ONLY entitled resources — the pro roster is invisible without the
//         ui-pro slug, visible with it (mirrors the describe_pro_component tool boundary);
//   (ii)  a read on an UNKNOWN and on an UNENTITLED URI return the identical not-found shape — an
//         entitlement-gated resource never leaks that it exists;
//   (iii) the registry-index resource serves the FULL catalog to a zero-entitlement buyer (operator
//         lock 2026-07-17: discovery is the point; prices/tiers are already public marketing data);
//   (iv)  the ADR-0112 rate-limit hook is awaited on a read, and a denied hook blocks it.
// The transport round-trip + advertised capabilities (v) live in stdio.test.ts / http.test.ts.
import { describe, expect, test } from "bun:test";
import {
  NotFoundError,
  RateLimitError,
  ValidationError,
} from "@caisson/kernel";
import { loadRegistryIndex } from "@caisson/registry-schema";
import {
  darkTheme,
  functionalDark,
  functionalLight,
  fonts,
  lightTheme,
} from "@caisson/ui/tokens";
import { loadBaseManifest, type ComponentManifest } from "@caisson/ds-manifest";
import {
  createMcpServer,
  type DesignTokens,
  type McpServerOptions,
  type RateLimitHook,
} from "./index.ts";

// A built index with two modules — enough to prove "full catalog" is more than the caller owns.
const INDEX = loadRegistryIndex({
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
            kind: "base",
            tier: "paid",
            priceCents: 4900,
            license: "LicenseRef-Caisson-Commercial",
            description: "Fixture module A.",
          },
          publishedAt: "2026-06-27T00:00:00.000Z",
          gateAttestation: "ci-fixture@0000000",
        },
      ],
    },
    {
      id: "@caisson/billing",
      latest: "0.2.0",
      versions: [
        {
          version: "0.2.0",
          manifest: {
            id: "@caisson/billing",
            version: "0.2.0",
            kind: "base",
            tier: "paid",
            priceCents: 9900,
            license: "LicenseRef-Caisson-Commercial",
            description: "Fixture module B.",
          },
          publishedAt: "2026-06-27T00:00:00.000Z",
          gateAttestation: "ci-fixture@0000000",
        },
      ],
    },
  ],
});

const BASE_MANIFEST = loadBaseManifest();
const TOKENS: DesignTokens = {
  themes: { dark: darkTheme, light: lightTheme },
  functional: { dark: functionalDark, light: functionalLight },
  fonts: { sans: fonts.sans, mono: fonts.mono },
};
const PRO_MANIFEST: ComponentManifest = {
  schemaVersion: 1,
  generatedFor: { pkg: "@caisson/ui-pro", version: "0.1.0" },
  components: [
    {
      name: "DataTablePro",
      summary: "Virtualized, sortable pro data grid.",
      props: [{ name: "rows", type: "Row[]", optional: false }],
      variants: {},
      tokenDeps: ["--cs-surface-1"],
      a11yNotes: ["Announces sort state via aria-sort."],
      recipeRules: ["co-located-css-tokens-only"],
      hasDataStar: true,
    },
  ],
};

const pad = (s: string): string => s.padEnd(32, "0");
const T_BASE = pad("tok_res_base_");
const T_PRO = pad("tok_res_pro_");

const REGISTRY_URI = "caisson://registry/index";
const DS_COMPONENTS_URI = "caisson://design-system/components";
const DS_TOKENS_URI = "caisson://design-system/tokens";
const DS_PRO_URI = "caisson://design-system/pro-components";

function makeServer(overrides: Partial<McpServerOptions> = {}) {
  return createMcpServer({
    tokens: [
      { token: T_BASE, accountId: "acct_base", entitlements: [] },
      {
        token: T_PRO,
        accountId: "acct_pro",
        entitlements: ["@caisson/ui-pro"],
      },
    ],
    index: INDEX,
    onGenerate: async () => ({ generationId: "gen_x" }),
    dsManifest: {
      baseManifest: BASE_MANIFEST,
      tokens: TOKENS,
      proManifest: PRO_MANIFEST,
    },
    ...overrides,
  });
}

describe("registry-index resource (operator lock — full catalog to any authenticated buyer)", () => {
  test("a zero-entitlement buyer reads the FULL catalog, not just what they own", async () => {
    const server = makeServer();
    const base = server.authenticate(T_BASE);
    const index = (await server.readResource(base, REGISTRY_URI)) as {
      modules: { id: string }[];
    };
    // The buyer owns nothing, yet sees every module in the built index — discovery is the point.
    expect(index.modules.map((m) => m.id).sort()).toEqual([
      "@caisson/auth",
      "@caisson/billing",
    ]);
  });

  test("the registry index is always registered, even with no design-system manifest", async () => {
    const server = createMcpServer({
      tokens: [{ token: T_BASE, accountId: "acct_base", entitlements: [] }],
      index: INDEX,
      onGenerate: async () => ({ generationId: "g" }),
    });
    const base = server.authenticate(T_BASE);
    expect(server.listResources(base).map((r) => r.uri)).toEqual([
      REGISTRY_URI,
    ]);
  });
});

describe("boundary (i) — listResources shows only entitled resources", () => {
  const server = makeServer();
  const base = server.authenticate(T_BASE);
  const pro = server.authenticate(T_PRO);

  test("a base buyer's resource set is exactly the three open URIs (pro excluded)", () => {
    expect(
      server
        .listResources(base)
        .map((r) => r.uri)
        .sort(),
    ).toEqual([DS_COMPONENTS_URI, DS_TOKENS_URI, REGISTRY_URI]);
    expect(server.listResources(base).map((r) => r.uri)).not.toContain(
      DS_PRO_URI,
    );
  });

  test("a pro buyer additionally sees the pro roster and can read it", async () => {
    expect(server.listResources(pro).map((r) => r.uri)).toContain(DS_PRO_URI);
    const roster = (await server.readResource(pro, DS_PRO_URI)) as {
      components: { name: string }[];
    };
    expect(roster.components.map((c) => c.name)).toContain("DataTablePro");
  });

  test("the open design-system resources are readable by every authenticated buyer", async () => {
    const components = (await server.readResource(base, DS_COMPONENTS_URI)) as {
      components: { name: string }[];
    };
    expect(components.components.length).toBe(BASE_MANIFEST.components.length);
    const tokens = (await server.readResource(base, DS_TOKENS_URI)) as {
      fonts: { sans: string };
      note: string;
    };
    expect(tokens.fonts.sans).toBe(fonts.sans);
    expect(tokens.note.length).toBeGreaterThan(0);
  });

  test("the pro roster is NOT registered at all when no pro manifest is supplied", async () => {
    const server = createMcpServer({
      tokens: [
        {
          token: T_PRO,
          accountId: "acct_pro",
          entitlements: ["@caisson/ui-pro"],
        },
      ],
      index: INDEX,
      onGenerate: async () => ({ generationId: "g" }),
      dsManifest: { baseManifest: BASE_MANIFEST, tokens: TOKENS },
    });
    const pro = server.authenticate(T_PRO);
    expect(server.listResources(pro).map((r) => r.uri)).not.toContain(
      DS_PRO_URI,
    );
    await expect(server.readResource(pro, DS_PRO_URI)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("boundary (ii) — unknown and unentitled reads are the identical not-found", () => {
  const server = makeServer();
  const base = server.authenticate(T_BASE);

  test("an UNKNOWN URI is a NotFoundError", async () => {
    await expect(
      server.readResource(base, "caisson://nope/missing"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  test("an UNENTITLED URI (pro roster, base buyer) is the SAME NotFoundError — no leak", async () => {
    // The invisible-resource contract: an unentitled URI and an unknown URI are indistinguishable
    // in KIND (both NotFoundError → code "not_found"), and the denial carries no pro payload.
    const denied = await server.readResource(base, DS_PRO_URI).then(
      () => ({ ok: true as const }),
      (e: unknown) => ({ ok: false as const, err: e }),
    );
    expect(denied.ok).toBe(false);
    const err = (denied as { ok: false; err: unknown }).err;
    expect(err).toBeInstanceOf(NotFoundError);
    expect((err as NotFoundError).code).toBe("not_found");
    expect(JSON.stringify(denied)).not.toContain("aria-sort");

    // Same code as the unknown-URI path — an attacker cannot distinguish "exists but forbidden"
    // from "does not exist".
    const unknownErr = await server
      .readResource(base, "caisson://nope/missing")
      .catch((e: unknown) => e);
    expect((unknownErr as NotFoundError).code).toBe(
      (err as NotFoundError).code,
    );
  });
});

describe("boundary (iv) — the ADR-0112 rate-limit hook gates reads", () => {
  test("the hook fires once on a successful read", async () => {
    const seen: string[] = [];
    const hook: RateLimitHook = async (accountId) => {
      seen.push(accountId);
    };
    const server = makeServer({ checkRateLimit: hook });
    const base = server.authenticate(T_BASE);
    await server.readResource(base, REGISTRY_URI);
    expect(seen).toEqual(["acct_base"]);
  });

  test("a denied hook blocks the read with RateLimitError — the handler never serves", async () => {
    const hook: RateLimitHook = async () => {
      throw new RateLimitError("over limit", { retryAfterMs: 1000 });
    };
    const server = makeServer({ checkRateLimit: hook });
    const base = server.authenticate(T_BASE);
    await expect(
      server.readResource(base, REGISTRY_URI),
    ).rejects.toBeInstanceOf(RateLimitError);
  });

  test("an unknown URI is a 404 BEFORE the hook — the not-found path is never throttled", async () => {
    let hookCalls = 0;
    const hook: RateLimitHook = async () => {
      hookCalls += 1;
    };
    const server = makeServer({ checkRateLimit: hook });
    const base = server.authenticate(T_BASE);
    await expect(
      server.readResource(base, "caisson://nope/missing"),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(hookCalls).toBe(0);
  });
});

describe("registration discipline mirrors registerTool", () => {
  test("a duplicate URI is a fail-closed ValidationError", () => {
    const server = makeServer();
    expect(() =>
      server.registerResource({
        uri: REGISTRY_URI,
        name: "Dup",
        description: "A colliding resource.",
        mimeType: "application/json",
        requiredEntitlement: null,
        handler: async () => ({}),
      }),
    ).toThrow(ValidationError);
  });

  test("a malformed URI is rejected at registration time", () => {
    const server = makeServer();
    expect(() =>
      server.registerResource({
        uri: "https://not-caisson/x",
        name: "Bad",
        description: "Off-scheme URI.",
        mimeType: "application/json",
        requiredEntitlement: null,
        handler: async () => ({}),
      }),
    ).toThrow(ValidationError);
  });
});
