// The live provider transport (ADR-0059/0011). Maps each ai-config lane's provider name to a real
// Vercel AI SDK adapter — the ONLY place in the package graph a vendor SDK is imported (the gateway
// hides it behind `infer()`; base packages may never import one, enforced by the Gate-2 boundary).
//
// This is the LIVE transport: the one path NOT exercised in CI. Every test injects a mock
// `LanguageModelV2` and never reaches a real adapter, so no provider key, model call, or network
// request happens in the gate (the SPEC's zero-live-call invariant). A buyer's BYOK key is read from
// the env var the lane NAMES (`apiKeyEnv`, ADR-0011) — ai-config never reads the key itself; the SDK
// adapter does, here, at the edge. `openrouter`/`local`/`ollama` are OpenAI-API-compatible, so they
// ride `@ai-sdk/openai-compatible` (ADR-0201) — NOT `createOpenAI`: since AI SDK v5 the OpenAI
// adapter defaults `languageModel()` to the RESPONSES API, so a registry-resolved live call would
// POST `{baseURL}/responses` (beta on OpenRouter, absent on Ollama) instead of `/chat/completions`.
// A live-only defect — every CI path injects a mock model, which is exactly why it survived.
import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createAzure } from "@ai-sdk/azure";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { ProviderV2 } from "@ai-sdk/provider";
import {
  assertSafePublicUrl,
  ssrfGuardedFetch,
  ValidationError,
} from "@caisson/kernel";
import type { AiSettings, ProviderConfig } from "@caisson/ai-config";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

/**
 * Build the real provider instance for one lane config. The key is `keyOverride` when supplied (the
 * per-tenant BYOK path, ADR-0162: a decrypted tenant key) else read from the env var the lane names
 * (`apiKeyEnv`, ADR-0011). This package still never persists a key — it only reaches for the value at
 * this edge, to hand to the SDK adapter.
 */
export function providerFor(
  cfg: ProviderConfig,
  keyOverride?: string,
): ProviderV2 {
  const apiKey =
    keyOverride ??
    (cfg.apiKeyEnv !== undefined ? process.env[cfg.apiKeyEnv] : undefined);
  const key = apiKey !== undefined ? { apiKey } : {};
  // SSRF guard once, before the switch, so every provider path (incl. openrouter's `cfg.baseUrl ??`
  // default and the `local`/`ollama` self-hosted hosts) inherits it. The kernel guard is the shared
  // policy source (@caisson/kernel/ssrf) — https-only, no-creds, private/loopback DENYLIST.
  if (cfg.baseUrl !== undefined) assertSafePublicUrl(cfg.baseUrl);
  const base = cfg.baseUrl !== undefined ? { baseURL: cfg.baseUrl } : {};
  // For a CUSTOM (config-supplied) baseUrl, wrap the adapter's outbound fetch with the resolve-time
  // SSRF re-check (DNS-rebinding defense, Strix vuln-0004) — the SDK owns the fetch, so this is the
  // only seam to resolve the host at call time. Default provider hosts are trusted constants and skip
  // the per-call DNS lookup (empty spread). Bedrock is AWS-SigV4 (not a fetch-configurable adapter),
  // so it keeps the sync literal guard above only.
  // The SDK's `fetch` option is typed `typeof globalThis.fetch` (which includes the `preconnect`
  // static); the kernel guard is a plain fetch wrapper without it (kernel stays SDK-type-agnostic —
  // Gate-2). The cast is safe: a custom `fetch` the adapter calls per-request, never `.preconnect`.
  const guarded =
    cfg.baseUrl !== undefined
      ? { fetch: ssrfGuardedFetch as typeof fetch }
      : {};
  switch (cfg.provider) {
    case "openai":
      return createOpenAI({ ...key, ...base, ...guarded });
    case "anthropic":
      return createAnthropic({ ...key, ...base, ...guarded });
    case "google":
      return createGoogleGenerativeAI({ ...key, ...base, ...guarded });
    // The three OpenAI-COMPATIBLE (not OpenAI) backends ride `createOpenAICompatible` (ADR-0201):
    // its `languageModel()` IS the chat model, pinning live calls to `/chat/completions` — where
    // `createOpenAI` would default to the v5 Responses API (see the file header). `includeUsage`
    // opts STREAMING responses into usage reporting (`stream_options.include_usage`) so the meter's
    // reconcile leg trues to the provider's actuals instead of the chars/4 estimate.
    case "openrouter":
      return createOpenAICompatible({
        name: "openrouter",
        ...key,
        ...guarded,
        baseURL: cfg.baseUrl ?? OPENROUTER_BASE_URL,
        includeUsage: true,
      });
    // `ollama` serves an OpenAI-compatible endpoint, so it rides the same adapter as `local` — the
    // buyer names the `baseUrl` of their host (no localhost default, per the security floor).
    case "local":
    case "ollama":
      if (cfg.baseUrl === undefined) {
        // Fail closed (ADR-0201): `createOpenAI` used to silently fall back to api.openai.com for a
        // baseUrl-less self-hosted lane — a misdirected live call, never the buyer's host. The
        // compatible adapter REQUIRES a baseURL, and the security floor forbids a localhost default.
        throw new ValidationError(
          "provider baseUrl required for a local/ollama lane",
          { provider: cfg.provider },
        );
      }
      return createOpenAICompatible({
        name: cfg.provider,
        apiKey: apiKey ?? "local",
        ...guarded,
        baseURL: cfg.baseUrl,
        includeUsage: true,
      });
    // AWS Bedrock (ADR-0160): SigV4, a two-part credential + region. `apiKeyEnv` names the
    // access-key-id env var, `apiSecretEnv` the secret-access-key env var; omit both to fall back to
    // the AWS SDK's default credential chain. `region` defaults to `AWS_REGION` when unset.
    case "bedrock": {
      const secret =
        cfg.apiSecretEnv !== undefined
          ? process.env[cfg.apiSecretEnv]
          : undefined;
      return createAmazonBedrock({
        ...(cfg.region !== undefined ? { region: cfg.region } : {}),
        ...(apiKey !== undefined ? { accessKeyId: apiKey } : {}),
        ...(secret !== undefined ? { secretAccessKey: secret } : {}),
        ...base,
      });
    }
    // Azure OpenAI (ADR-0160): `model` addresses a DEPLOYMENT; `baseUrl` is the resource endpoint and
    // `apiVersion` pins the per-call API version.
    case "azure-openai":
      return createAzure({
        ...key,
        ...base,
        ...guarded,
        ...(cfg.apiVersion !== undefined ? { apiVersion: cfg.apiVersion } : {}),
      });
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
    // A per-tenant (BYOK) lane has no boot-time key — it is resolved per-request with the tenant's
    // decrypted key (ADR-0162), so it is skipped here (there is nothing to build without a tenant).
    if (cfg.keySource === "tenant") continue;
    if (providers[cfg.provider] === undefined) {
      providers[cfg.provider] = providerFor(cfg);
    }
  }
  return providers;
}
