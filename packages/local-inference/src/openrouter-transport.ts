// src/inference/openrouter-transport.ts — the OpenRouter RENTED transport (ADR-0201 §2, mapping the
// ADR-0064 `RentedTransport` port). `createLiveRentedTransport` speaks a
// first-party wire (`/embed`, `/complete`); THIS transport speaks OpenRouter's OpenAI-compatible
// wire (`/embeddings`, `/chat/completions`) so the hosted (non-BYOK, fully-metered) lane runs on the
// one org OPENROUTER_API_KEY without a bespoke daemon or provider SDK (ADR-0044: framework-free).
//
// The same two disciplines as the live transport:
//   1. EGRESS — every request routes through `guard.fetchAs("rented-backend", …)`, the single
//      audited chokepoint (→ kernel `fetchWithTimeout`; the native `AbortSignal.timeout` is
//      forbidden on Bun), PURPOSE-BOUND to the `rented-backend` sink KIND: a non-allowlisted host
//      is blocked BEFORE any socket opens, and so is a host allowlisted for a DIFFERENT sanctioned
//      purpose (a `model-fetch` host must never receive this Bearer request). There is no way
//      to reach OpenRouter without the deployer allowlisting `openrouter.ai` as a `rented-backend`
//      sanctioned sink; the same gate runs at construction so a mis-sanctioned endpoint
//      fails at composition, not first call.
//   2. ERROR HYGIENE — a non-2xx throws with the STATUS ONLY, never the response body: some proxies
//      echo request headers back in error bodies, so surfacing the body could leak the Bearer key.
//
// Wire-parse posture (the services/docs openrouter-embedder precedent): the remote body is
// third-party JSON we don't version, so the WIRE schemas are deliberately LENIENT (plain `z.object`,
// unknown provider fields pass) — a benign provider addition must not break the edition. The lenient
// parse is then MAPPED into the strict `RentedEmbedResponse`/`RentedCompleteResponse` shapes, which
// `RentedInferenceBackend` re-validates `.strict()` on every call (fail-closed both ways). Usage maps
// to integer token units (`Math.floor`, ADR-0007) so the metered sink only ever sees integers.
import { InternalError, ValidationError } from "@caisson-sh/kernel";
import type { FetchTimeoutOptions } from "@caisson-sh/kernel";
import { z } from "zod";
import { EMBEDDING_DIM } from "./backend.ts";
import type { RentedTransport } from "./rented-backend.ts";
import type { EgressGuard } from "@caisson-sh/local-privacy";

/** The hosted OpenRouter API root (overridable for a self-hosted OpenAI-compatible gateway). */
const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";

// ── Lenient wire schemas (untrusted third-party JSON — unknown fields pass, see the file header) ──
// Exported (file-level, not via the barrel): this is the OpenAI-compatible dialect, and the Azure
// OpenAI rented transport (ADR-0209) speaks the exact same wire — one schema set, two transports.

export const wireUsageSchema = z
  .object({
    total_tokens: z.number().optional(),
    prompt_tokens: z.number().optional(),
  })
  .optional();

export const embedWireSchema = z.object({
  data: z.array(z.object({ embedding: z.array(z.number()) })).min(1),
  usage: wireUsageSchema,
});

export const completeWireSchema = z.object({
  choices: z
    .array(z.object({ message: z.object({ content: z.string() }) }))
    .min(1),
  model: z.string().optional(),
  usage: wireUsageSchema,
});

/** Provider-reported tokens → integer units (ADR-0007). Missing usage meters as 0, never NaN. */
export function tokenQuantity(usage: z.infer<typeof wireUsageSchema>): number {
  return Math.floor(usage?.total_tokens ?? 0);
}

