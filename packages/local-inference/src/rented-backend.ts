// src/inference/rented-backend.ts — the RENTED / hosted inference backend SEAM (ADR-0064).
// It implements the SAME `InferenceBackend` port as the deterministic
// stub and the on-device ONNX backend, so a deployer who explicitly opts into a hosted
// provider swaps the backend without touching any caller. Two invariants make a hosted path safe in
// an edition whose marquee promise is "your data never leaves the device":
//
//   1. OFF BY DEFAULT, gated by the privacy guard. The backend refuses to
//      construct unless its endpoint host is HTTPS *and* explicitly allowlisted as a `rented-backend`
//      sanctioned sink in the privacy policy. A zero-egress (default) policy makes construction
//      throw — there is NO way to reach a hosted provider without the deployer opting the host in,
//      and NO silent fallback (fail-closed-to-offline). Every call re-asserts the gate.
//
//   2. METERED. A rented call is a PAID call, so every `embed`/`complete` emits exactly one metered
//      record (kernel `UsageMetering` — integer units, ADR-0007; per-call idempotency key, ADR-0074)
//      through a `meter` sink before the result is returned. The billing/commerce layer wires the sink:
//
//        // Swap the test/no-op sink for the real append-only/integer/idempotent
//        // debit. The credits package is NOT a dependency of this edition — only the SHAPE ships
//        // here; the live debit is wired by the buyer's billing integration:
//        //
//        //   import { debit } from "@caisson-sh/credits";
//        //   meter: async (record) => {
//        //     await debit({
//        //       accountId,
//        //       eventType: "feature_debit",
//        //       feature: record.feature,             // a registered feature tag (ADR-0074)
//        //       amount: record.quantity,             // integer units (ADR-0007)
//        //       idempotencyKey: record.idempotencyKey, // dedup → no double-charge on replay
//        //     });
//        //   }
//        //
//      The record is already integer + idempotent, so the billing wiring only replaces the sink —
//      nothing in this file ever touches the ledger.
//
// NO NETWORK IN CI (ADR-0064): the wire call is a `RentedTransport` PORT. CI injects a deterministic
// double; the LIVE transport (`createLiveRentedTransport`) routes every byte through the egress
// guard (→ kernel `fetchWithTimeout`; the native `AbortSignal.timeout` is forbidden on Bun),
// purpose-bound to the `rented-backend` sink kind, and runs only in the gated live proof
// (ADR-0201). The file is framework-free (ADR-0044): it opens no socket at load and imports no
// provider SDK.
import {
  InternalError,
  ValidationError,
  parseStrict,
  strictObject,
  usageMeteringSchema,
} from "@caisson-sh/kernel";
import type { FetchTimeoutOptions, UsageMetering } from "@caisson-sh/kernel";
import { z } from "zod";
import { EMBEDDING_DIM } from "./backend.ts";
import type {
  CompletionRequest,
  CompletionResult,
  InferenceBackend,
} from "./backend.ts";
import type { EgressGuard } from "@caisson-sh/local-privacy";

// ── Transport wire shapes (boundary-validated; the live transport's body is untrusted remote JSON) ─

/** Provider-reported usage for one rented call. Integer units only (ADR-0007). */
const rentedUsageSchema = strictObject({
  unit: z.enum(["credit", "token", "request", "second"]),
  quantity: z.number().int().nonnegative(),
});

/** A rented `embed` response: a raw vector + the metered usage the provider reports. */
const rentedEmbedResponseSchema = strictObject({
  vector: z.array(z.number().finite()).min(1),
  usage: rentedUsageSchema,
});

/** A rented `complete` response: generated text (+ optional model label) + the metered usage. */
const rentedCompleteResponseSchema = strictObject({
  text: z.string(),
  model: z.string().min(1).optional(),
  usage: rentedUsageSchema,
});

/** A validated rented embed response. */
export type RentedEmbedResponse = z.infer<typeof rentedEmbedResponseSchema>;
/** A validated rented completion response. */
export type RentedCompleteResponse = z.infer<
  typeof rentedCompleteResponseSchema
>;

