// The metered language gateway (ADR-0059) — `infer()` and `inferStream()` compose the four base
// primitives through the same enforced chokepoint in a fixed, fail-closed order:
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
// the real `@ai-sdk/*` adapters, CI injects a mock `LanguageModelV4`. The Vercel AI SDK v7 surface
// (`createProviderRegistry` / `wrapLanguageModel` / `generateText` / `streamText`) is hidden behind
// `infer()` / `inferStream()`, so the SDK stays swappable — and the live transport is the only path
// not exercised by a test.
//
// Each meter leg runs in its OWN `withTenant` transaction: a DB transaction is never held open across
// the (slow, network) provider call, and reserve/reconcile are independently idempotent on `callId`.
import { createHash, randomUUID } from "node:crypto";
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
import type { LanguageModelV4, ProviderV4 } from "@ai-sdk/provider";
import type { AiSettings } from "@caisson-sh/ai-config";
import { resolveProvider } from "@caisson-sh/ai-config";
import {
  estimateInputTokens,
  estimateTokens,
  estimateUsage,
  reconcile,
  reserve,
} from "@caisson-sh/ai-meter";
import type {
  MeterConfig,
  ReconcileInput,
  ReconcileResult,
  ReserveResult,
  Usage,
} from "@caisson-sh/ai-meter";
import { detokenizePii, guardInput, guardOutput } from "@caisson-sh/guardrails";
import type {
  GuardPolicy,
  GuardRuntime,
  PiiToken,
} from "@caisson-sh/guardrails";
import { CaissonError, InsufficientCreditsError } from "@caisson-sh/kernel";
import type { EventSink } from "@caisson-sh/kernel";
import type { TrajectoryEvent } from "@caisson-sh/agent-trajectory";
import { renderVersion, resolvePrompt } from "@caisson-sh/prompt-registry";
import type { RenderedMessage } from "@caisson-sh/prompt-registry";
import { withTenant } from "@caisson-sh/tenancy-rls";
import type { Transactor } from "@caisson-sh/tenancy-rls";
import {
  assertUsageFitsLedger,
  canPersistUsage,
  normalizeLanguageUsage,
  usageLedgerCost,
} from "./usage.ts";

/**
 * Resolve a configured lane to its backing model. Production builds this over a provider registry
 * (`buildRegistryResolver`); tests inject a mock `LanguageModelV4` — the live transport stays the
 * only un-exercised path.
 */
export type ModelResolver = (
  lane: string,
  accountId?: string,
) => LanguageModelV4 | Promise<LanguageModelV4>;

/** What to send the model: pre-built messages, or a registry prompt reference to resolve + render. */
export type InferInput =
  | { readonly messages: readonly RenderedMessage[] }
  | { readonly promptRef: string; readonly vars?: unknown };

/** The guardrails input/output policy + per-call runtime (tenant + event sink). */
export interface GuardConfig {
  readonly policy: GuardPolicy;
  readonly runtime: GuardRuntime;
}

/** The two trajectory event kinds the gateway observes: the model call, then its metered usage. */
type GatewayTrajectoryEvent = Extract<
  TrajectoryEvent,
  { kind: "model.call" | "model.usage" }
>;

/**
 * An OPTIONAL observation sink the gateway emits into (SPEC scope-item-2, ADR-0351 rider 1). The
 * caller — a governed run loop — OWNS the run: it wraps each `{ kind, payload }` the gateway supplies
 * in the append-only envelope (runId, monotonic seq, eventId, occurredAt, version) and appends it to a
 * `TrajectoryStore`. The gateway emits `model.call` (model id + prompt DIGEST only, never the prompt
 * text — AR-4) before the provider call and `model.usage` (`billingStatus: 'metered'`, the SAME
 * integers the ledger settled) after reconcile.
 *
 * Observation NEVER fails the metered call: a recorder that throws/rejects is swallowed and surfaced
 * as a `trajectory.record_failed` ops warning on the guard runtime's sink. The fail-closed inversion
 * (a metered step blocked when observation cannot record) arrives only with the loop slice — not here.
 */
export type TrajectoryRecorder = (
  event: Pick<GatewayTrajectoryEvent, "kind" | "payload">,
) => void | Promise<void>;

/**
 * Wrap a recorder in the swallow-and-warn contract above: emit into it, and if it throws, surface a
 * `trajectory.record_failed` ops event (best-effort — a sink failure is swallowed too) instead of
 * letting observation break the money path. A no-op when no recorder is wired.
 *
 * Takes a THUNK so event construction (digesting, ledger reads) runs inside the swallow boundary —
 * a throw while building the event must not strand a live reservation any more than a recorder
 * throw may.
 */
