// T16 proof (ADR-0076 + ADR-0011): the setup coach is entitlement-gated, secrets-safe, and
// approval-gated. The cardinal invariant under test — a secret VALUE can neither enter a tool nor
// appear in any tool output — is asserted directly, not assumed.
import { describe, expect, test } from "bun:test";
import { NotFoundError, ValidationError } from "@caisson/kernel";
import { loadRegistryIndex } from "@caisson/registry-schema";
import {
  createMcpServer,
  presenceEnvPort,
  registerCoachTools,
  type CoachEnvPort,
  type CoachWriteResult,
  type ForgeConfigFile,
} from "./index.ts";

const SECRET = "sk-super-secret-value-do-not-leak-0000";

// The coach suite never calls `generate`, so a minimal valid (empty) registry index satisfies the
// `index` option without standing up a module fixture.
const INDEX = loadRegistryIndex({ schemaVersion: 1, modules: [] });

/** Presence-only env stub: holds a set of NAMES that are "set" — never exposes a value. */
function envWith(present: readonly string[]): CoachEnvPort {
  const set = new Set(present);
  return { has: (name) => set.has(name) };
}

/** Recording writer double — captures the files a successful (approved) write would persist. */
function recordingWriter() {
  const writes: ForgeConfigFile[][] = [];
  return {
    writes,
    port: {
      write: async (files: readonly ForgeConfigFile[]) => {
        writes.push([...files]);
      },
    },
  };
}

const TOKENS = [
  {
    token: "tok_acct_a_000000000000",
    accountId: "acct_a",
    entitlements: ["compliance", "auth"],
  },
  {
    token: "tok_acct_b_111111111111",
    accountId: "acct_b",
    entitlements: ["ai-kit"],
  },
];

function makeServer(opts?: {
  env?: CoachEnvPort;
  writer?: { write: (files: readonly ForgeConfigFile[]) => Promise<void> };
}) {
  const writer = opts?.writer ?? recordingWriter().port;
  return createMcpServer({
    tokens: [...TOKENS],
    index: INDEX,
    onGenerate: async () => ({ generationId: "gen_x" }),
    coach: {
      env: opts?.env ?? envWith([]),
      writer,
    },
  });
}

const PROPOSE = {
  defaultLane: "default",
  lanes: [
    { name: "default", provider: "anthropic", model: "claude-sonnet-4" },
    { name: "fast", provider: "openai", model: "gpt-4o-mini" },
  ],
};

