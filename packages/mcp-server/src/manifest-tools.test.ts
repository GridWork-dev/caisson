// The SPEC's non-negotiable entitlement-boundary tests for the authed design-system tools (CR-09):
//   #2  an unentitled/unauthenticated caller against a pro-metadata tool is denied outright — the
//       seam's invisible 404, NEVER a partial pro-shaped response or a silent downgrade;
//   #3  a cross-tier caller (lacking the doctor slug) is denied check_usage, matching the existing
//       entitlement-gate pattern; the doctor-entitled caller gets findings.
// Base reads (list_components / describe_component / get_tokens) stay visible to every authenticated
// buyer; the gated tools are invisible to callers without their slug.
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
// Its ONLY reachable path is the gated describe_pro_component; the discovery server never sees it.
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
const T_DOCTOR = pad("tok_doctor_");
const T_PRO = pad("tok_pro_");

function makeServer() {
  return createMcpServer({
    tokens: [
      { token: T_BASE, accountId: "acct_base", entitlements: [] },
      {
        token: T_DOCTOR,
        accountId: "acct_doctor",
        entitlements: ["ds-doctor"],
      },
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

describe("entitlement boundary #2 — pro metadata is denied, never partially returned", () => {
  const server = makeServer();
  const base = server.authenticate(T_BASE);
  const pro = server.authenticate(T_PRO);

  test("describe_pro_component is invisible to a non-pro buyer (404, not in listTools)", async () => {
    expect(server.listTools(base).map((r) => r.name)).not.toContain(
      "describe_pro_component",
    );
    await expect(
      server.handleToolCall(base, "describe_pro_component", {
        name: "DataTablePro",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  test("the denial never returns a partial pro-shaped response", async () => {
    const denied = await server
      .handleToolCall(base, "describe_pro_component", { name: "DataTablePro" })
      .then(
        () => ({ ok: true as const }),
        (e: unknown) => ({ ok: false as const, err: e }),
      );
    expect(denied.ok).toBe(false);
    // The rejection carries no component payload — it is the invisible-tool 404, nothing pro-shaped.
    expect(JSON.stringify(denied)).not.toContain("aria-sort");
  });

  test("an entitled pro buyer resolves the pro component", async () => {
    const out = (await server.handleToolCall(pro, "describe_pro_component", {
      name: "DataTablePro",
    })) as { name: string; a11yNotes: string[] };
    expect(out.name).toBe("DataTablePro");
    expect(out.a11yNotes[0]).toContain("aria-sort");
  });

  test("describe_pro_component is not registered at all when no pro manifest is supplied", async () => {
    const noPro = createMcpServer({
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
    const s = noPro.authenticate(T_PRO);
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

describe("entitlement boundary #3 — check_usage is gated on the doctor slug (cross-tier)", () => {
  const server = makeServer();
  const base = server.authenticate(T_BASE);
  const doctor = server.authenticate(T_DOCTOR);
  const pro = server.authenticate(T_PRO);

  test("a caller without the doctor slug is denied outright (invisible 404)", async () => {
    expect(server.listTools(base).map((r) => r.name)).not.toContain(
      "check_usage",
    );
    // A different tier (pro, but no doctor slug) is denied the same way — the gate is the slug.
    expect(server.listTools(pro).map((r) => r.name)).not.toContain(
      "check_usage",
    );
    await expect(
      server.handleToolCall(base, "check_usage", { files: [] }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      server.handleToolCall(pro, "check_usage", { files: [] }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  test("the doctor-entitled caller runs the static doctor and gets typed findings", async () => {
    expect(server.listTools(doctor).map((r) => r.name)).toContain(
      "check_usage",
    );
    const out = (await server.handleToolCall(doctor, "check_usage", {
      files: [{ path: "src/Broken.tsx", contents: BROKEN }],
    })) as { findings: { rule: string }[] };
    expect(out.findings.some((f) => f.rule === "unknown-component")).toBe(true);
  });
});
