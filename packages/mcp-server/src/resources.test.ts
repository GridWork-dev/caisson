// Slice A — the MCP RESOURCES surface, the read-side mirror of the tool registry. These
// core-level tests drive `createMcpServer.listResources`/`readResource` directly (no transport) to
// prove:
//   (i)   resources/list shows every registered resource to every authenticated caller, and the
//         pro roster exists only when a pro manifest is supplied;
//   (ii)  a read on an UNKNOWN URI is a not-found;
//   (iii) the registry-index resource serves the FULL catalog to any authenticated caller;
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
      { token: T_BASE, accountId: "acct_base" },
      {
        token: T_PRO,
        accountId: "acct_pro",
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

describe("registry-index resource (full catalog to any authenticated caller)", () => {
  test("an authenticated caller reads the FULL catalog", async () => {
    const server = makeServer();
    const base = server.authenticate(T_BASE);
    const index = (await server.readResource(base, REGISTRY_URI)) as {
      modules: { id: string }[];
    };
    // Every module in the built index — discovery is the point.
    expect(index.modules.map((m) => m.id).sort()).toEqual([
      "@caisson/auth",
      "@caisson/billing",
    ]);
  });

  test("the registry index is always registered, even with no design-system manifest", async () => {
    const server = createMcpServer({
      tokens: [{ token: T_BASE, accountId: "acct_base" }],
      index: INDEX,
      onGenerate: async () => ({ generationId: "g" }),
    });
    const base = server.authenticate(T_BASE);
    expect(server.listResources(base).map((r) => r.uri)).toEqual([
      REGISTRY_URI,
    ]);
  });
});

describe("boundary (i) — listResources shows every registered resource", () => {
  const server = makeServer();
  const base = server.authenticate(T_BASE);
  const pro = server.authenticate(T_PRO);

  test("every caller sees the same four URIs, and can read the pro roster", async () => {
    for (const caller of [base, pro]) {
      expect(
        server
          .listResources(caller)
          .map((r) => r.uri)
          .sort(),
      ).toEqual([DS_COMPONENTS_URI, DS_PRO_URI, DS_TOKENS_URI, REGISTRY_URI]);
    }
    const roster = (await server.readResource(base, DS_PRO_URI)) as {
      components: { name: string }[];
    };
    expect(roster.components.map((c) => c.name)).toContain("DataTablePro");
  });

  test("the open design-system resources are readable by every authenticated caller", async () => {
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
      tokens: [{ token: T_PRO, accountId: "acct_pro" }],
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

describe("boundary (ii) — an unknown read is a not-found", () => {
  test("an UNKNOWN URI is a NotFoundError", async () => {
    const server = makeServer();
    const base = server.authenticate(T_BASE);
    await expect(
      server.readResource(base, "caisson://nope/missing"),
    ).rejects.toBeInstanceOf(NotFoundError);
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
        handler: async () => ({}),
      }),
    ).toThrow(ValidationError);
  });
});
