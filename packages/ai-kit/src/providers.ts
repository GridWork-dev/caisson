// The live provider transport (ADR-0059/0011). Maps each ai-config lane's provider name to a real
// Vercel AI SDK adapter — the ONLY place in the package graph a vendor SDK is imported (the gateway
// hides it behind `infer()`; base packages may never import one directly).
//
// This is the LIVE transport: the one path NOT exercised in CI. Every test injects a mock
// `LanguageModelV4` and never reaches a real adapter, so no provider key, model call, or network
// request happens in the test suite (the package's zero-live-call invariant). A buyer's BYOK key is read from
// the env var the lane NAMES (`apiKeyEnv`, ADR-0011) — ai-config never reads the key itself; the SDK
// adapter does, here, at the edge. `openrouter`/`local`/`ollama` are OpenAI-API-compatible, so they
// ride `@ai-sdk/openai-compatible` (ADR-0201) — NOT `createOpenAI`: the OpenAI
// adapter defaults `languageModel()` to the RESPONSES API, so a registry-resolved live call would
// POST `{baseURL}/responses` (beta on OpenRouter, absent on Ollama) instead of `/chat/completions`.
// A live-only defect — every CI path injects a mock model, which is exactly why it survived.
//
// Fetch deadline (ADR-0213): every factory below receives a `fetch` bound to `timeoutMs` instead of
// the ambient global fetch — without it a hung live call blocks the process unbounded, violating the
// repo-wide fetchWithTimeout floor (`identity/security.md`).
import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createAzure } from "@ai-sdk/azure";
import { createGoogle } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { ProviderV4 } from "@ai-sdk/provider";
import {
  assertSafePublicUrl,
  fetchWithTimeout,
  ssrfGuardedFetch,
  ValidationError,
} from "@caisson-sh/kernel/node";
import type { AiSettings, ProviderConfig } from "@caisson-sh/ai-config";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
// Hardcoded default hosts for the three OpenAI-compatible named vendors (ADR-0171 board lock
// 2026-07-06) — verified against each vendor's current docs (see the PR/changeset for citations).
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const MISTRAL_BASE_URL = "https://api.mistral.ai/v1";
const TOGETHER_BASE_URL = "https://api.together.xyz/v1";

/** The deadline (ms) bound to a provider factory's outbound `fetch` when the caller does not
 *  override `timeoutMs` on {@link providerFor} / {@link defaultProviders}. */
export const DEFAULT_PROVIDER_TIMEOUT_MS = 60_000;

/**
 * Wrap `fetchWithTimeout` (`@caisson-sh/kernel`) to the AI-SDK's `fetch?: FetchFunction` option shape
 * (`typeof globalThis.fetch`). Every `create*` factory below is handed this instead of the ambient
 * global fetch, so a stalling live call aborts at `timeoutMs` instead of hanging the process.
 *
 * Exported (not just internal to {@link providerFor}) so `providers.test.ts` can prove the deadline
 * directly against a loopback stub — `providerFor`'s own `assertSafeBaseUrl` SSRF guard rejects any
 * local/loopback `baseUrl`, so a full provider→real-fetch round trip can never be exercised locally;
 * this is the one seam that IS testable without a live vendor call (the package's zero-live-call
 * invariant, ADR-0059).
 */
export function timeoutFetch(timeoutMs: number): typeof fetch {
  // Two casts, both inert at runtime. (1) `fetchWithTimeout`'s declared param is
  // `string | URL` (narrower than `RequestInfo | URL`) — every SDK adapter here only ever calls it
  // with a string URL, and `fetch()` itself accepts a `Request` identically either way. (2) Bun's
  // ambient `typeof fetch` additionally requires a static `preconnect` method (a Bun-only fetch
  // extension) that no `@ai-sdk/*` adapter ever calls — the outer cast just satisfies the return
  // type's shape, not a real omission the SDK would notice.
  const withTimeout = (input: string | URL | Request, init?: RequestInit) =>
    fetchWithTimeout(input as string | URL, init, { timeoutMs });
  return withTimeout as typeof fetch;
}

/**
 * Build the real provider instance for one lane config. The key is `keyOverride` when supplied (the
 * per-tenant BYOK path, ADR-0162: a decrypted tenant key) else read from the env var the lane names
 * (`apiKeyEnv`, ADR-0011). This package still never persists a key — it only reaches for the value at
 * this edge, to hand to the SDK adapter. `timeoutMs` (default {@link DEFAULT_PROVIDER_TIMEOUT_MS})
 * bounds every outbound fetch this provider instance makes.
 */
