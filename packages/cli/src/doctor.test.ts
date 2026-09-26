// The doctor thin client end-to-end (ADR-0345): it calls the REAL MCP check_usage tool over an
// in-memory transport. A server with the design-system tools returns typed findings; a server
// without them answers the seam's 404, surfaced as a clear error — never a silent empty result.
import { describe, expect, test } from "bun:test";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { loadRegistryIndex } from "@caisson/registry-schema";
import { createStdioMcpServer, type DesignTokens } from "@caisson/mcp-server";
import {
  loadBaseManifest,
  type DoctorFile,
  type Finding,
} from "@caisson/ds-manifest";
import {
  darkTheme,
  functionalDark,
  functionalLight,
  fonts,
  lightTheme,
} from "@caisson/ui/tokens";
import { runDoctorClient } from "./doctor.ts";

const INDEX = loadRegistryIndex({ schemaVersion: 1, modules: [] });
const TOKENS: DesignTokens = {
  themes: { dark: darkTheme, light: lightTheme },
  functional: { dark: functionalDark, light: functionalLight },
  fonts: { sans: fonts.sans, mono: fonts.mono },
};
const TOKEN = "tok_cli_doctor_".padEnd(40, "0");
const BROKEN: DoctorFile = {
  path: "src/Broken.tsx",
  contents: `import { Button, Frobnicate } from "@caisson/ui";\n<Frobnicate />`,
};

async function runDoctor(
  files: DoctorFile[],
  withDesignSystem = true,
): Promise<Finding[]> {
  const server = createStdioMcpServer({
    mcp: {
      tokens: [{ token: TOKEN, accountId: "acct" }],
      index: INDEX,
      onGenerate: async () => ({ generationId: "g" }),
      ...(withDesignSystem
        ? { dsManifest: { baseManifest: loadBaseManifest(), tokens: TOKENS } }
        : {}),
    },
    bearer: TOKEN,
  });
  const [serverTransport, clientTransport] =
    InMemoryTransport.createLinkedPair();
  const [, findings] = await Promise.all([
    server.connect(serverTransport),
    runDoctorClient({ transport: clientTransport, files }),
  ]);
  return findings;
}

describe("caisson doctor — thin client of the MCP server", () => {
  test("a server with the design-system tools returns typed findings", async () => {
    const findings = await runDoctor([BROKEN]);
    expect(findings.some((f) => f.rule === "unknown-component")).toBe(true);
  });

  test("a correct-usage file yields zero findings", async () => {
    const clean: DoctorFile = {
      path: "src/Ok.tsx",
      contents: `import { Button } from "@caisson/ui";\n<Button variant="primary">Go</Button>`,
    };
    expect(await runDoctor([clean])).toEqual([]);
  });

  test("a server without check_usage is a clear error (404 surfaced), never an empty result", async () => {
    await expect(runDoctor([BROKEN], false)).rejects.toThrow(/not_found/);
  });
});