/**
 * The hosted-provider call seam. The LIVE implementation ({@link createLiveRentedTransport}) is the
 * one un-exercised path in CI; tests inject a deterministic double. Responses are re-validated by the
 * backend, so a double that returns the wrong shape fails closed exactly like a hostile remote.
 */
export interface RentedTransport {
  embed(input: { text: string }): Promise<RentedEmbedResponse>;
  complete(input: {
    prompt: string;
    maxTokens?: number;
  }): Promise<RentedCompleteResponse>;
}

/**
 * The metered-call sink: every rented call hands it one {@link UsageMetering} record before the
 * result is returned. The buyer's billing integration wires the live `credits.debit` here (see the file header); the
 * edition ships only the shape. If the sink throws, the call fails — a paid call that cannot be
 * recorded must not silently succeed (fail-closed).
 */
export type MeterSink = (record: UsageMetering) => void | Promise<void>;

/** Construction config for the rented inference backend. */
export interface RentedBackendConfig {
  /** The hosted-inference HTTPS endpoint. Its host MUST be allowlisted as a `rented-backend` sink. */
  endpoint: string;
  /** The egress guard enforcing the privacy policy — the opt-in gate (off unless allowlisted). */
  guard: EgressGuard;
  /** The wire-call transport (the live transport is un-exercised in CI; tests inject a double). */
  transport: RentedTransport;
  /** The metered-call sink — one record per call. The buyer's billing integration wires `credits.debit` here. */
  meter: MeterSink;
  /** Per-tenant id stamped on each metered record (local-first: one backend instance per tenant). */
  tenantId: string;
  /** The registered feature tag this rented inference is billed against (ADR-0074). */
  feature: string;
  /** A stable provider/model label exposed as the port `model`. */
  model: string;
  /** Embedding width — MUST equal the local-store vec0 `dim`. Defaults to {@link EMBEDDING_DIM}. */
  dim?: number;
}

function assertNonEmpty(value: string, field: string): void {
  if (value.trim() === "") {
    throw new ValidationError(`rented backend requires a non-empty ${field}`, {
      field,
    });
  }
}

/**
 * The rented/hosted inference backend. Off by default and gated by the privacy guard at construction
 * (and re-checked per call); every call is metered through the billing-wired sink. Implements the shared
 * {@link InferenceBackend} port so it drops in wherever the stub or ONNX backend is used.
 */
export class RentedInferenceBackend implements InferenceBackend {
  readonly model: string;
  readonly dim: number;
  readonly #endpoint: URL;
  readonly #guard: EgressGuard;
  readonly #transport: RentedTransport;
  readonly #meter: MeterSink;
  readonly #tenantId: string;
  readonly #feature: string;

  constructor(config: RentedBackendConfig) {
    const dim = config.dim ?? EMBEDDING_DIM;
    if (!Number.isInteger(dim) || dim <= 0) {
      throw new ValidationError(
        "rented backend dim must be a positive integer",
        { received: dim },
      );
    }
    assertNonEmpty(config.tenantId, "tenantId");
    assertNonEmpty(config.feature, "feature");
    assertNonEmpty(config.model, "model");

    // OFF BY DEFAULT. `assertAllowedFor` throws unless the endpoint is HTTPS, the host
    // is on the privacy allowlist (a zero-egress default policy fails closed), AND the sanctioned
    // sink KIND is `rented-backend` specifically — a host allowlisted only for the model fetch
    // can never double as a hosted-inference egress.
    const url = config.guard.assertAllowedFor(
      config.endpoint,
      "rented-backend",
    );

    this.dim = dim;
    this.model = config.model;
    this.#endpoint = url;
    this.#guard = config.guard;
    this.#transport = config.transport;
    this.#meter = config.meter;
    this.#tenantId = config.tenantId;
    this.#feature = config.feature;
  }

  /** Embed text via the hosted provider; emit one metered record; return a locked-`dim` vector. */
  async embed(text: string): Promise<Float32Array> {
    // Re-assert the egress gate per call — the policy is the authority, not a construction-time snapshot.
    this.#guard.assertAllowedFor(this.#endpoint, "rented-backend");
    const res = parseStrict(
      rentedEmbedResponseSchema,
      await this.#transport.embed({ text }),
    );
    const vec = Float32Array.from(res.vector);
    if (vec.length !== this.dim) {
      // Fail closed: a width mismatch would silently corrupt the local-store vec0 dim-guard.
      throw new InternalError(
        "rented embedding width does not match the locked dim",
        { expected: this.dim, received: vec.length, model: this.model },
      );
    }
    await this.#emitMeter(res.usage);
    return vec;
  }

