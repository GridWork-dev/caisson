// C5 / ADR-0160: construction-level coverage for the provider transport. The LIVE call stays the
// deliberately un-exercised seam (the package's zero-live-call invariant, ADR-0059) — these tests
// only prove that each config enum builds a real `ProviderV2` adapter (has `.languageModel`), so a
// new backend is wired, without any network/model call or provider key.
import { describe, expect, test } from "bun:test";
import { parseAiSettings, type AiSettings } from "@caisson/ai-config";
import { defaultProviders } from "./providers.ts";

function laneSettings(lane: AiSettings["lanes"][string]): AiSettings {
  return { defaultLane: "x", lanes: { x: lane } };
}

describe("defaultProviders — every configured backend builds a ProviderV2 (ADR-0160)", () => {
  const cases: Array<{ name: string; lane: AiSettings["lanes"][string] }> = [
    {
      name: "openai",
      lane: { provider: "openai", model: "gpt-4o", apiKeyEnv: "X" },
    },
    {
      name: "anthropic",
      lane: { provider: "anthropic", model: "claude", apiKeyEnv: "X" },
    },
    {
      name: "google",
      lane: { provider: "google", model: "gemini", apiKeyEnv: "X" },
    },
    {
      name: "openrouter",
      lane: { provider: "openrouter", model: "x/y", apiKeyEnv: "X" },
    },
    {
      name: "local",
      lane: {
        provider: "local",
        model: "m",
        apiKeyEnv: "X",
        baseUrl: "http://host:1/v1",
      },
    },
    {
      name: "ollama",
      lane: {
        provider: "ollama",
        model: "llama3",
        apiKeyEnv: "X",
        baseUrl: "http://host:11434/v1",
      },
    },
    {
      name: "bedrock",
      lane: {
        provider: "bedrock",
        model: "anthropic.claude-3-sonnet-20240229-v1:0",
        apiKeyEnv: "AWS_ACCESS_KEY_ID",
        apiSecretEnv: "AWS_SECRET_ACCESS_KEY",
        region: "us-east-1",
      },
    },
    {
      name: "azure-openai",
      lane: {
        provider: "azure-openai",
        model: "my-deployment",
        apiKeyEnv: "AZURE_OPENAI_KEY",
        baseUrl: "https://res.openai.azure.com",
        apiVersion: "2024-06-01",
      },
    },
  ];

  for (const { name, lane } of cases) {
    test(`${name} → a ProviderV2 instance`, () => {
      const providers = defaultProviders(laneSettings(lane));
      const provider = providers[lane.provider];
      expect(provider).toBeDefined();
      expect(typeof provider?.languageModel).toBe("function");
    });
  }

  test("one instance per distinct provider across lanes", () => {
    const settings: AiSettings = {
      defaultLane: "a",
      lanes: {
        a: {
          provider: "bedrock",
          model: "m1",
          apiKeyEnv: "X",
          region: "us-east-1",
        },
        b: {
          provider: "bedrock",
          model: "m2",
          apiKeyEnv: "X",
          region: "us-east-1",
        },
        c: {
          provider: "ollama",
          model: "llama3",
          apiKeyEnv: "X",
          baseUrl: "http://host:11434/v1",
        },
      },
    };
    const providers = defaultProviders(settings);
    expect(Object.keys(providers).sort()).toEqual(["bedrock", "ollama"]);
  });
});

describe("parseAiSettings — the ADR-0160 config fields (region / apiVersion / apiSecretEnv)", () => {
  test("accepts the new optional fields", () => {
    const parsed = parseAiSettings({
      defaultLane: "aws",
      lanes: {
        aws: {
          provider: "bedrock",
          model: "anthropic.claude-3-sonnet-20240229-v1:0",
          apiKeyEnv: "AWS_ACCESS_KEY_ID",
          apiSecretEnv: "AWS_SECRET_ACCESS_KEY",
          region: "eu-west-1",
        },
      },
    });
    expect(parsed.lanes.aws?.region).toBe("eu-west-1");
    expect(parsed.lanes.aws?.apiSecretEnv).toBe("AWS_SECRET_ACCESS_KEY");
  });

  test("still rejects unknown keys (.strict, ADR-0002)", () => {
    expect(() =>
      parseAiSettings({
        defaultLane: "x",
        lanes: {
          x: { provider: "openai", model: "m", apiKeyEnv: "X", bogus: 1 },
        },
      }),
    ).toThrow();
  });
});
