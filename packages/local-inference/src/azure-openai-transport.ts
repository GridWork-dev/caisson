// src/inference/azure-openai-transport.ts — the Azure OpenAI RENTED transport (ADR-0209, mapping
// the ADR-0064 `RentedTransport` port). Same discipline as the OpenRouter
// template (ADR-0201), different auth + routing dialect: Azure authenticates with an `api-key`
// header (not a Bearer), and routes per-deployment —
//   {endpoint}/openai/deployments/{deployment}/embeddings?api-version=…
//   {endpoint}/openai/deployments/{deployment}/chat/completions?api-version=…
// The response BODY is the same OpenAI-compatible wire OpenRouter speaks, so the lenient wire
// schemas are shared from openrouter-transport.ts (one dialect, two transports). No Azure SDK —
// the SDK-import boundary confines vendor SDKs to ai-config/ai-kit (ADR-0209).
//
// The same two disciplines as every rented transport:
//   1. EGRESS — every request routes through `guard.fetchAs("rented-backend", …)` (→ kernel
//      `fetchWithTimeout`; the native `AbortSignal.timeout` is forbidden on Bun), PURPOSE-BOUND to
//      the `rented-backend` sink kind. The deployer must allowlist the resource host
//      ({resource}.openai.azure.com); the gate also runs at construction so a mis-sanctioned
//      endpoint fails at composition, not first call. Config is EXPLICIT options only — the
//      transport reads no env.
//   2. ERROR HYGIENE — a non-2xx throws with the STATUS ONLY, never the response body (a proxy
//      error body can echo the api-key header back).
//
// Lenient wire parse → strict mapping (the template posture): unknown provider fields pass the
// wire schemas; the mapped `RentedEmbedResponse`/`RentedCompleteResponse` is re-validated
// `.strict()` by `RentedInferenceBackend` on every call. Usage maps to integer token units
// (`Math.floor`, ADR-0007).
import { InternalError, ValidationError } from "@caisson-sh/kernel";
import type { FetchTimeoutOptions } from "@caisson-sh/kernel";
import { EMBEDDING_DIM } from "./backend.ts";
import {
  completeWireSchema,
  embedWireSchema,
  tokenQuantity,
  withoutTrailingSlashes,
} from "./openrouter-transport.ts";
import type { RentedTransport } from "./rented-backend.ts";
import type { EgressGuard } from "@caisson-sh/local-privacy";

/** The default data-plane `api-version` (the 2024-10-21 GA inference version; overridable). */
const DEFAULT_API_VERSION = "2024-10-21";

/** Config for the Azure OpenAI rented transport (ADR-0209). Explicit options only — no env reads. */
export interface AzureOpenAIRentedTransportConfig {
  /** The egress guard — every request routes through `guard.fetchAs("rented-backend", …)`,
   *  re-gating the host AND its sanctioned sink kind per call. */
  guard: EgressGuard;
  /** The Azure OpenAI resource key, sent as the `api-key` header. Never logged, never echoed. */
  apiKey: string;
  /** The resource endpoint, e.g. `https://{resource}.openai.azure.com`. Its host must be an
   *  allowlisted `rented-backend` sink. */
  endpoint: string;
  /** The embeddings deployment name (the deployment IS the model — no `model` body field). */
  embeddingDeployment: string;
  /** The chat-completions deployment name. */
  completionDeployment: string;
  /** Data-plane `api-version` query param (default {@link DEFAULT_API_VERSION}). */
  apiVersion?: string;
  /**
   * Embedding width, forwarded as the OpenAI-compatible `dimensions` param (text-embedding-3-*
   * down-projection) — MUST equal the local-store vec0 `dim`. Defaults to {@link EMBEDDING_DIM}.
   */
  dimensions?: number;
  /** Per-call deadline (ms) for the guarded chokepoint. */
  timeoutMs?: number;
}

