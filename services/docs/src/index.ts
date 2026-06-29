// @caisson/service-docs — the AI-native docs corpus + retrieval service (P6, ADR-0096/0009). Builds a
// chunked, agent-queryable corpus from the repo's authoritative docs, emits a canonical llms.txt, and
// serves a typed POST /query retrieval contract the (Python) support-bot + buyer agents consume over
// HTTP. Retrieval reuses @caisson/local-store's hybrid FTS5 + sqlite-vec engine (ADR-0067); the live
// embedding provider is a deploy-gated seam (FakeEmbedder is the CI/offline path).
export { buildCorpus, findRepoRoot } from "./corpus.ts";
export type { BuildCorpusOptions, Corpus } from "./corpus.ts";
export { parseSource } from "./chunk.ts";
export { DocsIndex } from "./index-store.ts";
export { FakeEmbedder, FAKE_EMBED_DIM } from "./embedder.ts";
export { renderLlmsTxt, renderLlmsFull } from "./llms-txt.ts";
export type { RenderOptions } from "./llms-txt.ts";
export { createApp } from "./app.ts";
export type { AppDeps } from "./app.ts";
export { startServer } from "./server.ts";
export { DocChunkSchema, ScoredChunkSchema, DocKindSchema } from "./types.ts";
export type {
  DocChunk,
  ScoredChunk,
  DocKind,
  DocPage,
  DocsSource,
} from "./types.ts";
