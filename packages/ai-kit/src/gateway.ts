// The metered-inference gateway (ADR-0059) — the enforced chokepoint for every AI feature. One
// `infer(lane, input, opts)` composes the four base primitives in a fixed, fail-closed order:
//
//   resolve → render → input-guard → cap/credit-check (reserve) → provider call → record usage →
//   output-guard → reconcile
//
// `inferStream(lane, input, opts)` is the same pipeline with a STREAMING provider call (token deltas
// as the model produces them, via the AI SDK's `streamText`/`doStream`). The request/response shape
// above is unchanged by this — `infer()` still runs item-for-item as written.
//
// Each step is a base primitive (down-only, ADR-0003 — the gateway never imports another edition):
//   - prompt-registry  resolvePrompt + renderVersion  (a `name@version|alias` ref → escaped messages)
//   - guardrails       guardInput / guardOutput + detokenizePii  (moderation + PII redact / restore)
//   - ai-meter         reserve / reconcile  (debit-before-spend 402, caps + breaker, true-up to actual)
//   - ai-config        resolveProvider      (lane → provider/model coordinates; no provider literal)
//
// The backing model is INJECTED (`opts.resolveModel`): production wires `buildRegistryResolver` over
// the real `@ai-sdk/*` adapters, CI injects a mock `LanguageModelV2`. The Vercel AI SDK v5 surface
// (`createProviderRegistry` / `wrapLanguageModel` / `generateText` / `streamText`) is hidden behind
// `infer()` / `inferStream()`, so the SDK stays swappable — and the live transport is the only path
// not exercised by a test.
//
// Each meter leg runs in its OWN `withTenant` transaction: a DB transaction is never held open across
// the (slow, network) provider call, and reserve/reconcile are independently idempotent on `callId`.
import { randomUUID } from "node:crypto";
import {
  createProviderRegistry,
  generateText,
  streamText,
  wrapLanguageModel,
} from "ai";
import type {
  LanguageModelMiddleware,
  LanguageModelUsage,
  ModelMessage,
} from "ai";
import type { LanguageModelV2, ProviderV2 } from "@ai-sdk/provider";
import type { AiSettings } from "@caisson/ai-config";
import { resolveProvider } from "@caisson/ai-config";
import {
  estimateInputTokens,
  estimateTokens,
  reconcile,
  reserve,
} from "@caisson/ai-meter";
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
  accountId?: string,
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
  /**
   * Abort the in-flight provider call (a caller timeout, a hung-up request, …). A hang still hits
   * the existing failure path — `catch → settle(ZERO_USAGE)` — so an abort never leaks the up-front
   * reservation (ADR-0213: closes the fetchWithTimeout-floor gap on `infer()`'s bare `generateText`).
   */
  readonly abortSignal?: AbortSignal;
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

export interface InferStreamOptions extends InferOptions {
  /**
   * Abort the in-flight provider call (the caller hung up, the user navigated away, …). The stream
   * still reconciles — see `InferStreamSettled.abandoned` — so an abort never leaks the up-front
   * reservation and never double-charges a retry under the same `callId`.
   */
  readonly abortSignal?: AbortSignal;
}

export interface InferStreamSettled {
  /**
   * The text the gateway settles on. On a normal finish this is the FULL output — output-guarded
   * and PII-restored, exactly like `InferResult.text`. On abandonment it is the raw partial text
   * already yielded on `textStream` (un-guarded, un-restored — there was no complete output to
   * check; see the abandonment note on `inferStream`).
   */
  readonly text: string;
  /**
   * The usage the reconcile leg settled against. On a normal finish this is the provider's
   * REPORTED usage (from the `finish` stream part), same as `InferResult.usage`. On abandonment
   * there is no provider report yet, so this is an ESTIMATE — the same chars/4 heuristic
   * `reserve()` itself uses — over the text actually yielded before the stream ended.
   */
  readonly usage: Usage;
  readonly reconciled: ReconcileResult;
  /**
   * True when the stream ended before the model's own `finish` part — the consumer stopped
   * iterating early, `abortSignal` fired, or the provider stream errored. `usage`/`text` are then
   * estimates/partials, not the provider's report.
   */
  readonly abandoned: boolean;
}

