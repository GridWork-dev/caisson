// The metered-embeddings gateway (ADR-0213) — `embed()`/`embedMany()` join `infer()`/`inferStream()`
// through the SAME ai-meter chokepoint (reserve-before/reconcile-after), provider-agnostic via the
// ai-config lane, BYOK-routed exactly like the language-model gateway. Mirrors `gateway.ts`'s
// pipeline minus prompt-registry render and guardrails: an embed input feeds a vector index, not a
// moderated chat turn — guardrails-on-embed-input/output is explicitly out of scope for embeddings.
//
//   resolve → reserve (cap/credit-check) → provider call → record usage → reconcile
//
// The reservation carries NO `maxOutputTokens` — `@caisson-sh/ai-meter`'s reserve schema requires it
// `positive()` when supplied, and an embedding call has no output-token concept — so the estimate
// rounds up over the meter's `DEFAULT_OUTPUT_TOKENS` phantom output budget (the same estimator
// `infer()` uses). The ACTUAL usage this file reconciles against always carries `outputTokens: 0`,
// so that phantom leg refunds in full at reconcile regardless of the price book's `outputPerMTok`
// rate for the model — a buyer is billed for input tokens only, exactly what an embedding call
// consumes. Price key stays `provider/model`: an embedding model is just another `PriceBook` row: no
// `PriceBookEntry` schema change (a dedicated flat-rate embedding SKU, distinct from per-token
// pricing, is a separate cross-package pricing decision, deferred for now).
import { randomUUID } from "node:crypto";
import {
  createProviderRegistry,
  embed as sdkEmbed,
  embedMany as sdkEmbedMany,
} from "ai";
import type { Embedding, EmbeddingModelUsage } from "ai";
import type { EmbeddingModelV4, ProviderV4 } from "@ai-sdk/provider";
import type { AiSettings } from "@caisson-sh/ai-config";
import { resolveProvider } from "@caisson-sh/ai-config";
import { estimateUsage, reconcile, reserve } from "@caisson-sh/ai-meter";
import type {
  MeterConfig,
  ReconcileResult,
  ReserveResult,
  Usage,
} from "@caisson-sh/ai-meter";
import { withTenant } from "@caisson-sh/tenancy-rls";
import type { Transactor } from "@caisson-sh/tenancy-rls";
import {
  assertUsageFitsLedger,
  canPersistUsage,
  normalizeEmbeddingUsage,
} from "./usage.ts";

/**
 * Resolve a configured lane to its backing TEXT embedding model. Production builds this over a
 * provider registry (`buildEmbeddingRegistryResolver`); tests inject a mock `EmbeddingModelV4`.
 * Mirrors `gateway.ts`'s `ModelResolver` for the embeddings surface.
 */
export type EmbeddingModelResolver = (
  lane: string,
  accountId?: string,
) => EmbeddingModelV4 | Promise<EmbeddingModelV4>;

export interface EmbedOptions {
  /**
   * The tenant pool. `embed`/`embedMany` open their OWN `withTenant` scopes — reserve and reconcile
   * each run in a separate transaction, so no DB transaction is held across the provider call.
   */
  readonly tx: Transactor;
  /** The RLS subject every leg scopes to (`withTenant(accountId)`). */
  readonly accountId: string;
  /** ai-config lanes — the lane's `{ provider, model }` the meter prices the call against. */
  readonly settings: AiSettings;
  /** Lane → backing embedding model (a mock in tests, a registry in prod). */
  readonly resolveModel: EmbeddingModelResolver;
  /** Correlation + idempotency id shared by both meter legs. Defaults to a fresh uuid. */
  readonly callId?: string;
  /** Meter config (price book, denomination, scope, clock). */
  readonly meter?: MeterConfig;
}

export interface EmbedResult {
  /** The correlation id used for both meter legs (echo it on a retry to settle once). */
  readonly callId: string;
  /** The value's embedding vector. */
  readonly embedding: Embedding;
  /** The usage the reconcile leg settled against (the provider's reported tokens, or a chars/4
   *  estimate when the provider reported none — see the file header). */
  readonly usage: Usage;
  readonly reserved: ReserveResult;
  readonly reconciled: ReconcileResult;
}

export interface EmbedManyResult {
  /** The correlation id used for both meter legs (one reservation/reconcile pair for the batch). */
  readonly callId: string;
  /** The embedding vectors, in the same order as the input `values`. */
  readonly embeddings: readonly Embedding[];
  readonly usage: Usage;
  readonly reserved: ReserveResult;
  readonly reconciled: ReconcileResult;
}

const ZERO_USAGE: Usage = {
  inputTokens: 0,
  outputTokens: 0,
  cachedInputTokens: 0,
};

/**
 * Build an `EmbeddingModelResolver` from a provider registry over the ai-config lanes: each lane's
 * `{ provider, model }` resolves to `registry.textEmbeddingModel("provider:model")`. Mirrors
 * `gateway.ts`'s `buildRegistryResolver` — provider instances are injected (the real `@ai-sdk/*`
 * adapters in prod via `defaultProviders`, a double in tests), so this file depends only on the
 * AI-SDK core, never a vendor SDK directly.
 */
export function buildEmbeddingRegistryResolver(
  settings: AiSettings,
  providers: Record<string, ProviderV4>,
): EmbeddingModelResolver {
  const registry = createProviderRegistry(providers);
  return (lane: string): EmbeddingModelV4 => {
    const cfg = resolveProvider(settings, lane);
    return registry.embeddingModel(`${cfg.provider}:${cfg.model}`);
  };
}

