// The metered-inference gateway (ADR-0059) — the enforced chokepoint for every AI feature. One
// `infer(lane, input, opts)` composes the four base primitives in a fixed, fail-closed order:
//
//   resolve → render → input-guard → cap/credit-check (reserve) → provider call → record usage →
//   output-guard → reconcile
//
// Each step is a base primitive (down-only, ADR-0003 — the gateway never imports another edition):
//   - prompt-registry  resolvePrompt + renderVersion  (a `name@version|alias` ref → escaped messages)
//   - guardrails       guardInput / guardOutput + detokenizePii  (moderation + PII redact / restore)
//   - ai-meter         reserve / reconcile  (debit-before-spend 402, caps + breaker, true-up to actual)
//   - ai-config        resolveProvider      (lane → provider/model coordinates; no provider literal)
//
// The backing model is INJECTED (`opts.resolveModel`): production wires `buildRegistryResolver` over
// the real `@ai-sdk/*` adapters, CI injects a mock `LanguageModelV2`. The Vercel AI SDK v5 surface
// (`createProviderRegistry` / `wrapLanguageModel` / `generateText`) is hidden behind `infer()`, so the
// SDK stays swappable — and the live transport is the only path not exercised by a test.
//
// Each meter leg runs in its OWN `withTenant` transaction: a DB transaction is never held open across
// the (slow, network) provider call, and reserve/reconcile are independently idempotent on `callId`.
import { randomUUID } from "node:crypto";
import { createProviderRegistry, generateText, wrapLanguageModel } from "ai";
import type {
  LanguageModelMiddleware,
  LanguageModelUsage,
  ModelMessage,
} from "ai";
import type { LanguageModelV2, ProviderV2 } from "@ai-sdk/provider";
import type { AiSettings } from "@caisson/ai-config";
import { resolveProvider } from "@caisson/ai-config";
import { reconcile, reserve } from "@caisson/ai-meter";
import type {
  MeterConfig,
  ReconcileResult,
  ReserveResult,
  Usage,
} from "@caisson/ai-meter";
import { detokenizePii, guardInput, guardOutput } from "@caisson/guardrails";
import type { GuardPolicy, GuardRuntime, PiiToken } from "@caisson/guardrails";
import { renderVersion, resolvePrompt } from "@caisson/prompt-registry";
import type { RenderedMessage } from "@caisson/prompt-registry";
import { withTenant } from "@caisson/tenancy-rls";
import type { Transactor } from "@caisson/tenancy-rls";

/**
 * Resolve a configured lane to its backing model. Production builds this over a provider registry
 * (`buildRegistryResolver`); tests inject a mock `LanguageModelV2` — the live transport stays the
 * only un-exercised path.
 */
export type ModelResolver = (
  lane: string,
) => LanguageModelV2 | Promise<LanguageModelV2>;

/** What to send the model: pre-built messages, or a registry prompt reference to resolve + render. */
export type InferInput =
  | { readonly messages: readonly RenderedMessage[] }
  | { readonly promptRef: string; readonly vars?: unknown };

/** The guardrails input/output policy + per-call runtime (tenant + event sink). */
export interface GuardConfig {
  readonly policy: GuardPolicy;
  readonly runtime: GuardRuntime;
}

export interface InferOptions {
  /**
   * The tenant pool. The gateway opens its OWN `withTenant` scopes — resolve, reserve, and reconcile
   * each run in a separate transaction, so no DB transaction is held across the provider call.
   */
  readonly tx: Transactor;
  /** The RLS subject every leg scopes to (`withTenant(accountId)`). */
  readonly accountId: string;
  /** ai-config lanes — the lane's `{ provider, model }` the meter prices the call against. */
  readonly settings: AiSettings;
  /** Lane → backing model (a mock in tests, a registry in prod). */
  readonly resolveModel: ModelResolver;
  /** Input/output guardrails (moderation + PII). */
  readonly guard: GuardConfig;
  /** Correlation + idempotency id shared by both meter legs. Defaults to a fresh uuid. */
  readonly callId?: string;
  /** Optional AI-SDK middleware wrapped around the model via `wrapLanguageModel`. */
  readonly middleware?: LanguageModelMiddleware | LanguageModelMiddleware[];
  /** Meter config (price book, denomination, scope, clock). */
  readonly meter?: MeterConfig;
  /** Output-token budget — sizes the reservation and caps the provider call. */
  readonly maxOutputTokens?: number;
}