describe("setup coach — wiring + entitlement gating (ADR-0076)", () => {
  const server = makeServer();
  const nonEntitled = server.authenticate("tok_acct_a_000000000000");
  const entitled = server.authenticate("tok_acct_b_111111111111");

  test("coach tools are registered through the seam and visible to an ai-kit buyer", () => {
    const tools = server.listTools(entitled);
    expect(tools).toEqual(
      expect.arrayContaining([
        "inspect_env",
        "propose_ai_config",
        "write_forge_config",
        "validate_setup",
      ]),
    );
  });

  test("coach tools are invisible (404, not 403) to a non-entitled buyer", async () => {
    const tools = server.listTools(nonEntitled);
    expect(tools).not.toContain("inspect_env");
    expect(tools).not.toContain("write_forge_config");
    await expect(
      server.handleToolCall(nonEntitled, "inspect_env", {
        names: ["ANTHROPIC_API_KEY"],
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  test("no coach is registered when the option is omitted (fail-closed)", async () => {
    const bare = createMcpServer({
      tokens: [...TOKENS],
      index: INDEX,
      onGenerate: async () => ({ generationId: "g" }),
    });
    const s = bare.authenticate("tok_acct_b_111111111111");
    expect(bare.listTools(s)).not.toContain("inspect_env");
    await expect(
      bare.handleToolCall(s, "propose_ai_config", PROPOSE),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  test("a custom requiredEntitlement gates the tools differently", async () => {
    const customWriter = recordingWriter();
    const s = createMcpServer({
      tokens: [
        {
          token: "tok_acct_c_222222222222",
          accountId: "acct_c",
          entitlements: ["agent-dev"],
        },
      ],
      index: INDEX,
      onGenerate: async () => ({ generationId: "g" }),
      coach: {
        env: envWith([]),
        writer: customWriter.port,
        requiredEntitlement: "agent-dev",
      },
    });
    const session = s.authenticate("tok_acct_c_222222222222");
    expect(s.listTools(session)).toContain("inspect_env");
  });
});

describe("inspect_env — presence only, never values", () => {
  const env = envWith(["ANTHROPIC_API_KEY"]);
  const server = makeServer({ env });
  const session = server.authenticate("tok_acct_b_111111111111");

  test("reports set/unset per NAME without exposing a value", async () => {
    const out = (await server.handleToolCall(session, "inspect_env", {
      names: ["ANTHROPIC_API_KEY", "OPENAI_API_KEY"],
    })) as { vars: { name: string; present: boolean }[]; allPresent: boolean };
    expect(out.vars).toEqual([
      { name: "ANTHROPIC_API_KEY", present: true },
      { name: "OPENAI_API_KEY", present: false },
    ]);
    expect(out.allPresent).toBe(false);
    // The output is presence-only: a value never appears in the serialized result.
    expect(JSON.stringify(out)).not.toContain(SECRET);
  });

  test("rejects a malformed env-var name (input validation)", async () => {
    await expect(
      server.handleToolCall(session, "inspect_env", {
        names: ["not a valid name!"],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  test("rejects an unknown field — a key value can never ride in (strict)", async () => {
    await expect(
      server.handleToolCall(session, "inspect_env", {
        names: ["OPENAI_API_KEY"],
        apiKey: SECRET,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("propose_ai_config — validated config + key NAMES", () => {
  const server = makeServer();
  const session = server.authenticate("tok_acct_b_111111111111");

  test("derives default key NAMES per provider and validates the config", async () => {
    const out = (await server.handleToolCall(
      session,
      "propose_ai_config",
      PROPOSE,
    )) as {
      settings: {
        defaultLane: string;
        lanes: Record<string, { provider: string; apiKeyEnv: string }>;
      };
      requiredEnvVars: string[];
    };
    expect(out.settings.defaultLane).toBe("default");
    expect(out.settings.lanes.default?.apiKeyEnv).toBe("ANTHROPIC_API_KEY");
    expect(out.settings.lanes.fast?.apiKeyEnv).toBe("OPENAI_API_KEY");
    expect(out.requiredEnvVars).toEqual([
      "ANTHROPIC_API_KEY",
      "OPENAI_API_KEY",
    ]);
  });

  test("honors an explicit apiKeyEnv override", async () => {
    const out = (await server.handleToolCall(session, "propose_ai_config", {
      defaultLane: "default",
      lanes: [
        {
          name: "default",
          provider: "openrouter",
          model: "x",
          apiKeyEnv: "MY_OPENROUTER_KEY",
        },
      ],
    })) as { requiredEnvVars: string[] };
    expect(out.requiredEnvVars).toEqual(["MY_OPENROUTER_KEY"]);
  });

  test("rejects a non-AI provider (enum enforced by ai-config)", async () => {
    await expect(
      server.handleToolCall(session, "propose_ai_config", {
        defaultLane: "default",
        lanes: [{ name: "default", provider: "postgres", model: "x" }],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  test("rejects a defaultLane that names no proposed lane", async () => {
    await expect(
      server.handleToolCall(session, "propose_ai_config", {
        defaultLane: "missing",
        lanes: [{ name: "default", provider: "openai", model: "x" }],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("write_forge_config — approval-gated, secrets-safe", () => {
  const settings = {
    defaultLane: "default",
    lanes: {
      default: {
        provider: "anthropic",
        model: "claude-sonnet-4",
        apiKeyEnv: "ANTHROPIC_API_KEY",
      },
    },
  };

  test("without approval: preview only, writer never invoked (fail-closed)", async () => {
    const writer = recordingWriter();
    const server = makeServer({ writer: writer.port });
    const session = server.authenticate("tok_acct_b_111111111111");
    const out = (await server.handleToolCall(session, "write_forge_config", {
      settings,
    })) as CoachWriteResult;
    expect(out.status).toBe("pending_approval");
    expect(writer.writes).toHaveLength(0);
  });

  test("with approval: persists NAMES + .env.example — never a secret value", async () => {
    const writer = recordingWriter();
    const server = makeServer({ writer: writer.port });
    const session = server.authenticate("tok_acct_b_111111111111");
    const out = (await server.handleToolCall(session, "write_forge_config", {
      settings,
      approve: true,
    })) as CoachWriteResult;
    expect(out.status).toBe("written");
    expect(writer.writes).toHaveLength(1);
    const files = writer.writes[0] ?? [];
    const paths = files.map((f) => f.path).sort();
    expect(paths).toEqual([".env.example", "forge.config.json"]);
    const envExample = files.find((f) => f.path === ".env.example");
    // Key NAME present, value blank — a real secret is never written here.
    expect(envExample?.contents).toContain("ANTHROPIC_API_KEY=");
    for (const file of files) {
      expect(file.contents).not.toContain(SECRET);
    }
  });

  test("rejects a key value smuggled as an unknown field (strict)", async () => {
    const server = makeServer();
    const session = server.authenticate("tok_acct_b_111111111111");
    await expect(
      server.handleToolCall(session, "write_forge_config", {
        settings,
        approve: true,
        ANTHROPIC_API_KEY: SECRET,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("validate_setup — fail-closed verdict", () => {
  const settings = {
    defaultLane: "default",
    lanes: {
      default: {
        provider: "openai",
        model: "gpt-4o",
        apiKeyEnv: "OPENAI_API_KEY",
      },
    },
  };

  test("valid when every referenced key NAME is present", async () => {
    const server = makeServer({ env: envWith(["OPENAI_API_KEY"]) });
    const session = server.authenticate("tok_acct_b_111111111111");
    const out = (await server.handleToolCall(session, "validate_setup", {
      settings,
    })) as { valid: boolean; checked: string[]; missing: string[] };
    expect(out).toEqual({
      valid: true,
      checked: ["OPENAI_API_KEY"],
      missing: [],
    });
  });

  test("invalid (fail-closed) when a key NAME is unset", async () => {
    const server = makeServer({ env: envWith([]) });
    const session = server.authenticate("tok_acct_b_111111111111");
    const out = (await server.handleToolCall(session, "validate_setup", {
      settings,
    })) as { valid: boolean; missing: string[] };
    expect(out.valid).toBe(false);
    expect(out.missing).toEqual(["OPENAI_API_KEY"]);
  });
});

describe("presenceEnvPort adapter", () => {
  test("collapses values to booleans; empty string counts as unset", () => {
    const port = presenceEnvPort({
      SET_KEY: SECRET,
      EMPTY_KEY: "",
    });
    expect(port.has("SET_KEY")).toBe(true);
    expect(port.has("EMPTY_KEY")).toBe(false);
    expect(port.has("ABSENT_KEY")).toBe(false);
  });

  test("can wire directly onto a registrar without the full server", async () => {
    const calls: string[] = [];
    registerCoachTools(
      {
        registerTool: (r) => {
          calls.push(r.name);
        },
      },
      { env: presenceEnvPort({}), writer: recordingWriter().port },
    );
    expect(calls.sort()).toEqual([
      "inspect_env",
      "propose_ai_config",
      "validate_setup",
      "write_forge_config",
    ]);
  });
});
