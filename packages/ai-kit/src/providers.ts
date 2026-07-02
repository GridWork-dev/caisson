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
import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createAzure } from "@ai-sdk/azure";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { ProviderV2 } from "@ai-sdk/provider";
import { ValidationError } from "@caisson/kernel";
import type { AiSettings, ProviderConfig } from "@caisson/ai-config";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

/**
 * SSRF guard for a buyer-supplied provider `baseUrl` (a lane config / per-tenant BYOK value). The
 * value flows straight into the SDK adapter's outbound fetch, so an unguarded `http://169.254.169.254`
 * (cloud metadata), a loopback/private host, or a `file:`/`data:` scheme would let a misconfigured or
 * hostile lane reach internal services. Mirrors the local-ai egress guard's floor — https-only, no
 * credentials-in-URL — but keeps a DENYLIST, not a host allowlist: buyers may self-host a gateway on
 * any PUBLIC https host; they just cannot point a lane at a private/loopback/link-local/metadata
 * address. Applied once per {@link providerFor}, so every provider path (incl. openrouter's default)
 * inherits it.
 *
 * @throws ValidationError on a malformed URL, a non-https scheme, credentials in the URL, or a
 *   private-range / localhost / `.local` host.
 */
function assertSafeBaseUrl(baseUrl: string): void {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new ValidationError("provider baseUrl rejected: malformed URL");
  }
  if (url.protocol !== "https:") {
    // https only — blocks http:, and data:/file:/javascript: smuggling. Never auto-prepend a scheme.
    throw new ValidationError("provider baseUrl rejected: non-https scheme", {
      scheme: url.protocol,
    });
  }
  if (url.username !== "" || url.password !== "") {
    throw new ValidationError("provider baseUrl rejected: credentials in URL");
  }
  if (isPrivateHost(url.hostname)) {
    // The WHATWG parser canonicalizes decimal/octal/hex/short-form IPv4 to dotted-quad before this
    // check, so those encodings are covered for free.
    // ponytail: literal-host denylist — a PUBLIC hostname that RESOLVES to a private IP (DNS
    // rebinding) is not caught here; add resolve-time pinning only if a deployment's threat model
    // needs it.
    throw new ValidationError(
      "provider baseUrl rejected: private/loopback host",
      {
        host: url.hostname,
      },
    );
  }
}

/** True if `hostname` (as returned by `URL.hostname`) is a loopback/private/link-local/metadata literal. */
function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local")) return true;
  if (host.startsWith("[") && host.endsWith("]")) {
    const v6 = host.slice(1, -1);
    return (
      v6 === "::1" || // loopback
      v6 === "::" || // unspecified
      /^f[cd]/.test(v6) || // fc00::/7 unique-local
      /^fe[89ab]/.test(v6) || // fe80::/10 link-local
      v6.startsWith("::ffff:") // IPv4-mapped — never a real provider host, reject wholesale
    );
  }
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (m === null) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  return (
    a === 0 || // 0.0.0.0/8 (incl. 0.0.0.0)
    a === 127 || // 127/8 loopback
    a === 10 || // 10/8 private
    (a === 172 && b >= 16 && b <= 31) || // 172.16/12 private
    (a === 192 && b === 168) || // 192.168/16 private
    (a === 169 && b === 254) // 169.254/16 link-local (incl. cloud metadata 169.254.169.254)
  );
}

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
  // default and the `local`/`ollama` self-hosted hosts) inherits it.
  if (cfg.baseUrl !== undefined) assertSafeBaseUrl(cfg.baseUrl);
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
    // `ollama` serves an OpenAI-compatible endpoint, so it rides the same adapter as `local` — the
    // buyer names the `baseUrl` of their host (no localhost default, per the security floor).
    case "local":
    case "ollama":
      return createOpenAI({ apiKey: apiKey ?? "local", ...base });
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