/**
 * Build a {@link RentedTransport} over an Azure OpenAI resource (ADR-0209). Drops into
 * `RentedInferenceBackend` wherever the OpenRouter transport would — same guard gate, same strict
 * re-validation, same integer metering; only auth (`api-key`) and routing (per-deployment +
 * `api-version`) differ.
 */
export function createAzureOpenAIRentedTransport(
  config: AzureOpenAIRentedTransportConfig,
): RentedTransport {
  const fail = (field: string): never => {
    throw new ValidationError(
      `azure openai rented transport requires a non-empty ${field}`,
      { field },
    );
  };
  if (config.apiKey.trim() === "") fail("apiKey");
  if (config.embeddingDeployment.trim() === "") fail("embeddingDeployment");
  if (config.completionDeployment.trim() === "") fail("completionDeployment");
  const apiVersion = config.apiVersion ?? DEFAULT_API_VERSION;
  if (apiVersion.trim() === "") fail("apiVersion");
  const dimensions = config.dimensions ?? EMBEDDING_DIM;
  if (!Number.isInteger(dimensions) || dimensions <= 0) {
    throw new ValidationError(
      "azure openai rented transport dimensions must be a positive integer",
      { received: dimensions },
    );
  }
  const endpoint = withoutTrailingSlashes(config.endpoint);
  // Fail at composition, not first call: the resource host must be sanctioned as a
  // `rented-backend` sink SPECIFICALLY (mirrors the RentedInferenceBackend construction gate).
  config.guard.assertAllowedFor(endpoint, "rented-backend");
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "api-key": config.apiKey,
  };
  const options: FetchTimeoutOptions | undefined =
    config.timeoutMs !== undefined
      ? { timeoutMs: config.timeoutMs }
      : undefined;

  const post = async (
    deployment: string,
    path: string,
    body: unknown,
  ): Promise<unknown> => {
    const url =
      `${endpoint}/openai/deployments/${encodeURIComponent(deployment)}` +
      `/${path}?api-version=${encodeURIComponent(apiVersion)}`;
    // `guard.fetchAs` is the chokepoint: the allowlist AND sink-kind gates fire BEFORE any socket
    // opens, so the api-key header can only ever reach a `rented-backend`-sanctioned host.
    const res = await config.guard.fetchAs(
      "rented-backend",
      url,
      { method: "POST", headers, body: JSON.stringify(body) },
      options,
    );
    if (!res.ok) {
      // Status only — never the body (a proxy error body can echo the api-key back).
      throw new InternalError("azure openai rented call failed", {
        status: res.status,
        path,
      });
    }
    return res.json();
  };

  return {
    async embed(input) {
      const wire = embedWireSchema.parse(
        await post(config.embeddingDeployment, "embeddings", {
          input: input.text,
          dimensions,
        }),
      );
      const first = wire.data[0];
      if (first === undefined) {
        // Unreachable past `.min(1)`; kept for noUncheckedIndexedAccess + fail-closed clarity.
        throw new InternalError("azure openai embeddings returned no data", {});
      }
      return {
        vector: first.embedding,
        usage: { unit: "token", quantity: tokenQuantity(wire.usage) },
      };
    },
    async complete(input) {
      const wire = completeWireSchema.parse(
        await post(config.completionDeployment, "chat/completions", {
          messages: [{ role: "user", content: input.prompt }],
          ...(input.maxTokens !== undefined
            ? { max_tokens: input.maxTokens }
            : {}),
        }),
      );
      const first = wire.choices[0];
      if (first === undefined) {
        throw new InternalError(
          "azure openai completion returned no choices",
          {},
        );
      }
      return {
        text: first.message.content,
        // The strict shape requires a non-empty model label; fall back to the deployment name.
        model:
          wire.model !== undefined && wire.model !== ""
            ? wire.model
            : config.completionDeployment,
        usage: { unit: "token", quantity: tokenQuantity(wire.usage) },
      };
    },
  };
}
