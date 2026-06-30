// src/server.ts — the runnable entrypoint (ADR-0096). Builds the corpus + index ONCE at boot, renders
// the llms artifacts, and serves the router over Bun.serve. Fail-closed: a missing DOCS_SERVICE_TOKEN
// aborts startup rather than serving an open /query. Retrieval runs on the bare FTS5 floor here (no
// embedder): PRECISE (exact phrase / keyword) — a natural-language sentence with no exact match returns
// [] rather than a confidently-wrong chunk (the honest, fail-closed degraded mode; FakeEmbedder is a
// test-only WIRING stub, not a retriever — semantically inert on the real corpus). Semantic recall is
// the DEPLOY wire: pass a real embedder (OpenRouter qwen3-embedding-8b) to DocsIndex.build below,
// behind the same local-store Embedder port, to light up the hybrid vector leg.
import { createApp } from "./app.ts";
import { buildCorpus } from "./corpus.ts";
import { DocsIndex } from "./index-store.ts";
import { renderLlmsFull, renderLlmsTxt } from "./llms-txt.ts";

const DEFAULT_PORT = 8788;

export async function startServer(): Promise<{
  port: number;
  stop: () => void;
}> {
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
  // FTS5 floor (no embedder). At deploy, wire the real embedder here for semantic recall:
  // DocsIndex.build(corpus.chunks, openRouterEmbedder).
  const index = await DocsIndex.build(corpus.chunks);
  const llmsTxt = renderLlmsTxt(corpus, origin !== undefined ? { origin } : {});
  const llmsFull = renderLlmsFull(corpus);

  const handler = createApp({ index, llmsTxt, llmsFull, token });
  const server = Bun.serve({ port, fetch: handler });
  process.stderr.write(
    `[service-docs] serving ${corpus.chunks.length} chunks on :${server.port}\n`,
  );
  return { port: server.port ?? port, stop: () => server.stop(true) };
}

if (import.meta.main) {
  await startServer();
}