function trajectoryEmitter(
  recorder: TrajectoryRecorder | undefined,
  sink: EventSink,
  accountId: string,
): (
  build: () => Pick<GatewayTrajectoryEvent, "kind" | "payload">,
) => Promise<void> {
  if (recorder === undefined) return async () => {};
  return async (build) => {
    let kind = "unbuilt";
    try {
      const event = build();
      kind = event.kind;
      await recorder(event);
    } catch (err) {
      try {
        await sink.emit({
          name: "trajectory.record_failed",
          timestamp: new Date().toISOString(),
          tenantId: accountId,
          attributes: {
            kind,
            error: err instanceof Error ? err.message : String(err),
          },
        });
      } catch {
        // The ops sink failing must not fail the metered call either — swallow.
      }
    }
  };
}

/** The prompt, content-addressed: a sha256 digest + byte length, never the prompt text itself (AR-4). */
function promptDigest(messages: readonly RenderedMessage[]): {
  digest: string;
  byteLength: number;
} {
  const canonical = JSON.stringify(
    messages.map((m) => ({ role: m.role, content: m.content })),
  );
  return {
    digest: createHash("sha256").update(canonical).digest("hex"),
    byteLength: Buffer.byteLength(canonical, "utf8"),
  };
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
   * OPTIONAL trajectory observation sink. When present the gateway emits `model.call` (prompt digest
   * only) before the provider call and `model.usage` (metered, the ledger's own integers) after
   * reconcile. Additive: absent ⇒ byte-identical behavior; a recorder failure never fails the call.
   */
  readonly recorder?: TrajectoryRecorder;
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
  /** Provider usage, or the ledger-safe fallback the reconcile leg charged. */
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
   * REPORTED usage (from the `finish` stream part), or a ledger-safe consumed/reservation fallback.
   * On abandonment there is no provider report yet, so this is an ESTIMATE — the same chars/4
   * heuristic `reserve()` itself uses — over the text yielded before the stream ended.
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
 * A reconcile that debits ABOVE the reservation (a positive delta — e.g. `fallbackLanguageSettlement`'s
 * consumed-estimate exceeding `reservedCredits` on an unreported-usage clean finish) but hits a short
 * wallet. `reconcile()`'s `usage_event` insert and the shortfall debit share ONE transaction, so a
 * short wallet rolls the whole leg back: no ledger row lands, yet `reserve()`'s up-front debit — a
 * SEPARATE, already-committed transaction — still holds `reservedCredits`. Never underbills, wallet
 * never negative, but the hold is otherwise invisible. Classify it distinctly instead of letting the
 * raw `InsufficientCreditsError` propagate un-marked (mirrors `agent-loop.ts`'s F3 residual): the
 * `usage_event` UNIQUE (account, call_id) makes a later reconcile retry — once the wallet is topped up
 * — settle safely and exactly once.
 */
export class OrphanedReservationError extends CaissonError {
  readonly code = "orphaned_reservation";
  readonly httpStatus = 402;
  constructor(callId: string, reservedCredits: number, cause: unknown) {
    super(
      `reconcile failed above the reservation — orphaned hold pending sweep (call ${callId})`,
      {
        callId,
        reservedCredits,
        cause: cause instanceof Error ? cause.message : String(cause),
      },
    );
  }
}

/**
 * Reconcile inside its own `withTenant` scope, reclassifying a shortfall-on-reconcile
 * `InsufficientCreditsError` as `OrphanedReservationError` (see the type doc) instead of letting it
 * surface unmarked. Shared by `infer()` and `inferStream()` so the classification lives in exactly
 * one place — the shared seam both settle closures reconcile through.
 */
async function reconcileOrOrphan(
  tx: Transactor,
  accountId: string,
  input: ReconcileInput,
): Promise<ReconcileResult> {
  try {
    return await withTenant(tx, accountId, (t) => reconcile(t, input));
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      throw new OrphanedReservationError(
        input.callId,
        input.reservedCredits,
        err,
      );
    }
    throw err;
  }
}

/**
 * Build a `ModelResolver` from a provider registry over the ai-config lanes (ADR-0059): each lane's
 * `{ provider, model }` resolves to `registry.languageModel("provider:model")`. The provider
 * instances are injected (the real `@ai-sdk/*` adapters in prod via `defaultProviders`, a double in
 * tests), so the gateway depends only on the AI-SDK core here — the vendor SDK stays behind `infer()`.
 */
export function buildRegistryResolver(
  settings: AiSettings,
  providers: Record<string, ProviderV4>,
): ModelResolver {
  const registry = createProviderRegistry(providers);
  return (lane: string): LanguageModelV4 => {
    const cfg = resolveProvider(settings, lane);
    return registry.languageModel(`${cfg.provider}:${cfg.model}`);
  };
}

interface SdkPrompt {
  readonly messages: ModelMessage[];
  readonly allowSystemInMessages: boolean;
}

/**
 * AI SDK v7 rejects system-role entries in `messages` by default. Preserve Caisson's pre-v7 public
 * prompt contract, including interleaved system turns, through the explicit compatibility switch;
 * the existing prompt-registry and guardrail boundaries still validate every message's content.
 */
function toSdkPrompt(messages: readonly RenderedMessage[]): SdkPrompt {
  return {
    allowSystemInMessages: messages.some(
      (message) => message.role === "system",
    ),
    messages: messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  };
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
  const emit = trajectoryEmitter(opts.recorder, runtime.sink, accountId);

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

  const reservationUsage = estimateUsage(guarded, opts.maxOutputTokens);
  assertUsageFitsLedger(reservationUsage, cfg.provider, cfg.model, opts.meter);

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
    reconcileOrOrphan(tx, accountId, {
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
    });

  // Observe the model call (prompt digest only — never the prompt text). Emitted after reserve so a
  //    fail-closed 402 leaves no dangling call record; before the provider call so a provider failure
  //    still leaves the attempt observed.
  await emit(() => ({
    kind: "model.call",
    payload: {
      provider: cfg.provider,
      model: cfg.model,
      prompt: promptDigest(guarded),
    },
  }));

  // 4. provider call — the SDK call against the injected model, optionally middleware-wrapped. A
  //    failure refunds the reservation (reconcile to zero) so a non-delivering call never charges.
  let text: string;
  let rawUsage: LanguageModelUsage;
  try {
    const model = await opts.resolveModel(lane, accountId);
    const wrapped =
      opts.middleware !== undefined
        ? wrapLanguageModel({ model, middleware: opts.middleware })
        : model;
    const prompt = toSdkPrompt(guarded);
    const result = await generateText({
      model: wrapped,
      ...prompt,
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
  const normalized = normalizeLanguageUsage(rawUsage);
  const reported =
    normalized !== null &&
    canPersistUsage(normalized, cfg.provider, cfg.model, opts.meter)
      ? normalized
      : null;
  const settlement =
    reported !== null
      ? { usage: reported, usageReported: true }
      : fallbackLanguageSettlement(
          guarded,
          text,
          reservationUsage,
          reserved.reservedCredits,
          cfg.provider,
          cfg.model,
          opts.meter,
          false,
        );
  const { usage, usageReported } = settlement;

  // 6. output-guard (+ PII restore) then 7. reconcile. A blocked output still reconciles the actual
  //    spend (the tokens were already consumed) before the 422 propagates. ponytail: the blocked
  //    path emits no model.usage — the trajectory shows a model.call with settled spend and no usage
  //    claim; the loop slice may add a failed-usage emit if evals need the symmetry.
  let outText: string;
  try {
    await guardOutput(text, policy, runtime);
    outText = tokens.length > 0 ? restorePii(text, tokens, policy) : text;
  } catch (err) {
    await settle(usage, usageReported);
    throw err;
  }
  const reconciled = await settle(usage, usageReported);

  // Observe the metered usage — the SAME integers the ledger just settled (billingStatus: metered).
  await emit(() => ({
    kind: "model.usage",
    payload: {
      provider: cfg.provider,
      model: cfg.model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cachedInputTokens: usage.cachedInputTokens,
      credits: reconciled.actualCredits,
      billingStatus: "metered",
    },
  }));

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

/** A promise plus its own resolve/reject — lets the eager pump settle independently of consumers. */
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
 * that case, so this reuses `reserve()`'s own chars/4 heuristic (`@caisson-sh/ai-meter`): input tokens
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

interface FallbackLanguageSettlement {
  readonly usage: Usage;
  readonly usageReported: boolean;
}

/**
 * Bound deterministic fallbacks to values the usage ledger can persist. A completed call cannot
 * refund below its reservation merely because usage was missing/malformed; when its safe consumed
 * estimate exceeds the reservation, reconcile that estimate as authoritative. Abandoned streams
 * retain their partial-estimate refund behavior.
 */
function fallbackLanguageSettlement(
  messages: RenderedMessage[],
  consumedText: string,
  reservationUsage: Usage,
  reservedCredits: number,
  provider: string,
  model: string,
  meter: MeterConfig | undefined,
  allowBelowReservation: boolean,
): FallbackLanguageSettlement {
  const consumedUsage = estimateConsumedUsage(messages, consumedText);
  const consumedCost = usageLedgerCost(consumedUsage, provider, model, meter);
  if (consumedCost === null) {
    return { usage: reservationUsage, usageReported: false };
  }

  return {
    usage: consumedUsage,
    usageReported:
      allowBelowReservation || consumedCost.credits >= reservedCredits,
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
 * **Carve-out:** an `abortSignal` already fired before `streamText` was ever called is provably
 * PRE-contact — the provider was never reached at all — and settles ZERO_USAGE instead of the
 * input-token estimate (CAISSON-108 finding 2); a signal that fires after the provider call has
 * started keeps the estimate-over-consumed-text behavior above, never under-charging real spend.
 *
 * The gateway starts an eager pump before returning. That pump owns the provider stream and drives
 * settlement independently of consumer iteration, so a caller that never calls `next()` or drops
 * an iterator without `return()` cannot strand the reservation. The public `ReadableStream`
 * cancellation hook aborts the provider and waits for the same guarded settle path. Output
 * guardrails + PII restore run ONLY on a normal finish (mirrors `infer()`'s items 6/7) — there is no
 * complete output to check, or restore PII placeholders across, on an abandoned stream.
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
  const emit = trajectoryEmitter(opts.recorder, runtime.sink, accountId);

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

  const reservationUsage = estimateUsage(guarded, opts.maxOutputTokens);
  assertUsageFitsLedger(reservationUsage, cfg.provider, cfg.model, opts.meter);

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
    reconcileOrOrphan(tx, accountId, {
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
    });

  // 4. provider call (STREAMING) — the model is resolved/wrapped exactly like infer(); only the
  //    call shape (streamText vs generateText) and the settle timing differ (see the abandonment
  //    note above).
  let wrapped: LanguageModelV4;
  try {
    const model = await opts.resolveModel(lane, accountId);
    wrapped =
      opts.middleware !== undefined
        ? wrapLanguageModel({ model, middleware: opts.middleware })
        : model;
  } catch (err) {
    await settle(ZERO_USAGE);
    throw err;
  }

  // Observe the model call (prompt digest only) — after reserve + model resolve, before streaming.
  await emit(() => ({
    kind: "model.call",
    payload: {
      provider: cfg.provider,
      model: cfg.model,
      prompt: promptDigest(guarded),
    },
  }));

  const settled = deferred<InferStreamSettled>();
  // The eager pump can reject settlement even when the caller ignores `settled`; mark the source
  // promise handled without changing the rejecting promise returned to an observing caller.
  void settled.promise.catch(() => undefined);
  let settledOnce = false;

  const settleOnce = async (
    consumedText: string,
    reportedUsage: Usage | null,
    abandoned: boolean,
  ): Promise<void> => {
    if (settledOnce) return;
    settledOnce = true;
    // Two independent axes: `abandoned` (no finish part → estimate over consumed text, skip output
    // guards) and whether the provider reported ledger-safe usage. Missing/malformed clean-finish
    // usage cannot refund below the reservation; an unsafe fallback uses the safe reservation shape.
    const settlement =
      reportedUsage !== null
        ? { usage: reportedUsage, usageReported: true }
        : fallbackLanguageSettlement(
            guarded,
            consumedText,
            reservationUsage,
            reserved.reservedCredits,
            cfg.provider,
            cfg.model,
            opts.meter,
            abandoned,
          );
    const { usage, usageReported } = settlement;
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
      // Observe the metered usage on a NORMAL finish only — the ledger's own integers. An abandoned
      // stream's settle amount is an estimate, not a provider-verified metered number, so no claim.
      if (!abandoned) {
        await emit(() => ({
          kind: "model.usage",
          payload: {
            provider: cfg.provider,
            model: cfg.model,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            cachedInputTokens: usage.cachedInputTokens,
            credits: reconciled.actualCredits,
            billingStatus: "metered",
          },
        }));
      }
      settled.resolve({ text: outText, usage, reconciled, abandoned });
    } catch (err) {
      settled.reject(err);
    }
  };

  const consumerAbort = new AbortController();
  const streamAbortSignal =
    opts.abortSignal === undefined
      ? consumerAbort.signal
      : AbortSignal.any([opts.abortSignal, consumerAbort.signal]);
  let consumerCancelled = false;

  const textStream = new ReadableStream<string>({
    start(controller): void {
      void pump(controller);
    },
    async cancel(reason): Promise<void> {
      consumerCancelled = true;
      consumerAbort.abort(reason);
      await settled.promise.catch(() => undefined);
    },
  });
  const textIterable: AsyncIterable<string> = {
    [Symbol.asyncIterator](): AsyncIterator<string, void, void> {
      let reader: ReadableStreamDefaultReader<string> | undefined;
      let finished = false;
      const getReader = (): ReadableStreamDefaultReader<string> => {
        reader ??= textStream.getReader();
        return reader;
      };
      const release = (): void => {
        if (reader === undefined) return;
        reader.releaseLock();
        reader = undefined;
      };
      return {
        async next(): Promise<IteratorResult<string, void>> {
          if (finished) return { done: true, value: undefined };
          try {
            const result = await getReader().read();
            if (result.done) {
              finished = true;
              release();
              return { done: true, value: undefined };
            }
            return { done: false, value: result.value };
          } catch (error) {
            finished = true;
            release();
            throw error;
          }
        },
        async return(): Promise<IteratorResult<string, void>> {
          if (finished) return { done: true, value: undefined };
          finished = true;
          try {
            if (reader !== undefined) await reader.cancel();
            else if (!textStream.locked) await textStream.cancel();
          } finally {
            release();
          }
          return { done: true, value: undefined };
        },
        async throw(error?: unknown): Promise<IteratorResult<string, void>> {
          finished = true;
          try {
            if (reader !== undefined) await reader.cancel(error);
            else if (!textStream.locked) await textStream.cancel(error);
          } finally {
            release();
          }
          throw error;
        },
      };
    },
  };

  async function pump(
    controller: ReadableStreamDefaultController<string>,
  ): Promise<void> {
    // Provably pre-contact: the signal was already aborted before streamText — and so the
    // provider — was ever called. Settle ZERO_USAGE directly (infer()'s abort-before-call full
    // refund, mirrored) instead of falling into the estimate fallback below, which would charge
    // the input-token estimate for a call that never reached the provider (CAISSON-108 finding 2).
    if (streamAbortSignal.aborted) {
      await settleOnce("", ZERO_USAGE, true);
      if (!consumerCancelled) controller.close();
      return;
    }
    let consumedText = "";
    let reportedUsage: Usage | null = null;
    let sawFinish = false;
    let streamFailed = false;
    let streamError: unknown;
    try {
      const prompt = toSdkPrompt(guarded);
      const result = streamText({
        model: wrapped,
        ...prompt,
        ...(opts.maxOutputTokens !== undefined
          ? { maxOutputTokens: opts.maxOutputTokens }
          : {}),
        abortSignal: streamAbortSignal,
      });
      for await (const part of result.stream) {
        if (consumerCancelled) break;
        if (part.type === "text-delta") {
          consumedText += part.text;
          controller.enqueue(part.text);
          // Give a consuming iterator's `return()` a turn before pulling another provider delta.
          await Promise.resolve();
        } else if (part.type === "finish") {
          // A finish part means the provider completed — even when it carries no usage numbers
          // (`normalizeLanguageUsage` → null). That is NOT abandonment: output guards still run below.
          sawFinish = true;
          const normalized = normalizeLanguageUsage(part.totalUsage);
          reportedUsage =
            normalized !== null &&
            canPersistUsage(normalized, cfg.provider, cfg.model, opts.meter)
              ? normalized
              : null;
        } else if (part.type === "error") {
          streamFailed = true;
          streamError = part.error;
          break;
        }
      }
    } catch (err) {
      // Caller aborts and public-stream cancellation are expected abandonment paths. Provider
      // failures remain visible to a consumer after the reservation has been reconciled.
      if (!streamAbortSignal.aborted) {
        streamFailed = true;
        streamError = err;
      }
    } finally {
      // A provider/middleware setup failure before the first delta delivered no result and follows
      // infer()'s full-refund contract. Partial-stream failures still settle the consumed estimate.
      const settlementUsage =
        streamFailed && !sawFinish && consumedText.length === 0
          ? ZERO_USAGE
          : reportedUsage;
      await settleOnce(consumedText, settlementUsage, !sawFinish);
      if (!consumerCancelled) {
        if (streamFailed) controller.error(streamError);
        else controller.close();
      }
    }
  }

  return {
    callId,
    messages: guarded,
    promptVersionId,
    reserved,
    textStream: textIterable,
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
