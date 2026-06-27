import { describe, expect, test } from "bun:test";
import { NotFoundError, ValidationError } from "@caisson/kernel";
import { parseAiSettings, resolveProvider } from "./index.ts";
import type { AiSettings } from "./index.ts";

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
});
