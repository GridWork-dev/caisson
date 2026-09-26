// The authed design-system tools (CR-09): the base reads (list_components / describe_component /
// get_tokens), check_usage, and describe_pro_component are visible to every authenticated caller;
// describe_pro_component exists only when a pro manifest is supplied.
import { describe, expect, test } from "bun:test";
import { NotFoundError } from "@caisson/kernel";
import { loadRegistryIndex } from "@caisson/registry-schema";
import {
  darkTheme,
  functionalDark,
  functionalLight,
  fonts,
  lightTheme,
} from "@caisson/ui/tokens";
import { loadBaseManifest, type ComponentManifest } from "@caisson/ds-manifest";
import { createMcpServer, type DesignTokens } from "./index.ts";

const INDEX = loadRegistryIndex({ schemaVersion: 1, modules: [] });
const BASE_MANIFEST = loadBaseManifest();

const TOKENS: DesignTokens = {
  themes: { dark: darkTheme, light: lightTheme },
  functional: { dark: functionalDark, light: functionalLight },
  fonts: { sans: fonts.sans, mono: fonts.mono },
};

// A minimal but valid pro manifest — a real pro component slug (@caisson/ui-pro ships DataTablePro).
// Its ONLY reachable path is the authed describe_pro_component; the discovery server never sees it.
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
const T_BASE = pad("tok_base_");
const T_OTHER = pad("tok_other_");

function makeServer() {
  return createMcpServer({
    tokens: [
      { token: T_BASE, accountId: "acct_base" },
      { token: T_OTHER, accountId: "acct_other" },
    ],
    index: INDEX,
    onGenerate: async () => ({ generationId: "gen_x" }),
    dsManifest: {
      baseManifest: BASE_MANIFEST,
      tokens: TOKENS,
      proManifest: PRO_MANIFEST,
    },
  });
}

const BROKEN = `import { Button, Frobnicate } from "@caisson/ui";\n<Frobnicate />`;

describe("base read tools — open to every authenticated buyer", () => {
  const server = makeServer();
  const base = server.authenticate(T_BASE);

  test("list_components + describe_component + get_tokens need no entitlement", async () => {
    const list = (await server.handleToolCall(base, "list_components", {})) as {
      components: { name: string }[];
    };
    expect(list.components.length).toBe(BASE_MANIFEST.components.length);

    const button = (await server.handleToolCall(base, "describe_component", {
      name: "button",
    })) as { name: string };
    expect(button.name).toBe("Button");

    const tokens = (await server.handleToolCall(
      base,
      "get_tokens",
      {},
    )) as DesignTokens & { note: string };
    expect(tokens.fonts.sans).toBe(fonts.sans);
    expect(tokens.note.length).toBeGreaterThan(0);
  });

  test("an unknown base component is a NotFoundError, not a leak", async () => {
    await expect(
      server.handleToolCall(base, "describe_component", { name: "Nope" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("pro metadata — registered only when a pro manifest is supplied", () => {
  const server = makeServer();

  test("every authenticated caller resolves the pro component", async () => {
    for (const token of [T_BASE, T_OTHER]) {
      const caller = server.authenticate(token);
      expect(server.listTools(caller).map((r) => r.name)).toContain(
        "describe_pro_component",
      );
      const out = (await server.handleToolCall(
        caller,
        "describe_pro_component",
        { name: "DataTablePro" },
      )) as { name: string; a11yNotes: string[] };
      expect(out.name).toBe("DataTablePro");
      expect(out.a11yNotes[0]).toContain("aria-sort");
    }
  });

  test("describe_pro_component is not registered at all when no pro manifest is supplied", async () => {
    const noPro = createMcpServer({
      tokens: [{ token: T_OTHER, accountId: "acct_other" }],
      index: INDEX,
      onGenerate: async () => ({ generationId: "g" }),
      dsManifest: { baseManifest: BASE_MANIFEST, tokens: TOKENS },
    });
    const s = noPro.authenticate(T_OTHER);
    expect(noPro.listTools(s).map((r) => r.name)).not.toContain(
      "describe_pro_component",
    );
    await expect(
      noPro.handleToolCall(s, "describe_pro_component", {
        name: "DataTablePro",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("check_usage — the static doctor", () => {
  const server = makeServer();
  const caller = server.authenticate(T_BASE);

  test("an authenticated caller runs the static doctor and gets typed findings", async () => {
    expect(server.listTools(caller).map((r) => r.name)).toContain(
      "check_usage",
    );
    const out = (await server.handleToolCall(caller, "check_usage", {
      files: [{ path: "src/Broken.tsx", contents: BROKEN }],
    })) as { findings: { rule: string }[] };
    expect(out.findings.some((f) => f.rule === "unknown-component")).toBe(true);
  });
});
