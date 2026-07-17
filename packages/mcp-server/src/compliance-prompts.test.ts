// Proves the compliance-edition prompt is registered through the seam, entitlement-gated (invisible
// 404 to a non-compliance buyer), and validates its framework arg — mirroring the coach.test.ts /
// manifest-tools.test.ts boundary structure.
import { describe, expect, test } from "bun:test";
import { NotFoundError, ValidationError } from "@caisson/kernel";
import { loadRegistryIndex } from "@caisson/registry-schema";
import {
  createMcpServer,
  registerCompliancePrompts,
  type PromptRegistration,
} from "./index.ts";

// The walkthrough resolves each edition member to its concrete latest from the index (fail-closed
// on a missing member), so the fixture must carry all three compliance modules.
function fixtureModule(id: string) {
  return {
    id,
    latest: "0.3.0",
    versions: [
      {
        version: "0.3.0",
        manifest: {
          id,
          version: "0.3.0",
          kind: "base",
          editions: ["compliance"],
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

const COMPLIANCE_MEMBERS = [
  "@caisson/compliance",
  "@caisson/audit-worm",
  "@caisson/field-crypto",
];

const INDEX = loadRegistryIndex({
  schemaVersion: 1,
  modules: COMPLIANCE_MEMBERS.map(fixtureModule),
});

const TOKENS = [
  {
    token: "tok_compliance_buyer_000000000000",
    accountId: "acct_c",
    entitlements: ["compliance"],
  },
  {
    token: "tok_base_buyer_00000000000000000",
    accountId: "acct_b",
    entitlements: ["ai-kit"],
  },
];

function makeServer() {
  return createMcpServer({
    tokens: [...TOKENS],
    index: INDEX,
    onGenerate: async () => ({ generationId: "gen_x" }),
    compliancePrompts: {},
  });
}

describe("compliance_evidence_walkthrough — wiring + entitlement gating", () => {
  const server = makeServer();
  const compliant = server.authenticate("tok_compliance_buyer_000000000000");
  const other = server.authenticate("tok_base_buyer_00000000000000000");

  test("registered through the seam and visible to a compliance buyer", () => {
    expect(server.listPrompts(compliant).map((p) => p.name)).toContain(
      "compliance_evidence_walkthrough",
    );
  });

  test("invisible (404, not 403) to a non-compliance buyer", async () => {
    expect(server.listPrompts(other).map((p) => p.name)).not.toContain(
      "compliance_evidence_walkthrough",
    );
    await expect(
      server.getPrompt(other, "compliance_evidence_walkthrough", {}),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  test("no compliance prompt when the option is omitted (fail-closed)", async () => {
    const bare = createMcpServer({
      tokens: [...TOKENS],
      index: INDEX,
      onGenerate: async () => ({ generationId: "g" }),
    });
    const s = bare.authenticate("tok_compliance_buyer_000000000000");
    expect(bare.listPrompts(s).map((p) => p.name)).not.toContain(
      "compliance_evidence_walkthrough",
    );
    await expect(
      bare.getPrompt(s, "compliance_evidence_walkthrough", {}),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  test("renders a generate recipe with the compliance edition + members, default soc2", async () => {
    const out = await server.getPrompt(
      compliant,
      "compliance_evidence_walkthrough",
      { project_name: "acme" },
    );
    const text = out.messages[0]?.content.text ?? "";
    expect(text).toContain("generate");
    expect(text).toContain('"edition": "compliance"');
    expect(text).toContain("@caisson/audit-worm");
    expect(text).toContain("@caisson/field-crypto");
    expect(text).toContain("acme");
    expect(text).toContain("SOC2");
    // The recipe must pin CONCRETE versions — the literal "latest" is an index pointer the
    // generate gate (assertKnownVersion) rejects with a 400.
    expect(text).toContain('"version": "0.3.0"');
    expect(text).not.toContain('"latest"');
  });

  test("fails closed when an edition member is missing from the index", async () => {
    const drifted = createMcpServer({
      tokens: [...TOKENS],
      index: loadRegistryIndex({
        schemaVersion: 1,
        modules: [fixtureModule("@caisson/compliance")],
      }),
      onGenerate: async () => ({ generationId: "g" }),
      compliancePrompts: {},
    });
    const s = drifted.authenticate("tok_compliance_buyer_000000000000");
    await expect(
      drifted.getPrompt(s, "compliance_evidence_walkthrough", {}),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  test("honors a hipaa framework arg", async () => {
    const out = await server.getPrompt(
      compliant,
      "compliance_evidence_walkthrough",
      { framework: "hipaa" },
    );
    expect(out.messages[0]?.content.text ?? "").toContain("HIPAA");
  });

  test("rejects an unsupported framework", async () => {
    await expect(
      server.getPrompt(compliant, "compliance_evidence_walkthrough", {
        framework: "pci",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  test("a custom requiredEntitlement gates the prompt differently", () => {
    const s = createMcpServer({
      tokens: [
        {
          token: "tok_custom_slug_0000000000000000",
          accountId: "acct_x",
          entitlements: ["agent-dev"],
        },
      ],
      index: INDEX,
      onGenerate: async () => ({ generationId: "g" }),
      compliancePrompts: { requiredEntitlement: "agent-dev" },
    });
    const session = s.authenticate("tok_custom_slug_0000000000000000");
    expect(s.listPrompts(session).map((p) => p.name)).toContain(
      "compliance_evidence_walkthrough",
    );
  });
});

describe("registerCompliancePrompts — registrar-only wiring", () => {
  test("registers the one prompt onto a minimal registrar without the full server", () => {
    const registered: string[] = [];
    registerCompliancePrompts(
      {
        registerPrompt: (r: Pick<PromptRegistration, "name">) => {
          registered.push(r.name);
        },
      },
      INDEX,
      {},
    );
    expect(registered).toEqual(["compliance_evidence_walkthrough"]);
  });
});
