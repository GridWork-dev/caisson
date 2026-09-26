import { describe, expect, test } from "bun:test";
import { NotFoundError, ValidationError } from "@caisson-sh/kernel";
import { parseAiSettings, resolveProvider } from "./index.ts";
import type { AiSettings, ProviderConfig } from "./index.ts";

const chatLane = {
  provider: "anthropic",
  model: "claude-sonnet",
  apiKeyEnv: "ANTHROPIC_API_KEY",
} as const;

const cheapLane = {
  provider: "openrouter",
  model: "meta-llama/llama-3.1-8b",
  apiKeyEnv: "OPENROUTER_API_KEY",
  baseUrl: "https://openrouter.ai/api/v1",
} as const;

const settings: AiSettings = {
  defaultLane: "chat",
  lanes: { chat: chatLane, cheap: cheapLane },
};

describe("ai-config resolver", () => {
  test("parses a valid settings object", () => {
    expect(parseAiSettings(settings)).toEqual(settings);
  });

  test("resolves a named lane to its provider config", () => {
    expect(resolveProvider(settings, "cheap")).toEqual(cheapLane);
  });

  test("resolves the default lane when none is named", () => {
    expect(resolveProvider(settings)).toEqual(chatLane);
  });

  test("an unknown lane throws NotFoundError", () => {
    expect(() => resolveProvider(settings, "missing")).toThrow(NotFoundError);
  });

  test("strict parse rejects an unknown top-level key", () => {
    expect(() => parseAiSettings({ ...settings, extra: true })).toThrow(
      ValidationError,
    );
  });

  test("no provider is hardcoded — resolution is config-driven", () => {
    // The same resolver returns whatever provider the config names: anthropic
    // for one lane, openrouter for another, with no provider literal at all.
    expect(resolveProvider(settings, "chat").provider).toBe("anthropic");
    expect(resolveProvider(settings, "cheap").provider).toBe("openrouter");
  });

  test("bedrock lane with only region parses clean (ADR-0160 default credential chain)", () => {
    const bedrockLane: ProviderConfig = {
      provider: "bedrock",
      model: "anthropic.claude-3-sonnet",
      region: "us-east-1",
    };
    expect(
      parseAiSettings({
        defaultLane: "chat",
        lanes: { chat: bedrockLane },
      }),
    ).toEqual({ defaultLane: "chat", lanes: { chat: bedrockLane } });
  });

  test("a non-bedrock env lane missing apiKeyEnv still rejects (regression guard)", () => {
    expect(() =>
      parseAiSettings({
        defaultLane: "chat",
        lanes: { chat: { provider: "openai", model: "gpt-5" } },
      }),
    ).toThrow(ValidationError);
  });

  test("bedrock lane with an explicit two-part credential parses clean", () => {
    const bedrockLane: ProviderConfig = {
      provider: "bedrock",
      model: "anthropic.claude-3-sonnet",
      region: "us-east-1",
      apiKeyEnv: "AWS_ACCESS_KEY_ID",
      apiSecretEnv: "AWS_SECRET_ACCESS_KEY",
    };
    expect(
      parseAiSettings({
        defaultLane: "chat",
        lanes: { chat: bedrockLane },
      }),
    ).toEqual({ defaultLane: "chat", lanes: { chat: bedrockLane } });
  });

  test("azure-openai lane with apiVersion + baseUrl parses clean", () => {
    const azureLane: ProviderConfig = {
      provider: "azure-openai",
      model: "gpt-5-deployment",
      apiVersion: "2026-01-01-preview",
      baseUrl: "https://example.openai.azure.com",
      apiKeyEnv: "AZURE_OPENAI_API_KEY",
    };
    expect(
      parseAiSettings({
        defaultLane: "chat",
        lanes: { chat: azureLane },
      }),
    ).toEqual({ defaultLane: "chat", lanes: { chat: azureLane } });
  });

  test("azure-openai lane missing apiVersion rejects", () => {
    expect(() =>
      parseAiSettings({
        defaultLane: "chat",
        lanes: {
          chat: {
            provider: "azure-openai",
            model: "gpt-5-deployment",
            baseUrl: "https://example.openai.azure.com",
            apiKeyEnv: "AZURE_OPENAI_API_KEY",
          },
        },
      }),
    ).toThrow(ValidationError);
  });

  test("azure-openai lane missing baseUrl rejects", () => {
    expect(() =>
      parseAiSettings({
        defaultLane: "chat",
        lanes: {
          chat: {
            provider: "azure-openai",
            model: "gpt-5-deployment",
            apiVersion: "2026-01-01-preview",
            apiKeyEnv: "AZURE_OPENAI_API_KEY",
          },
        },
      }),
    ).toThrow(ValidationError);
  });

  test("ollama lane round-trips (mirrors local, no new fields)", () => {
    const ollamaLane: ProviderConfig = {
      provider: "ollama",
      model: "llama3",
      apiKeyEnv: "OLLAMA_API_KEY",
      baseUrl: "https://ollama.example.internal",
    };
    expect(
      parseAiSettings({
        defaultLane: "chat",
        lanes: { chat: ollamaLane },
      }),
    ).toEqual({ defaultLane: "chat", lanes: { chat: ollamaLane } });
  });

  test("groq/mistral/together lanes round-trip (ADR-0171 board lock, hardcoded default baseUrl)", () => {
    for (const provider of ["groq", "mistral", "together"] as const) {
      const lane: ProviderConfig = {
        provider,
        model: "m",
        apiKeyEnv: `${provider.toUpperCase()}_API_KEY`,
      };
      expect(
        parseAiSettings({ defaultLane: "chat", lanes: { chat: lane } }),
      ).toEqual({ defaultLane: "chat", lanes: { chat: lane } });
    }
  });

  test("groq/mistral/together lanes missing apiKeyEnv reject (same rule as openai, not bedrock-exempt)", () => {
    for (const provider of ["groq", "mistral", "together"] as const) {
      expect(() =>
        parseAiSettings({
          defaultLane: "chat",
          lanes: { chat: { provider, model: "m" } },
        }),
      ).toThrow(ValidationError);
    }
  });

  test("groq/mistral/together lanes accept an overridden baseUrl", () => {
    for (const provider of ["groq", "mistral", "together"] as const) {
      const lane: ProviderConfig = {
        provider,
        model: "m",
        apiKeyEnv: "X",
        baseUrl: "https://gateway.example.com/v1",
      };
      expect(
        parseAiSettings({ defaultLane: "chat", lanes: { chat: lane } }),
      ).toEqual({ defaultLane: "chat", lanes: { chat: lane } });
    }
  });

  test("keySource: tenant round-trips with no apiKeyEnv", () => {
    const tenantLane: ProviderConfig = {
      provider: "openai",
      model: "gpt-5",
      keySource: "tenant",
    };
    expect(
      parseAiSettings({
        defaultLane: "chat",
        lanes: { chat: tenantLane },
      }),
    ).toEqual({ defaultLane: "chat", lanes: { chat: tenantLane } });
  });

  test("keySource: tenant with a named apiKeyEnv rejects", () => {
    expect(() =>
      parseAiSettings({
        defaultLane: "chat",
        lanes: {
          chat: {
            provider: "openai",
            model: "gpt-5",
            keySource: "tenant",
            apiKeyEnv: "OPENAI_API_KEY",
          },
        },
      }),
    ).toThrow(ValidationError);
  });
});