/** Config for the OpenRouter rented transport (ADR-0201). */
export interface OpenRouterRentedTransportConfig {
  /** The egress guard — every request routes through `guard.fetchAs("rented-backend", …)`,
   *  re-gating the host AND its sanctioned sink kind per call. */
  guard: EgressGuard;
  /** The OpenRouter API key, sent as a Bearer header. Never logged, never echoed in errors. */
  apiKey: string;
  /** Model slug for `complete` (`/chat/completions`), e.g. `openai/gpt-4o-mini`. */
  completionModel: string;
  /** Model slug for `embed` (`/embeddings`), e.g. `qwen/qwen3-embedding-8b`. */
  embeddingModel: string;
  /**
   * Embedding width, forwarded as the OpenAI-compatible Matryoshka `dimensions` param — MUST equal
   * the local-store vec0 `dim`. Defaults to {@link EMBEDDING_DIM}.
   */
  dimensions?: number;
  /** API root (default {@link DEFAULT_BASE_URL}). Its host must be an allowlisted `rented-backend` sink. */
  baseUrl?: string;
  /** Per-call deadline (ms) for the guarded chokepoint. */
  timeoutMs?: number;
}

/**
 * Build a {@link RentedTransport} over OpenRouter's OpenAI-compatible API (ADR-0201). Drops into
 * `RentedInferenceBackend` wherever the first-party live transport would — same guard gate, same
 * strict re-validation, same integer metering; only the wire dialect differs.
 */
export function createOpenRouterRentedTransport(
  config: OpenRouterRentedTransportConfig,
): RentedTransport {
  const fail = (field: string): never => {
    throw new ValidationError(
      `openrouter rented transport requires a non-empty ${field}`,
      { field },
    );
  };
  if (config.apiKey.trim() === "") fail("apiKey");
  if (config.completionModel.trim() === "") fail("completionModel");
  if (config.embeddingModel.trim() === "") fail("embeddingModel");
  const dimensions = config.dimensions ?? EMBEDDING_DIM;
  if (!Number.isInteger(dimensions) || dimensions <= 0) {
    throw new ValidationError(
      "openrouter rented transport dimensions must be a positive integer",
      { received: dimensions },
    );
  }
  const baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  // Fail at composition, not first call: the endpoint must be sanctioned as a `rented-backend`
  // sink SPECIFICALLY (mirrors the RentedInferenceBackend construction gate — see the file header).
  config.guard.assertAllowedFor(baseUrl, "rented-backend");
  const headers: Record<string, string> = {
    "content-type": "application/json",
    authorization: `Bearer ${config.apiKey}`,
  };
  const options: FetchTimeoutOptions | undefined =
    config.timeoutMs !== undefined
      ? { timeoutMs: config.timeoutMs }
      : undefined;

  const post = async (path: string, body: unknown): Promise<unknown> => {
    // `guard.fetchAs` is the chokepoint: the allowlist AND sink-kind gates fire BEFORE any socket
    // opens, so this Bearer request can only ever reach a `rented-backend`-sanctioned host.
    const res = await config.guard.fetchAs(
      "rented-backend",
      `${baseUrl}${path}`,
      { method: "POST", headers, body: JSON.stringify(body) },
      options,
    );
    if (!res.ok) {
      // Status only — never the body (a proxy error body can echo the Bearer key back).
      throw new InternalError("openrouter rented call failed", {
        status: res.status,
        path,
      });
    }
    return res.json();
  };

  return {
    async embed(input) {
      const wire = embedWireSchema.parse(
        await post("/embeddings", {
          model: config.embeddingModel,
          input: input.text,
          dimensions,
        }),
      );
      const first = wire.data[0];
      if (first === undefined) {
        // Unreachable past `.min(1)`; kept for noUncheckedIndexedAccess + fail-closed clarity.
        throw new InternalError("openrouter embeddings returned no data", {});
      }
      return {
        vector: first.embedding,
        usage: { unit: "token", quantity: tokenQuantity(wire.usage) },
      };
    },
    async complete(input) {
      const wire = completeWireSchema.parse(
        await post("/chat/completions", {
          model: config.completionModel,
          messages: [{ role: "user", content: input.prompt }],
          ...(input.maxTokens !== undefined
            ? { max_tokens: input.maxTokens }
            : {}),
        }),
      );
      const first = wire.choices[0];
      if (first === undefined) {
        throw new InternalError(
          "openrouter completion returned no choices",
          {},
        );
      }
      return {
        text: first.message.content,
        // The strict shape requires a non-empty model label; fall back to the configured slug.
        model:
          wire.model !== undefined && wire.model !== ""
            ? wire.model
            : config.completionModel,
        usage: { unit: "token", quantity: tokenQuantity(wire.usage) },
      };
    },
  };
}