export interface InferResult {
  /** The correlation id used for both meter legs (echo it on a retry to settle once). */
  readonly callId: string;
  /** The model's text output, with tokenized PII restored for the caller. */
  readonly text: string;
  /** The rendered + input-guarded messages actually sent to the model (PII already redacted). */
  readonly messages: readonly RenderedMessage[];
  /** The resolved prompt-version id (the version→usage link), or null for ad-hoc messages. */
  readonly promptVersionId: string | null;
  /** The provider's actual usage (what the reconcile leg trued the charge to). */
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
 * Build a `ModelResolver` from a provider registry over the ai-config lanes (ADR-0059): each lane's
 * `{ provider, model }` resolves to `registry.languageModel("provider:model")`. The provider
 * instances are injected (the real `@ai-sdk/*` adapters in prod via `defaultProviders`, a double in
 * tests), so the gateway depends only on the AI-SDK core here — the vendor SDK stays behind `infer()`.
 */
export function buildRegistryResolver(
  settings: AiSettings,
  providers: Record<string, ProviderV2>,
): ModelResolver {
  const registry = createProviderRegistry(providers);
  return (lane: string): LanguageModelV2 => {
    const cfg = resolveProvider(settings, lane);
    return registry.languageModel(`${cfg.provider}:${cfg.model}`);
  };
}

/** Normalize the AI-SDK usage shape into the meter's integer `Usage` (cached ≤ input, never a float). */
function mapUsage(u: LanguageModelUsage): Usage {
  const inputTokens = u.inputTokens ?? 0;
  const outputTokens = u.outputTokens ?? 0;
  const cachedInputTokens = Math.min(u.cachedInputTokens ?? 0, inputTokens);
  return { inputTokens, outputTokens, cachedInputTokens };
}

/** Project the prompt's role/content onto the AI-SDK `ModelMessage` union (role-discriminated). */
function toModelMessages(messages: readonly RenderedMessage[]): ModelMessage[] {
  return messages.map((m): ModelMessage => {
    const { content } = m;
    switch (m.role) {
      case "system":
        return { role: "system", content };
      case "user":
        return { role: "user", content };
      case "assistant":
        return { role: "assistant", content };
    }
  });
}

/**
 * Run one metered inference through the gateway. Throws (and never calls the model / never charges)
 * when a guardrail blocks the input (`GuardrailError` 422), the wallet is short
 * (`InsufficientCreditsError` 402), or the breaker is open (`SpendCapError` 402). A blocked OUTPUT
 * still settles the spend (the tokens were consumed) before the 422 surfaces; a failed provider call
 * refunds the reservation. Run with `opts.resolveModel` injected — a mock in tests (zero network).
 */
export async function infer(
  lane: string,
  input: InferInput,
  opts: InferOptions,
): Promise<InferResult> {
  const { tx, accountId, settings, guard } = opts;
  const { policy, runtime } = guard;
  const callId = opts.callId ?? randomUUID();
  const cfg = resolveProvider(settings, lane);

  // 1. resolve + render — a registry ref becomes escaped messages; raw messages pass through.
  let messages: readonly RenderedMessage[];
  let promptVersionId: string | null;
  if ("messages" in input) {
    messages = input.messages;
    promptVersionId = null;
  } else {
    const version = await withTenant(tx, accountId, (t) =>
      resolvePrompt(t, accountId, input.promptRef),
    );
    messages = renderVersion(version, input.vars ?? {});
    promptVersionId = version.id;
  }

  // 2. input-guard — moderate + redact PII per message; a block throws BEFORE any spend. The PII
  //    tokens travel to the output leg for restoration; the model only ever sees redacted text.
  const guarded: RenderedMessage[] = [];
  const tokens: PiiToken[] = [];
  for (const m of messages) {
    const out = await guardInput(m.content, policy, runtime);
    guarded.push({ role: m.role, content: out.text });
    tokens.push(...out.tokens);
  }

  // 3. cap/credit-check — reserve debits the estimate up front (402 on a short wallet or open
  //    breaker; the transaction rolls back, leaving no trace). The model is NOT called before this.
  const reserved = await withTenant(tx, accountId, (t) =>
    reserve(t, {
      accountId,
      callId,
      provider: cfg.provider,
      model: cfg.model,
      lane,
      messages: guarded,
      ...(opts.maxOutputTokens !== undefined
        ? { maxOutputTokens: opts.maxOutputTokens }
        : {}),
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
        promptVersionId,
        ...(opts.meter !== undefined ? { config: opts.meter } : {}),
      }),
    );

  // 4. provider call — the SDK call against the injected model, optionally middleware-wrapped. A
  //    failure refunds the reservation (reconcile to zero) so a non-delivering call never charges.
  const model = await opts.resolveModel(lane);
  const wrapped =
    opts.middleware !== undefined
      ? wrapLanguageModel({ model, middleware: opts.middleware })
      : model;
  let text: string;
  let rawUsage: LanguageModelUsage;
  try {
    const result = await generateText({
      model: wrapped,
      messages: toModelMessages(guarded),
      ...(opts.maxOutputTokens !== undefined
        ? { maxOutputTokens: opts.maxOutputTokens }
        : {}),
    });
    text = result.text;
    rawUsage = result.usage;
  } catch (err) {
    await settle(ZERO_USAGE);
    throw err;
  }

  // 5. record usage.
  const usage = mapUsage(rawUsage);

  // 6. output-guard (+ PII restore) then 7. reconcile. A blocked output still reconciles the actual
  //    spend (the tokens were already consumed) before the 422 propagates.
  let outText: string;
  try {
    await guardOutput(text, policy, runtime);
    outText = tokens.length > 0 ? restorePii(text, tokens, policy) : text;
  } catch (err) {
    await settle(usage);
    throw err;
  }
  const reconciled = await settle(usage);

  return {
    callId,
    text: outText,
    messages: guarded,
    promptVersionId,
    usage,
    reserved,
    reconciled,
  };
}

/** Restore tokenized PII in the model output using the bound field-crypto context (tokenize mode). */
function restorePii(
  text: string,
  tokens: readonly PiiToken[],
  policy: GuardPolicy,
): string {
  const ctx = policy.pii?.ctx;
  if (ctx === undefined) return text;
  return detokenizePii(text, tokens, ctx);
}