export function providerFor(
  cfg: ProviderConfig,
  keyOverride?: string,
  timeoutMs: number = DEFAULT_PROVIDER_TIMEOUT_MS,
): ProviderV4 {
  const apiKey =
    keyOverride ??
    (cfg.apiKeyEnv !== undefined ? process.env[cfg.apiKeyEnv] : undefined);
  const key = apiKey !== undefined ? { apiKey } : {};
  // SSRF guard once, before the switch, so every provider path (incl. openrouter's `cfg.baseUrl ??`
  // default and the `local`/`ollama` self-hosted hosts) inherits it. The kernel guard is the shared
  // policy source (@caisson-sh/kernel/ssrf) — https-only, no-creds, private/loopback DENYLIST.
  if (cfg.baseUrl !== undefined) assertSafePublicUrl(cfg.baseUrl);
  const base = cfg.baseUrl !== undefined ? { baseURL: cfg.baseUrl } : {};
  // ONE transport fetch per instance — the deadline floor and the SSRF re-check must COMPOSE, never
  // compete as two `fetch` spreads (the later spread would silently clobber the earlier guard).
  // A CUSTOM (config-supplied) baseUrl gets the kernel `ssrfGuardedFetch` — the resolve-time DNS
  // re-check (DNS-rebinding defense, Strix vuln-0004) + forced `redirect: "error"` — bounded to this
  // instance's `timeoutMs`. Default provider hosts are trusted constants that skip the per-call DNS
  // lookup; they get the plain deadline fetch. Bedrock is AWS-SigV4 and keeps the sync literal guard
  // above plus the deadline only (`...deadline` at its site).
  // The SDK's `fetch` option is typed `typeof globalThis.fetch` (which includes Bun's `preconnect`
  // static); both wrappers are plain per-request fetches the adapter never `.preconnect`s — the cast
  // is inert (same rationale as `timeoutFetch`'s own cast).
  const deadline = { fetch: timeoutFetch(timeoutMs) };
  const transport =
    cfg.baseUrl !== undefined
      ? {
          fetch: ((input: string | URL | Request, init?: RequestInit) =>
            ssrfGuardedFetch(input, init, { timeoutMs })) as typeof fetch,
        }
      : deadline;
  switch (cfg.provider) {
    case "openai":
      return createOpenAI({ ...key, ...base, ...transport });
    case "anthropic":
      return createAnthropic({ ...key, ...base, ...transport });
    case "google":
      return createGoogle({ ...key, ...base, ...transport });
    // The three OpenAI-COMPATIBLE (not OpenAI) backends ride `createOpenAICompatible` (ADR-0201):
    // its `languageModel()` IS the chat model, pinning live calls to `/chat/completions` — where
    // `createOpenAI` would default to the Responses API (see the file header). `includeUsage`
    // opts STREAMING responses into usage reporting (`stream_options.include_usage`) so the meter's
    // reconcile leg trues to the provider's actuals instead of the chars/4 estimate.
    case "openrouter":
      return createOpenAICompatible({
        name: "openrouter",
        ...key,
        baseURL: cfg.baseUrl ?? OPENROUTER_BASE_URL,
        includeUsage: true,
        ...transport,
      });
    // Groq / Mistral / Together (ADR-0171 board lock 2026-07-06): real hosted OpenAI-compatible
    // vendors, each with a hardcoded default `baseUrl` (overridable via `cfg.baseUrl`, like
    // `openrouter`'s — e.g. to point at a gateway/proxy). Unlike `local`/`ollama`'s "local" placeholder
    // key, these are paid vendor APIs: a missing key fails closed instead of reaching the vendor with
    // an empty/absent Authorization header.
    case "groq":
    case "mistral":
    case "together": {
      if (apiKey === undefined) {
        throw new ValidationError(
          `provider apiKey required for the ${cfg.provider} lane (name its env var via apiKeyEnv)`,
          { provider: cfg.provider },
        );
      }
      const defaultBaseUrl =
        cfg.provider === "groq"
          ? GROQ_BASE_URL
          : cfg.provider === "mistral"
            ? MISTRAL_BASE_URL
            : TOGETHER_BASE_URL;
      return createOpenAICompatible({
        name: cfg.provider,
        apiKey,
        baseURL: cfg.baseUrl ?? defaultBaseUrl,
        includeUsage: true,
        ...transport,
      });
    }
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
        baseURL: cfg.baseUrl,
        includeUsage: true,
        ...transport,
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
        ...deadline,
      });
    }
    // Azure OpenAI (ADR-0160): `model` addresses a DEPLOYMENT; `baseUrl` is the resource endpoint and
    // `apiVersion` pins the per-call API version. AI SDK v6 changed `languageModel()` to the
    // Responses API, so override that registry entry with `chat()` to preserve Caisson's established
    // Chat Completions transport while retaining the provider's embedding/image capabilities.
    case "azure-openai": {
      const azure = createAzure({
        ...key,
        ...base,
        ...(cfg.apiVersion !== undefined ? { apiVersion: cfg.apiVersion } : {}),
        ...transport,
      });
      return { ...azure, languageModel: (modelId) => azure.chat(modelId) };
    }
  }
}

/**
 * Build the provider map (provider name → instance) for the lanes in `settings` — the input to
 * `buildRegistryResolver`. Covers exactly the providers the lanes reference, one instance per
 * provider name (the registry keys on it). `timeoutMs` threads to every built {@link providerFor}.
 */
export function defaultProviders(
  settings: AiSettings,
  timeoutMs: number = DEFAULT_PROVIDER_TIMEOUT_MS,
): Record<string, ProviderV4> {
  const providers: Record<string, ProviderV4> = {};
  for (const cfg of Object.values(settings.lanes)) {
    // A per-tenant (BYOK) lane has no boot-time key — it is resolved per-request with the tenant's
    // decrypted key (ADR-0162), so it is skipped here (there is nothing to build without a tenant).
    if (cfg.keySource === "tenant") continue;
    if (providers[cfg.provider] === undefined) {
      providers[cfg.provider] = providerFor(cfg, undefined, timeoutMs);
    }
  }
  return providers;
}