export interface InferStreamResult {
  /** The correlation id used for both meter legs (same idempotency contract as `infer()`). */
  readonly callId: string;
  /** The rendered + input-guarded messages actually sent to the model (PII already redacted). */
  readonly messages: readonly RenderedMessage[];
  readonly promptVersionId: string | null;
  readonly reserved: ReserveResult;
  /**
   * Text deltas as the model produces them. NOT PII-restored per delta — a redaction placeholder
   * can split across chunks, so restoration is a whole-text operation (see `InferStreamSettled`).
   */
  readonly textStream: AsyncIterable<string>;
  /**
   * Resolves — EXACTLY once — once the gateway has reconciled, however the stream ended: drained
   * to the model's own `finish`, stopped early by the consumer (a `break`/`return()` on
   * `textStream`), aborted via `opts.abortSignal`, or errored. The up-front reservation from
   * `reserved` is never left un-reconciled and never double-charged.
   */
  readonly settled: Promise<InferStreamSettled>;
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

/**
 * Normalize the AI-SDK usage shape into the meter's integer `Usage` (cached ≤ input, never a float).
 * Returns `null` when the provider reported NO usage (both token counts undefined) — a legitimate
 * outcome on a successful call for some lanes (e.g. local/ollama). The caller must keep that distinct
 * from "0 tokens": reconcile settles an unreported call at the reservation estimate, never trueing a
 * real completed call down to a full refund (`@caisson/ai-meter`, ADR-0182 fail-closed-for-revenue).
 */
function mapUsage(u: LanguageModelUsage): Usage | null {
  if (u.inputTokens === undefined && u.outputTokens === undefined) return null;
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
      ...(cfg.keySource !== undefined ? { keySource: cfg.keySource } : {}),
      ...(opts.meter !== undefined ? { config: opts.meter } : {}),
    }),
  );

  // Settle to a given usage in its own transaction; idempotent on `callId` (a retry settles once).
  // `windowKey` is threaded from the reserve leg so a boundary-straddling call trues into the same
  // bucket; `keySource` carries the BYOK $0 signal; `usageReported` distinguishes a provider that
  // reported no usage (settle at reserved) from a genuine zero (a failed call → full refund).
  const settle = (
    usage: Usage,
    usageReported = true,
  ): Promise<ReconcileResult> =>
    withTenant(tx, accountId, (t) =>
      reconcile(t, {
        accountId,
        callId,
        provider: cfg.provider,
        model: cfg.model,
        lane,
        reservedCredits: reserved.reservedCredits,
        usage,
        usageReported,
        windowKey: reserved.windowKey,
        ...(cfg.keySource !== undefined ? { keySource: cfg.keySource } : {}),
        promptVersionId,
        ...(opts.meter !== undefined ? { config: opts.meter } : {}),
      }),
    );

  // 4. provider call — the SDK call against the injected model, optionally middleware-wrapped. A
  //    failure refunds the reservation (reconcile to zero) so a non-delivering call never charges.
  const model = await opts.resolveModel(lane, accountId);
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
      ...(opts.abortSignal !== undefined
        ? { abortSignal: opts.abortSignal }
        : {}),
    });
    text = result.text;
    rawUsage = result.usage;
  } catch (err) {
    await settle(ZERO_USAGE);
    throw err;
  }

  // 5. record usage. A provider may complete a call yet report NO usage — settle that at the
  //    reservation estimate (over the actual output text) rather than trueing it down to a refund.
  const reported = mapUsage(rawUsage);
  const usage = reported ?? estimateConsumedUsage(guarded, text);
  const usageReported = reported !== null;

  // 6. output-guard (+ PII restore) then 7. reconcile. A blocked output still reconciles the actual
  //    spend (the tokens were already consumed) before the 422 propagates.
  let outText: string;
  try {
    await guardOutput(text, policy, runtime);
    outText = tokens.length > 0 ? restorePii(text, tokens, policy) : text;
  } catch (err) {
    await settle(usage, usageReported);
    throw err;
  }
  const reconciled = await settle(usage, usageReported);

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

/** A promise plus its own resolve/reject — lets a generator settle `InferStreamResult.settled` as a
 *  side effect of its `finally` block, independent of how (or whether) the caller drains it. */
interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (reason: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * The usage `inferStream` reconciles against when a stream ends WITHOUT the model's own `finish`
 * part (abandoned — see `inferStream`'s design note). The provider never reports actual usage in
 * that case, so this reuses `reserve()`'s own chars/4 heuristic (`@caisson/ai-meter`): input tokens
 * over the messages actually sent, output tokens over the text actually yielded before the stream
 * ended.
 */
function estimateConsumedUsage(
  messages: RenderedMessage[],
  consumedText: string,
): Usage {
  return {
    inputTokens: estimateInputTokens(messages),
    outputTokens: estimateTokens(consumedText),
    cachedInputTokens: 0,
  };
}

/**
 * Run one metered inference through the gateway with a STREAMING provider call: the same
 * resolve → render → input-guard → reserve pipeline as `infer()` (items 1-3, unchanged), then text
 * deltas as the model produces them — via `streamText`/`doStream` — instead of one final string.
 *
 * **Reconcile timing on stream abandonment (the design call this method makes):** the reservation
 * is sized up front against an ESTIMATE, exactly like `infer()` — debit-before-spend either way,
 * unconditionally. What differs is the RECONCILE leg's input usage. A stream that runs to
 * completion reaches the model's own `finish` part, which carries the provider's ACTUAL usage —
 * reconcile trues up to that, identically to `infer()`. But a stream can also end WITHOUT a
 * `finish`: the consumer stops draining `textStream` early (a `break`, which triggers the
 * generator's `.return()`), `opts.abortSignal` fires mid-call, or the provider stream itself
 * errors. None of those give the provider a chance to report actual usage — so reconcile instead
 * settles to `estimateConsumedUsage`, the SAME chars/4 heuristic the up-front reservation used,
 * applied to the text actually yielded before the stream ended. The invariant that matters: the
 * reservation is NEVER left un-reconciled (no leaked hold on the wallet) and the settle leg stays
 * idempotent on `callId` (a retry under the same id settles once, never double-charges) — but an
 * abandoned stream's settle amount is necessarily an estimate, not a provider-verified number,
 * because the provider was never asked to finish billing a call the caller walked away from.
 *
 * This is implemented as an async generator with a `finally` block driving the settle: JS
 * guarantees `finally` runs on a natural drain, an early `for await...of` `break`, AND a thrown
 * error — so exactly one settle happens on every exit path (`settleOnce`'s own guard is the second,
 * belt-and-suspenders line of defense against a double-settle). Output guardrails + PII restore run
 * ONLY on a normal finish (mirrors `infer()`'s items 6/7) — there is no complete output to check,
 * or restore PII placeholders across, on an abandoned stream; the raw partial text already yielded
 * on `textStream` is what `InferStreamSettled.text` carries instead.
 */
export async function inferStream(
  lane: string,
  input: InferInput,
  opts: InferStreamOptions,
): Promise<InferStreamResult> {
  const { tx, accountId, settings, guard } = opts;
  const { policy, runtime } = guard;
  const callId = opts.callId ?? randomUUID();
  const cfg = resolveProvider(settings, lane);

  // 1. resolve + render — identical to infer().
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

  // 2. input-guard — identical to infer(): a block throws BEFORE any spend or model call.
  const guarded: RenderedMessage[] = [];
  const tokens: PiiToken[] = [];
  for (const m of messages) {
    const out = await guardInput(m.content, policy, runtime);
    guarded.push({ role: m.role, content: out.text });
    tokens.push(...out.tokens);
  }

  // 3. cap/credit-check — identical to infer(): reserve the ESTIMATE up front, fail-closed. The
  //    soft/hard spend cap is evaluated here exactly as for infer() — the streamed call never
  //    reaches the provider on a short wallet or an open breaker.
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
      ...(cfg.keySource !== undefined ? { keySource: cfg.keySource } : {}),
      ...(opts.meter !== undefined ? { config: opts.meter } : {}),
    }),
  );

  // Settle to a given usage in its own transaction; idempotent on `callId` (a retry settles once).
  // Threads the reserve bucket + BYOK signal; `usageReported=false` settles at reserved (a clean
  // finish that carried no usage), not a refund — see settleOnce for the abandonment distinction.
  const settle = (
    usage: Usage,
    usageReported = true,
  ): Promise<ReconcileResult> =>
    withTenant(tx, accountId, (t) =>
      reconcile(t, {
        accountId,
        callId,
        provider: cfg.provider,
        model: cfg.model,
        lane,
        reservedCredits: reserved.reservedCredits,
        usage,
        usageReported,
        windowKey: reserved.windowKey,
        ...(cfg.keySource !== undefined ? { keySource: cfg.keySource } : {}),
        promptVersionId,
        ...(opts.meter !== undefined ? { config: opts.meter } : {}),
      }),
    );

  // 4. provider call (STREAMING) — the model is resolved/wrapped exactly like infer(); only the
  //    call shape (streamText vs generateText) and the settle timing differ (see the abandonment
  //    note above).
  const model = await opts.resolveModel(lane, accountId);
  const wrapped =
    opts.middleware !== undefined
      ? wrapLanguageModel({ model, middleware: opts.middleware })
      : model;

  const settled = deferred<InferStreamSettled>();
  let settledOnce = false;

  const settleOnce = async (
    consumedText: string,
    reportedUsage: Usage | null,
    abandoned: boolean,
  ): Promise<void> => {
    if (settledOnce) return;
    settledOnce = true;
    // Two independent axes: `abandoned` (no finish part → estimate over consumed text, skip output
    // guards) and whether the provider REPORTED usage. An abandoned stream still settles at the
    // consumed estimate (refunding the unused hold), but a clean finish that carried NO usage settles
    // at the reservation (no refund of a real completed call) — so `usageReported` is false only for
    // the latter.
    const usageReported = abandoned || reportedUsage !== null;
    const usage = reportedUsage ?? estimateConsumedUsage(guarded, consumedText);
    try {
      let outText = consumedText;
      if (!abandoned) {
        // 6. output-guard (+ PII restore) — only on a normal finish; mirrors infer()'s items 6/7.
        //    A blocked output still reconciles the actual spend before the 422 propagates.
        try {
          await guardOutput(consumedText, policy, runtime);
          outText =
            tokens.length > 0
              ? restorePii(consumedText, tokens, policy)
              : consumedText;
        } catch (guardErr) {
          await settle(usage, usageReported);
          settled.reject(guardErr);
          return;
        }
      }
      // 7. reconcile — actual usage on a reported finish, an ESTIMATE on abandonment, the reservation
      //    on a finish that reported no usage (see above).
      const reconciled = await settle(usage, usageReported);
      settled.resolve({ text: outText, usage, reconciled, abandoned });
    } catch (err) {
      settled.reject(err);
    }
  };

  async function* driveTextStream(): AsyncGenerator<string, void, void> {
    let consumedText = "";
    let reportedUsage: Usage | null = null;
    let sawFinish = false;
    let streamErr: unknown;
    try {
      const result = streamText({
        model: wrapped,
        messages: toModelMessages(guarded),
        ...(opts.maxOutputTokens !== undefined
          ? { maxOutputTokens: opts.maxOutputTokens }
          : {}),
        ...(opts.abortSignal !== undefined
          ? { abortSignal: opts.abortSignal }
          : {}),
      });
      for await (const part of result.fullStream) {
        if (part.type === "text-delta") {
          consumedText += part.text;
          yield part.text;
        } else if (part.type === "finish") {
          // A finish part means the provider completed — even when it carries no usage numbers
          // (`mapUsage` → null). That is NOT abandonment: output guards still run below.
          sawFinish = true;
          reportedUsage = mapUsage(part.totalUsage);
        } else if (part.type === "error") {
          streamErr = part.error;
          break;
        }
      }
      if (streamErr !== undefined) throw streamErr;
    } catch (err) {
      streamErr = err;
      throw err;
    } finally {
      // Runs on a natural drain, an early consumer break (the for-await loop's implicit
      // generator.return()), OR a thrown error — the reservation is reconciled on every exit path.
      await settleOnce(consumedText, reportedUsage, !sawFinish);
    }
  }

  return {
    callId,
    messages: guarded,
    promptVersionId,
    reserved,
    textStream: driveTextStream(),
    settled: settled.promise,
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
