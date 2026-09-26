// ADR-0162 — the BYOK-aware `ModelResolver`. An env-pointer lane (the default) resolves exactly
// as before, through the boot-time provider registry (`buildRegistryResolver`). A per-tenant lane
// (`keySource: "tenant"`) instead pulls the caller's own decrypted key via the injected
// `resolveTenantKey` port and builds a provider for it (`providerFor(cfg, key)`), so one adopter's
// tenants can each bring their own provider account. The port hides the encrypted store + `withTenant`
// + field-crypto behind one function the HOST wires per deployment — this file never touches a DB or a
// crypto context, keeping the gateway package DB-free.
import { ValidationError } from "@caisson-sh/kernel";
import { resolveProvider, type AiSettings } from "@caisson-sh/ai-config";
import type { LanguageModelV4, ProviderV4 } from "@ai-sdk/provider";
import { buildRegistryResolver, type ModelResolver } from "./gateway.ts";
import { defaultProviders, providerFor } from "./providers.ts";

/**
 * Resolve a tenant's decrypted provider key (or `undefined` if none is stored). The HOST supplies this
 * — e.g. `(accountId, provider) => withTenant(pool, accountId, (tx) => getTenantProviderKey(tx,
 * cryptoContextFor(accountId), provider))`. Required only when a lane uses `keySource: "tenant"`.
 */
export type TenantKeyResolver = (
  accountId: string,
  provider: string,
) => Promise<string | undefined>;

export interface ByokResolverOptions {
  readonly settings: AiSettings;
  /** The env-lane provider registry; defaults to `defaultProviders(settings)` (skips tenant lanes). */
  readonly providers?: Record<string, ProviderV4>;
  /** The per-tenant key port — required if any lane is `keySource: "tenant"`. */
  readonly resolveTenantKey?: TenantKeyResolver;
  /** Injectable clock for the per-tenant client cache (defaults to `Date.now`). */
  readonly now?: () => number;
  /** Per-tenant built-client cache TTL in ms (default 5 min); a rotation takes effect within it. */
  readonly cacheTtlMs?: number;
  /**
   * The outbound-fetch deadline (ADR-0213) threaded to every provider this resolver builds — the
   * default env registry (when `providers` is omitted) and every per-tenant BYOK provider alike.
   * Defaults to `providerFor`/`defaultProviders`' own `DEFAULT_PROVIDER_TIMEOUT_MS`.
   */
  readonly timeoutMs?: number;
}

const DEFAULT_CACHE_TTL_MS = 5 * 60_000;

/**
 * The pricebook `keySource` discriminator (ADR-0182) for a lane — `"env"` (the operator's platform
 * key) or `"tenant"` (a per-tenant BYOK key). Feed the result into `@caisson-sh/pricebook`'s
 * `resolveActionCost(action, book, keySource)` so a metered action on a BYOK lane debits 0 credits
 * while metering stays untouched — mirrors exactly the branch `buildByokResolver` itself takes below.
 */
export function laneKeySource(
  settings: AiSettings,
  lane: string,
): "env" | "tenant" {
  return resolveProvider(settings, lane).keySource ?? "env";
}

/**
 * Build a `ModelResolver` that serves both env-pointer and per-tenant BYOK lanes. Env lanes delegate to
 * `buildRegistryResolver` unchanged; tenant lanes decrypt-and-build per request, with a short-TTL cache
 * of the BUILT provider (never raw key bytes) keyed on `(accountId, provider)` so a rotation is picked
 * up within the TTL.
 */
export function buildByokResolver(opts: ByokResolverOptions): ModelResolver {
  const providerMap =
    opts.providers ?? defaultProviders(opts.settings, opts.timeoutMs);
  const envResolver = buildRegistryResolver(opts.settings, providerMap);
  const now = opts.now ?? (() => Date.now());
  const ttlMs = opts.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  // A plain Map, one entry per (account, provider). Bounded by distinct BYOK tenants × their
  // providers; swap for an LRU/size-cap if a deployment accumulates enough tenants to matter.
  const cache = new Map<string, { provider: ProviderV4; expiresAt: number }>();

  return async (lane, accountId): Promise<LanguageModelV4> => {
    const cfg = resolveProvider(opts.settings, lane);
    if (cfg.keySource !== "tenant") {
      return envResolver(lane);
    }
    // --- per-tenant BYOK lane ---
    if (cfg.provider === "bedrock") {
      // Bedrock needs a two-part credential (+region); the single-secret tenant store can't express it.
      throw new ValidationError(
        "per-tenant BYOK is not supported for bedrock (multi-part credential) — use an env lane",
        { provider: cfg.provider },
      );
    }
    if (accountId === undefined) {
      throw new ValidationError(
        "a per-tenant (BYOK) lane requires an accountId",
        {
          lane,
        },
      );
    }
    if (opts.resolveTenantKey === undefined) {
      throw new ValidationError(
        "a per-tenant (BYOK) lane requires a resolveTenantKey port",
        { lane },
      );
    }
    const cacheKey = `${accountId} ${cfg.provider}`;
    const hit = cache.get(cacheKey);
    if (hit !== undefined && hit.expiresAt > now()) {
      return hit.provider.languageModel(cfg.model);
    }
    const key = await opts.resolveTenantKey(accountId, cfg.provider);
    if (key === undefined || key.length === 0) {
      throw new ValidationError(
        "no BYOK provider key is stored for this tenant/provider",
        { accountId, provider: cfg.provider },
      );
    }
    const provider = providerFor(cfg, key, opts.timeoutMs);
    cache.set(cacheKey, { provider, expiresAt: now() + ttlMs });
    return provider.languageModel(cfg.model);
  };
}
