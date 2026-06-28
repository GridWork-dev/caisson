// The live provider transport (ADR-0059/0011). Maps each ai-config lane's provider name to a real
// Vercel AI SDK adapter — the ONLY place in the package graph a vendor SDK is imported (the gateway
// hides it behind `infer()`; base packages may never import one, enforced by the Gate-2 boundary).
//
// This is the LIVE transport: the one path NOT exercised in CI. Every test injects a mock
// `LanguageModelV2` and never reaches a real adapter, so no provider key, model call, or network
// request happens in the gate (the SPEC's zero-live-call invariant). A buyer's BYOK key is read from
// the env var the lane NAMES (`apiKeyEnv`, ADR-0011) — ai-config never reads the key itself; the SDK
// adapter does, here, at the edge. `openrouter` + `local` are OpenAI-API-compatible, so they reach
// through the OpenAI adapter with an explicit `baseURL` (no extra SDK).
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { ProviderV2 } from "@ai-sdk/provider";
import type { AiSettings, ProviderConfig } from "@caisson/ai-config";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

/** Build the real provider instance for one lane config (the key is read from `apiKeyEnv`). */
function providerFor(cfg: ProviderConfig): ProviderV2 {
  const apiKey = process.env[cfg.apiKeyEnv];
  const key = apiKey !== undefined ? { apiKey } : {};
  const base = cfg.baseUrl !== undefined ? { baseURL: cfg.baseUrl } : {};
  switch (cfg.provider) {
    case "openai":
      return createOpenAI({ ...key, ...base });
    case "anthropic":
      return createAnthropic({ ...key, ...base });
    case "google":
      return createGoogleGenerativeAI({ ...key, ...base });
    case "openrouter":
      return createOpenAI({
        ...key,
        baseURL: cfg.baseUrl ?? OPENROUTER_BASE_URL,
      });
    case "local":
      return createOpenAI({ apiKey: apiKey ?? "local", ...base });
  }
}

/**
 * Build the provider map (provider name → instance) for the lanes in `settings` — the input to
 * `buildRegistryResolver`. Covers exactly the providers the lanes reference, one instance per
 * provider name (the registry keys on it).
 */
export function defaultProviders(
  settings: AiSettings,
): Record<string, ProviderV2> {
  const providers: Record<string, ProviderV2> = {};
  for (const cfg of Object.values(settings.lanes)) {
    if (providers[cfg.provider] === undefined) {
      providers[cfg.provider] = providerFor(cfg);
    }
  }
  return providers;
}