  /** Generate a completion via the hosted provider; emit one metered record; return the text. */
  async complete(req: CompletionRequest): Promise<CompletionResult> {
    this.#guard.assertAllowedFor(this.#endpoint, "rented-backend");
    // `exactOptionalPropertyTypes`: only pass `maxTokens` when the caller actually set it.
    const input =
      req.maxTokens !== undefined
        ? { prompt: req.prompt, maxTokens: req.maxTokens }
        : { prompt: req.prompt };
    const res = parseStrict(
      rentedCompleteResponseSchema,
      await this.#transport.complete(input),
    );
    await this.#emitMeter(res.usage);
    return { text: res.text, model: res.model ?? this.model };
  }

  /**
   * Build + validate one metered record and hand it to the sink. The record is the canonical
   * append-only/integer/idempotent ledger shape (`UsageMetering`); the buyer's billing integration
   * swaps the sink for the live `credits.debit` (see the file header). `idempotencyKey` is fresh per call so a replay
   * of the SAME key never double-charges.
   */
  async #emitMeter(usage: z.infer<typeof rentedUsageSchema>): Promise<void> {
    const record = parseStrict(usageMeteringSchema, {
      tenantId: this.#tenantId,
      feature: this.#feature,
      unit: usage.unit,
      quantity: usage.quantity,
      occurredAt: new Date().toISOString(),
      idempotencyKey: crypto.randomUUID(),
    });
    await this.#meter(record);
  }
}

/** Config for the LIVE rented transport (never in the default suite; proven via ADR-0201). */
export interface LiveRentedTransportConfig {
  /** Base HTTPS endpoint; `/embed` and `/complete` are resolved against it. */
  endpoint: string;
  /** The egress guard — every request routes through `guard.fetch`, re-gating the host. */
  guard: EgressGuard;
  /** Provider API key, sent as a Bearer header. Never logged. */
  apiKey?: string;
  /** Per-call deadline (ms) for the guarded chokepoint. */
  timeoutMs?: number;
}

/**
 * The LIVE rented transport (proven live per ADR-0201; no network in the default suite, ADR-0064).
 * Every byte routes through the egress guard's `fetchAs` (→ kernel `fetchWithTimeout`; the native
 * `AbortSignal.timeout` is forbidden on Bun), PURPOSE-BOUND to the `rented-backend` sink kind — a
 * host allowlisted for a different purpose (e.g. the model fetch) can never receive the Bearer
 * header. Every response is re-validated against the wire schema before it reaches the backend.
 */
export function createLiveRentedTransport(
  config: LiveRentedTransportConfig,
): RentedTransport {
  // Fail at composition, not first call: the endpoint must already be sanctioned as a
  // `rented-backend` sink (mirrors the RentedInferenceBackend construction gate).
  config.guard.assertAllowedFor(config.endpoint, "rented-backend");
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (config.apiKey !== undefined && config.apiKey !== "") {
    headers.authorization = `Bearer ${config.apiKey}`;
  }
  const options: FetchTimeoutOptions | undefined =
    config.timeoutMs !== undefined
      ? { timeoutMs: config.timeoutMs }
      : undefined;

  const post = async (path: string, body: unknown): Promise<unknown> => {
    const url = new URL(path, config.endpoint);
    const res = await config.guard.fetchAs(
      "rented-backend",
      url,
      { method: "POST", headers, body: JSON.stringify(body) },
      options,
    );
    if (!res.ok) {
      throw new InternalError("rented inference call failed", {
        status: res.status,
      });
    }
    return res.json();
  };

  return {
    async embed(input) {
      return parseStrict(
        rentedEmbedResponseSchema,
        await post("/embed", input),
      );
    },
    async complete(input) {
      return parseStrict(
        rentedCompleteResponseSchema,
        await post("/complete", input),
      );
    },
  };
}
