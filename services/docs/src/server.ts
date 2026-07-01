// src/server.ts — the runnable entrypoint (ADR-0096). Builds the corpus + index ONCE at boot, renders
// the llms artifacts, and serves the router over Bun.serve. Fail-closed: a missing DOCS_SERVICE_TOKEN
// aborts startup rather than serving an open /query.
//
// Retrieval mode is chosen at boot by the presence of OPENROUTER_API_KEY (the ADR-0096 DEPLOY wire):
//   • key present → the live OpenRouter `qwen3-embedding-8b` embedder lights up the hybrid vector leg
//     (semantic recall). A failure building that leg (OpenRouter down / bad key / dim drift) DEGRADES to
//     the FTS5 floor rather than crash-looping the service — the floor is the honest degraded mode.
//   • no key (CI / local / offline) → the deterministic FTS5 floor alone: a natural-language sentence
//     with no exact match returns [] rather than a confidently-wrong chunk.
import { initObservability } from "@caisson/observability";
import { createApp } from "./app.ts";
import { buildCorpus } from "./corpus.ts";
import { DocsIndex } from "./index-store.ts";
import { renderLlmsFull, renderLlmsTxt } from "./llms-txt.ts";
import { createOpenRouterEmbedder } from "./openrouter-embedder.ts";
import { loadRateLimitConfig, TokenBucketLimiter } from "./rate-limit.ts";
import type { DocChunk } from "./types.ts";

const DEFAULT_PORT = 8788;

/**
 * Build the retrieval index. Wires the live OpenRouter embedder when OPENROUTER_API_KEY is set (hybrid
 * semantic + FTS5), else the deterministic FTS5 floor. A throw while building the vector leg (provider
 * outage, bad key, dim drift) is caught and degraded to the floor — a degraded answer beats a crash-loop.
 */
async function buildIndex(chunks: DocChunk[]): Promise<DocsIndex> {
  const key = process.env.OPENROUTER_API_KEY ?? "";
  if (key.length === 0) {
    process.stderr.write(
      "[service-docs] no OPENROUTER_API_KEY — FTS5 floor only\n",
    );
    return DocsIndex.build(chunks);
  }
  try {
    const index = await DocsIndex.build(
      chunks,
      createOpenRouterEmbedder({ apiKey: key }),
    );
    process.stderr.write(
      "[service-docs] semantic index built (OpenRouter qwen3-embedding-8b, 1024-dim)\n",
    );
    return index;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      `[service-docs] embedder build failed — degrading to FTS5 floor: ${msg}\n`,
    );
    return DocsIndex.build(chunks);
  }
}

export async function startServer(): Promise<{
  port: number;
  stop: () => void;
}> {
  // ADR-0117: wired first, before any other boot work — instrumentation must be live before the
  // modules it patches (node:http, pg) are first required. Env-gated: a no-op when
  // OTEL_EXPORTER_OTLP_ENDPOINT is unset (CI / local / no SigNoz configured).
  initObservability({ serviceName: "service-docs" });

  const token = process.env.DOCS_SERVICE_TOKEN ?? "";
  if (token.length === 0) {
    throw new Error(
      "DOCS_SERVICE_TOKEN is required (POST /query is fail-closed) — refusing to start.",
    );
  }
  // `||` not `??`: a blank PORT="" must fall back to the default, not coerce to Number("")=0 (ephemeral).
  const port = Number(process.env.PORT || DEFAULT_PORT);
  const origin = process.env.DOCS_SITE_ORIGIN;

  const corpus = buildCorpus();
  const index = await buildIndex(corpus.chunks);
  const llmsTxt = renderLlmsTxt(corpus, origin !== undefined ? { origin } : {});
  const llmsFull = renderLlmsFull(corpus);

  // Per-IP token-bucket limiter (hardening #1). Config is Zod-validated from env with safe defaults; a
  // present-but-invalid limit fails startup closed rather than serving with a silently-wrong budget.
  const limiter = new TokenBucketLimiter(loadRateLimitConfig());
  const handler = createApp({ index, llmsTxt, llmsFull, token, limiter });
  const server = Bun.serve({ port, fetch: handler });
  process.stderr.write(
    `[service-docs] serving ${corpus.chunks.length} chunks on :${server.port}\n`,
  );
  return { port: server.port ?? port, stop: () => server.stop(true) };
}

if (import.meta.main) {
  await startServer();
}
