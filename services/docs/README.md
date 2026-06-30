# services/docs (`@caisson/service-docs`)

The **AI-native docs corpus + retrieval service** (P6, ADR-0096 / ADR-0009). It builds a chunked,
agent-queryable corpus from the repo's authoritative docs, emits a canonical `llms.txt` /
`llms-full.txt`, and serves a typed `POST /query` retrieval contract that the (Python)
`services/support-bot` and buyer agents consume **cross-language over HTTP**.

**Read-by-agents** — distinct from `apps/site`'s read-by-humans Fumadocs site (ADR-0084), which keeps
its own static `llms.txt` mirror. This service is the first-class corpus the support-bot RAG grounds
on (ADR-0009: "never answers from anything but the codebase/docs RAG").

> Supersedes the old scaffold note ("Mintlify vs self-host"): ADR-0096 locked this as a **standalone,
> operator-owned, in-monorepo service** — not a vendor, not folded into `apps/site`.

## How it works

```
apps/site/content/docs/**.mdx  ┐
packages/*/README.md           ┘─► buildCorpus() ─► DocChunk[]  (one-idea sections + metadata)
                                                       │
                                            DocsIndex (reuses @caisson/local-store LocalStore)
                                              ├─ FTS5 (bm25)         — deterministic, always on
                                              └─ sqlite-vec vec0     — via the Embedder seam
                                                   · CI:     FakeEmbedder (deterministic hash vecs)
                                                   · deploy: OpenRouter qwen3-embedding-8b (1024-dim)
                                              └─ RRF fuse ─► top-k ScoredChunk[] + citations

HTTP:  GET /health · GET /llms.txt · GET /llms-full.txt   (public)
       POST /query  (Bearer DOCS_SERVICE_TOKEN)  → ranked chunks
```

The retrieval engine is **reused, not rebuilt** — `@caisson/local-store`'s `LocalStore` already ships
the hybrid `bun:sqlite` FTS5 + sqlite-vec `vec0` RRF retrieval (ADR-0067). With no embedder configured,
retrieval degrades to the FTS5 floor (fully offline). The live embedding provider is a deploy-gated
seam (one env); CI exercises the full vector path through a deterministic `FakeEmbedder`.

## Run

```bash
bun run --filter @caisson/service-docs start   # serves on PORT (default 8788)
bun test ./src                                  # the suite
```

Env: `DOCS_SERVICE_TOKEN` (Bearer for `/query`), `PORT`, `DOCS_SITE_ORIGIN` (llms.txt link base).
A real embedder is wired at deploy (out of scope for this slice).
