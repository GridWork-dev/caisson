# PLAN — `services/docs` (slug `p6-docs-service`)

HOW for SPEC.md. Atomic tasks; per-task verify. Routing: **main-thread EXECUTE** (cohesive new
service, interlocking modules — not cleanly parallelizable; context-bearing conventions). Sonnet
specialist not used; the pieces share types and must integrate as one.

## Reuse (do not rebuild)

- **Retrieval engine** → `@caisson/local-store` `LocalStore` (`open/upsert/hybridSearch`, RRF FTS5+vec0,
  FTS5-floor degrade, macOS setCustomSQLite handling, golden-pinned). `StoreDoc{id,text,embedding?}` is
  generic — not tenant-coupled.
- **Embedder seam** → `@caisson/local-store` `Embedder` port + `assertEmbeddingDim`/`embedOrSkip`.
- **Error model** → `@caisson/kernel` `ValidationError`.

## File layout (`services/docs/`)

```
package.json        @caisson/service-docs · private · LicenseRef-Caisson-Commercial · deps: local-store, kernel, zod, sqlite-vec
tsconfig.json       extends @caisson/tsconfig/base · outDir dist · rootDir src
eslint.config.js    re-export @caisson/eslint-config
README.md           superseded per ADR-0096 (drop stale "Mintlify vs self-host")
src/
  types.ts          DocChunk, ScoredChunk (Zod .strict() + inferred types) + DocsSource meta
  chunk.ts          chunkMarkdown(raw, meta) → DocChunk[] (frontmatter title; one-idea H2/H3 sections; deterministic sha256 id)
  corpus.ts         buildCorpus(opts) → DocChunk[]: walk apps/site/content/docs/**.mdx + packages/*/README.md (sorted)
  embedder.ts       FakeEmbedder (deterministic hash→vec, implements local-store Embedder) — the CI seam; real OpenRouter at deploy
  index-store.ts    DocsIndex: load DocChunk[] into a LocalStore (embed via the seam) + search(query,k) → ScoredChunk[] w/ citation
  llms-txt.ts       renderLlmsTxt(corpus) (H1 + blockquote + H2 link sections, `- [T](U): D.` + `## Optional`) + renderLlmsFull(corpus)
  app.ts            request router (pure: Request + deps → Response); Bearer auth + Zod + security headers
  server.ts         Bun.serve wiring (env, build corpus + DocsIndex once, mount app)
  index.ts          public exports (the consumable contract)
  *.test.ts / *.integration.test.ts
```

## Tasks

1. **Scaffold + conformance** — `package.json` (license `LicenseRef-Caisson-Commercial`, exports
   `./src/index.ts`/dist, build=tsc, lint=eslint, test=`bun test ./src`; runtime deps
   `@caisson/local-store`, `@caisson/kernel`, `zod`, `sqlite-vec`; dev `@caisson/{eslint-config,tsconfig}`,
   `@types/bun`, eslint, typescript), `tsconfig.json`, `eslint.config.js`, rewrite `README.md`.
   _Verify:_ `bun install` clean.

2. **types.ts** — `DocChunk` (`id, source, title, section, kind:'docs'|'readme', pkg?, license, text`),
   `ScoredChunk = DocChunk & { score }`, `DocsSource` meta. Zod `.strict()`, inferred types.
   _Verify:_ `tsc --noEmit`.

3. **chunk.ts** — `chunkMarkdown(raw, meta) → DocChunk[]`: strip frontmatter (capture title/desc),
   strip MDX/JSX noise, split on `##`/`###` into one-idea sections (heading-prefixed so each chunk is
   self-contained — Fern's RAG guidance), deterministic id = `sha256(source + '#' + section)` slice.
   _Verify:_ unit — fixed input → stable chunks + ids; headings preserved in chunk text.

4. **corpus.ts** — `buildCorpus(opts) → DocChunk[]`: enumerate `apps/site/content/docs/**/*.mdx`
   (sorted) + `packages/*/README.md` (sorted), chunk each, tag kind/pkg/license. Deterministic order.
   _Verify:_ integration — corpus non-empty, sorted, byte-stable across two builds.

5. **embedder.ts** — `FakeEmbedder` implementing local-store `Embedder` (`dim`, `embed`): deterministic
   token-hash bag-of-words → unit-normalized `number[dim]` (semantically inert but stable + shaped like a
   real embedding so RRF wiring is exercised). The documented CI seam; real OpenRouter embedder is a
   deploy wire. _Verify:_ unit — same text → identical vector; correct dim; differing texts differ.

6. **index-store.ts** — `DocsIndex.build(chunks, embedder?)`: `LocalStore.open({dim})`, `upsert` each
   chunk (text + `embedOrSkip` vector); `search(query, k)` → `hybridSearch` → map `SearchHit.id` →
   `DocChunk` + `{score}` citation. No embedder ⇒ FTS5 floor. _Verify:_ integration — "how does billing
   verify webhooks" ranks the billing-webhook chunk #1 (both FTS-floor and with FakeEmbedder).

7. **llms-txt.ts** — `renderLlmsTxt(corpus)` (H1 `# Caisson` + blockquote summary + H2 sections grouping
   `- [Title](URL): Description.` links + a `## Optional` tail) + `renderLlmsFull(corpus)` (concatenated
   chunk bodies with source headers). URL base from a config (the docs site origin). _Verify:_ unit —
   exact link-line format, blockquote present, deterministic.

8. **app.ts + server.ts** — router: `GET /health`→200; `GET /llms.txt`/`/llms-full.txt`→text (public);
   `POST /query`→Bearer `DOCS_SERVICE_TOKEN` (`timingSafeEqual`, equal-length guard), Zod `.strict()`
   `{query(≤2k), k?(1-20)}` → `{chunks}`. Security headers (nosniff/frame-deny/HSTS) on every response;
   401/404/405/400 paths. `server.ts` = `Bun.serve` + env + one-time corpus+index build. _Verify:_
   integration — 401 no/bad token (timing-safe), 200 valid, 400 oversized/unknown field, 404 unknown
   path, 405 wrong method, health 200.

9. **index.ts** — export the contract (`buildCorpus`, `DocsIndex`, `FakeEmbedder`, `renderLlmsTxt/Full`,
   `createApp`, types). _Verify:_ `tsc --noEmit` + `bun test ./src` green.

10. **Gate + act trail** — `bun run check` + `bun run gate` green on-box; `VERIFY.md` (goal-backward) +
    `SWEEP.md`; `gw-security-auditor` on the diff (`auth`); reconcile `docs/build-state.md` +
    `docs/state/readiness-and-backlog.md`; capture memory. _Verify:_ all green; audit PASS.

## Risks / gotchas

- **Determinism** — sort every fs walk; ids from content hash, not iteration order; no `Date.now()` in
  corpus/llms output.
- **MDX parsing** — keep it a pragmatic regex strip (frontmatter + JSX tags), not a full MDX AST; the
  corpus is for retrieval text, not rendering.
- **Bun test on `dist`** — `test` script is `bun test ./src` (avoids the compiled `dist/__golden__`
  glob gotcha).
- **No DB** — corpus is in-memory from fs; no PGlite, no Neon. Keeps the slice now-local.
- **`timingSafeEqual` length** — guard equal length before compare (avoids throw-as-sidechannel), per
  the security floor's fixed-length token rule.
