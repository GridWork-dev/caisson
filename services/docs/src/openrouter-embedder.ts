// src/openrouter-embedder.ts — the LIVE embedding transport (ADR-0096 DEPLOY wire). `FakeEmbedder`
// (embedder.ts) is the CI/offline stub; THIS is the production embedder that lights up the hybrid
// vector leg. It implements @caisson/local-store's `Embedder` port over OpenRouter's OpenAI-compatible
// `POST /api/v1/embeddings` (the same OPENROUTER_API_KEY the bot's generation uses — one credential),
// model `qwen/qwen3-embedding-8b` truncated to 1024 dims via the Matryoshka `dimensions` param.
//
// Two safety contracts, both structural:
//   1. EGRESS SCRUB — the returned embedder is wrapped in local-store's `guardEmbedder` (the T8
//      cloud-egress guard, ADR-0067), so every text is run through `scrubForEgress` BEFORE the request
//      body leaves the box. The transport here never sees a raw credential.
//   2. DIM ASSERTION — every produced vector is asserted to `dim` (a wrong-width vector THROWS, never
//      silently corrupts the vec index).
// `fetchWithTimeout` per the repo standard (the native AbortSignal timeout helper is forbidden on Bun);
// the transport is an injectable seam so tests never make a live call.
import { z } from "zod";
import {
  fetchWithTimeout,
  InternalError,
  ValidationError,
} from "@caisson/kernel";
import { assertEmbeddingDim, guardEmbedder } from "@caisson/local-store";
import type { Embedder } from "@caisson/local-store";

const OPENROUTER_EMBEDDINGS_URL = "https://openrouter.ai/api/v1/embeddings";

/** Default embedding model + width — qwen3-embedding-8b, Matryoshka-truncated to 1024 (ADR-0096). */
export const OPENROUTER_EMBED_MODEL = "qwen/qwen3-embedding-8b";
export const OPENROUTER_EMBED_DIM = 1024;

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * OpenRouter's OpenAI-compatible embeddings response. Parsed LENIENTLY (plain `z.object`, not the repo's
 * `.strict()` boundary helper): the body comes from a third-party we don't version and carries fields
 * (`object`, `index`, `usage`) we intentionally ignore — `.strict()` would reject a benign provider
 * addition. We validate only the one field we consume, then assert its width downstream (fail-closed).
 */
const EmbeddingsResponse = z.object({
  data: z.array(z.object({ embedding: z.array(z.number()) })).min(1),
});

/** The embed transport seam — defaults to `fetchWithTimeout`; tests inject a double (no live CI call). */
export type EmbedFetch = typeof fetchWithTimeout;

export interface OpenRouterEmbedderOptions {
  /** The OpenRouter API key (the legitimate egress credential — never logged). */
  apiKey: string;
  /** Override model slug (default `qwen/qwen3-embedding-8b`). */
  model?: string;
  /** Override output width (default 1024); MUST equal the store dim fixed at table creation. */
  dim?: number;
  /** Per-request deadline (ms). Default 30s. */
  timeoutMs?: number;
  /** OpenRouter attribution headers (optional, recommended). */
  referer?: string;
  title?: string;
  /** Injectable transport for tests — defaults to `fetchWithTimeout`. */
  fetchImpl?: EmbedFetch;
  /** Max retries on a transient 429/5xx/network failure (default 2). 0 = no retry. */
  maxRetries?: number;
  /** Base backoff (ms); exponential per attempt unless the response carries Retry-After (default 500). */
  retryBaseMs?: number;
}

/**
 * The raw OpenRouter embedder (UNGUARDED — call `createOpenRouterEmbedder` for the egress-scrubbed
 * value wired at deploy). One text → one `dim`-width vector. Retries transient failures (429 / 5xx /
 * network throw) with bounded backoff honoring Retry-After — a single boot-burst rate-limit must not
 * poison the whole vector leg. Throws `ValidationError` on an empty key, `InternalError` on a terminal
 * non-2xx (status only — never the body, key, or content) or an empty payload, and `ValidationError`
 * on a wrong-width vector. Nothing here logs the input or the key.
 */
class OpenRouterEmbedder implements Embedder {
  readonly dim: number;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly referer: string;
  private readonly title: string;
  private readonly fetchImpl: EmbedFetch;
  private readonly maxRetries: number;
  private readonly retryBaseMs: number;

  constructor(opts: OpenRouterEmbedderOptions) {
    if (opts.apiKey.length === 0) {
      throw new ValidationError(
        "OpenRouter embedder requires a non-empty apiKey",
        {},
      );
    }
    this.apiKey = opts.apiKey;
    this.model = opts.model ?? OPENROUTER_EMBED_MODEL;
    this.dim = opts.dim ?? OPENROUTER_EMBED_DIM;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.referer = opts.referer ?? "https://caisson.sh";
    this.title = opts.title ?? "Caisson Docs Service";
    this.fetchImpl = opts.fetchImpl ?? fetchWithTimeout;
    this.maxRetries = opts.maxRetries ?? 2;
    this.retryBaseMs = opts.retryBaseMs ?? 500;
  }

  private post(text: string): Promise<Response> {
    return this.fetchImpl(
      OPENROUTER_EMBEDDINGS_URL,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
          "http-referer": this.referer,
          "x-title": this.title,
        },
        body: JSON.stringify({
          model: this.model,
          input: text,
          dimensions: this.dim,
          // Symmetric: index + query are both embedded as documents so cosine similarity is meaningful
          // (the Embedder port can't distinguish query from doc — asymmetric input_type would need that).
          input_type: "search_document",
        }),
      },
      { timeoutMs: this.timeoutMs },
    );
  }

  private backoff(attempt: number, retryAfter: string | null): Promise<void> {
    const ra = retryAfter !== null ? Number(retryAfter) : NaN;
    const ms =
      Number.isFinite(ra) && ra > 0
        ? ra * 1000
        : this.retryBaseMs * 2 ** attempt;
    return new Promise((r) => setTimeout(r, ms));
  }

  async embed(text: string): Promise<number[]> {
    // Retry transient failures (429 / 5xx / network throw); a 4xx other than 429 (bad key / model) is
    // terminal. Bounded by maxRetries so a hard outage still fails fast (caught upstream → FTS floor).
    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        res = await this.post(text);
      } catch (err) {
        if (attempt >= this.maxRetries) throw err;
        await this.backoff(attempt, null);
        continue;
      }
      if (res.ok) {
        const json: unknown = await res.json();
        const parsed = EmbeddingsResponse.parse(json);
        const first = parsed.data[0];
        if (first === undefined) {
          throw new InternalError("OpenRouter embeddings returned no data", {});
        }
        assertEmbeddingDim(this.dim, first.embedding);
        return first.embedding;
      }
      const transient = res.status === 429 || res.status >= 500;
      if (transient && attempt < this.maxRetries) {
        await this.backoff(attempt, res.headers.get("retry-after"));
        continue;
      }
      // Status only — never the response body, the key, or the content.
      throw new InternalError("OpenRouter embeddings request failed", {
        status: res.status,
      });
    }
  }
}

/**
 * Build the production docs embedder: an OpenRouter-backed `Embedder` wrapped in local-store's
 * `guardEmbedder`, so every text is run through the T8 cloud-egress secret-scrub BEFORE the request
 * body leaves the box (ADR-0067). This is the value wired into `DocsIndex.build` at deploy.
 */
export function createOpenRouterEmbedder(
  opts: OpenRouterEmbedderOptions,
): Embedder {
  return guardEmbedder(new OpenRouterEmbedder(opts));
}