/**
 * Run one metered embedding call through the gateway. Throws (and never calls the model / never
 * charges) when the wallet is short (`InsufficientCreditsError` 402) or the breaker is open
 * (`SpendCapError` 402) — same fail-closed contract as `infer()`. A failed provider call refunds the
 * reservation. No prompt-registry render and no guardrails run on this path: an
 * embed input feeds a vector index, not a moderated chat turn.
 */
export async function embed(
  lane: string,
  value: string,
  opts: EmbedOptions,
): Promise<EmbedResult> {
  const { tx, accountId, settings } = opts;
  const callId = opts.callId ?? randomUUID();
  const cfg = resolveProvider(settings, lane);
  const reservationMessages = [{ role: "user", content: value }];
  const reservationUsage = estimateUsage(reservationMessages);
  assertUsageFitsLedger(reservationUsage, cfg.provider, cfg.model, opts.meter);

  // 1. cap/credit-check — reserve the estimate up front (402 on a short wallet or open breaker; the
  //    model is NOT called before this). No maxOutputTokens: see the file header for why the
  //    resulting phantom output estimate is refunded in full at reconcile.
  const reserved = await withTenant(tx, accountId, (t) =>
    reserve(t, {
      accountId,
      callId,
      provider: cfg.provider,
      model: cfg.model,
      lane,
      messages: reservationMessages,
      ...(cfg.keySource !== undefined ? { keySource: cfg.keySource } : {}),
      ...(opts.meter !== undefined ? { config: opts.meter } : {}),
    }),
  );

  // Settle to a given usage in its own transaction; idempotent on `callId` (a retry settles once).
  const settle = (usage: Usage): Promise<ReconcileResult> =>
    withTenant(tx, accountId, (t) =>
      reconcile(t, {
        accountId,
        callId,
        provider: cfg.provider,
        model: cfg.model,
        lane,
        reservedCredits: reserved.reservedCredits,
        usage,
        windowKey: reserved.windowKey,
        ...(cfg.keySource !== undefined ? { keySource: cfg.keySource } : {}),
        ...(opts.meter !== undefined ? { config: opts.meter } : {}),
      }),
    );

  // 2. provider call — a failure refunds the reservation (reconcile to zero) so a non-delivering
  //    call never charges, exactly like `infer()`'s try/catch.
  let embedding: Embedding;
  let rawUsage: EmbeddingModelUsage;
  try {
    const model = await opts.resolveModel(lane, accountId);
    const result = await sdkEmbed({ model, value });
    embedding = result.embedding;
    rawUsage = result.usage;
  } catch (err) {
    await settle(ZERO_USAGE);
    throw err;
  }

  // 3. record usage + reconcile.
  const normalized = normalizeEmbeddingUsage(rawUsage, [value]);
  const deterministic = normalizeEmbeddingUsage({}, [value]);
  const usage = canPersistUsage(normalized, cfg.provider, cfg.model, opts.meter)
    ? normalized
    : canPersistUsage(deterministic, cfg.provider, cfg.model, opts.meter)
      ? deterministic
      : reservationUsage;
  const reconciled = await settle(usage);

  return { callId, embedding, usage, reserved, reconciled };
}

/**
 * Run one metered batch-embedding call through the gateway — the `embedMany()` counterpart of
 * `embed()`. Same chokepoint contract, one reservation/reconcile pair over the whole batch (not one
 * per value): the meter never sizes credits or `usage_event` rows finer than the call the buyer made.
 */
export async function embedMany(
  lane: string,
  values: readonly string[],
  opts: EmbedOptions,
): Promise<EmbedManyResult> {
  const { tx, accountId, settings } = opts;
  const callId = opts.callId ?? randomUUID();
  const cfg = resolveProvider(settings, lane);
  const reservationMessages = values.map((value) => ({
    role: "user",
    content: value,
  }));
  const reservationUsage = estimateUsage(reservationMessages);
  assertUsageFitsLedger(reservationUsage, cfg.provider, cfg.model, opts.meter);

  const reserved = await withTenant(tx, accountId, (t) =>
    reserve(t, {
      accountId,
      callId,
      provider: cfg.provider,
      model: cfg.model,
      lane,
      messages: reservationMessages,
      ...(cfg.keySource !== undefined ? { keySource: cfg.keySource } : {}),
      ...(opts.meter !== undefined ? { config: opts.meter } : {}),
    }),
  );

  const settle = (usage: Usage): Promise<ReconcileResult> =>
    withTenant(tx, accountId, (t) =>
      reconcile(t, {
        accountId,
        callId,
        provider: cfg.provider,
        model: cfg.model,
        lane,
        reservedCredits: reserved.reservedCredits,
        usage,
        windowKey: reserved.windowKey,
        ...(cfg.keySource !== undefined ? { keySource: cfg.keySource } : {}),
        ...(opts.meter !== undefined ? { config: opts.meter } : {}),
      }),
    );

  let embeddings: readonly Embedding[];
  let rawUsage: EmbeddingModelUsage;
  try {
    const model = await opts.resolveModel(lane, accountId);
    const result = await sdkEmbedMany({ model, values: [...values] });
    embeddings = result.embeddings;
    rawUsage = result.usage;
  } catch (err) {
    await settle(ZERO_USAGE);
    throw err;
  }

  const normalized = normalizeEmbeddingUsage(rawUsage, values);
  const deterministic = normalizeEmbeddingUsage({}, values);
  const usage = canPersistUsage(normalized, cfg.provider, cfg.model, opts.meter)
    ? normalized
    : canPersistUsage(deterministic, cfg.provider, cfg.model, opts.meter)
      ? deterministic
      : reservationUsage;
  const reconciled = await settle(usage);

  return { callId, embeddings, usage, reserved, reconciled };
}
