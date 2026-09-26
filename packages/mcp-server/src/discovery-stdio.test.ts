// The SPEC's mandatory catalog-boundary test #1 (CR-09): the local stdio discovery server's
// resolvable component set is a STRICT SUBSET of the Apache-base manifest and can NEVER resolve a
// @caisson-sh/ui-pro component. Driven through a REAL MCP Client over InMemoryTransport, with NO
// bearer — proving the open tier needs no credentials — including the guard that a pro component
// injected into a separate manifest fixture is still unknown to the base-pinned server.
import { afterEach, describe, expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  darkTheme,
  functionalDark,
  functionalLight,
  fonts,
  lightTheme,
} from "@caisson-sh/ui/tokens";
import {
  loadBaseManifest,
  type Component,
  type ComponentManifest,
} from "@caisson-sh/ds-manifest";
import { createDiscoveryServer, type DesignTokens } from "./index.ts";

const BASE = loadBaseManifest();
const TOKENS: DesignTokens = {
  themes: { dark: darkTheme, light: lightTheme },
  functional: { dark: functionalDark, light: functionalLight },
  fonts: { sans: fonts.sans, mono: fonts.mono },
};

const PRO_COMPONENT: Component = {
  name: "DataTablePro",
  summary: "Pro data grid.",
  props: [],
  variants: {},
  tokenDeps: [],
  a11yNotes: [],
  recipeRules: [],
  hasDataStar: false,
};

let client: Client | undefined;
afterEach(async () => {
  await client?.close();
  client = undefined;
});

/** Connect a real MCP client (no bearer) to a discovery server over an in-memory pair. */
async function connect(manifest: ComponentManifest): Promise<Client> {
  const server = createDiscoveryServer({ manifest, tokens: TOKENS });
  const [serverTransport, clientTransport] =
    InMemoryTransport.createLinkedPair();
  const c = new Client({ name: "discovery-test", version: "0.0.0" });
  await Promise.all([
    server.connect(serverTransport),
    c.connect(clientTransport),
  ]);
  client = c;
  return c;
}

function textOf(result: unknown): unknown {
  const content =
    (result as { content?: { type: string; text: string }[] }).content ?? [];
  return JSON.parse(content[0]?.text ?? "{}");
}

describe("discovery server — open, no credentials", () => {
  test("list_components + get_tokens answer with no bearer", async () => {
    const c = await connect(BASE);
    const tools = (await c.listTools()).tools.map((t) => t.name).sort();
    expect(tools).toEqual([
      "describe_component",
      "get_tokens",
      "list_components",
    ]);

    const list = textOf(
      await c.callTool({ name: "list_components", arguments: {} }),
    ) as { components: { name: string }[] };
    expect(list.components.length).toBe(BASE.components.length);

    const tokens = textOf(
      await c.callTool({ name: "get_tokens", arguments: {} }),
    ) as { fonts: { sans: string } };
    expect(tokens.fonts.sans).toBe(fonts.sans);
  });
});

describe("strict-subset invariant — never resolves a pro component", () => {
  test("every resolvable name is in the base manifest set", async () => {
    const c = await connect(BASE);
    const list = textOf(
      await c.callTool({ name: "list_components", arguments: {} }),
    ) as { components: { name: string }[] };
    const baseNames = new Set(BASE.components.map((x) => x.name));
    for (const comp of list.components) {
      expect(baseNames.has(comp.name)).toBe(true);
    }
    // Sanity: the pro component is genuinely absent from the base set (the fixture is meaningful).
    expect(baseNames.has(PRO_COMPONENT.name)).toBe(false);
  });

  test("describe_component of a pro name is unknown (isError, not_found)", async () => {
    const c = await connect(BASE);
    const result = await c.callTool({
      name: "describe_component",
      arguments: { name: PRO_COMPONENT.name },
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatchObject({ error: { code: "not_found" } });
  });

  test("guard: a pro component injected into a SEPARATE manifest stays unknown to the base-pinned server", async () => {
    // The polluted manifest exists, but the discovery server is pinned to the CLEAN base — so the
    // pro name is still unknown. Proves the server resolves ONLY its own manifest, not "anything".
    const polluted: ComponentManifest = {
      ...BASE,
      components: [...BASE.components, PRO_COMPONENT],
    };
    expect(polluted.components.some((x) => x.name === PRO_COMPONENT.name)).toBe(
      true,
    );
    const c = await connect(BASE);
    const result = await c.callTool({
      name: "describe_component",
      arguments: { name: PRO_COMPONENT.name },
    });
    expect(result.isError).toBe(true);
  });

  test("no check_usage / generate / pro tool exists on the discovery server", async () => {
    const c = await connect(BASE);
    const names = (await c.listTools()).tools.map((t) => t.name);
    expect(names).not.toContain("check_usage");
    expect(names).not.toContain("generate");
    expect(names).not.toContain("describe_pro_component");
    const result = await c.callTool({ name: "check_usage", arguments: {} });
    expect(result.isError).toBe(true);
  });
});
