# SPEC — `services/docs` (AI-native docs corpus + retrieval service)

- Phase: **P6 Bucket C**, item 1 of 2 (the docs corpus precedes the support-bot — ADR-0096 sequences
  the RAG corpus before the bot that grounds on it).
- Locks: **ADR-0096** (services/docs is a standalone AI-native docs service, distinct from `apps/site`
  Fumadocs) · **ADR-0009** (the corpus feeds the support-bot RAG + buyer agents). No open fork.
- Tags: `ai` (agent-facing retrieval surface), `auth` (Bearer-gated `/query`).
- Slug: `p6-docs-service`.

## Goal (the thing VERIFY re-asks)

Stand up `services/docs` as the **first-class, agent-queryable docs corpus** for Caisson: it builds a
chunked, retrieval-ready corpus from the repo's authoritative docs, emits a canonical `llms.txt` /
`llms-full.txt`, and serves a typed HTTP retrieval contract (`POST /query`) that the (Python)
support-bot and buyer agents consume cross-language. Read-by-agents — distinct from `apps/site`'s
read-by-humans Fumadocs site (which keeps its own static `llms.txt` mirror, ADR-0084, unchanged).

## Why

ADR-0009's support-bot "never answers from anything but the codebase/docs RAG (no hallucinated
support)". That RAG needs a corpus + a retrieval contract. ADR-0096 locked this as a **standalone
service** (not folded into `apps/site`) so the bot and buyer agents have a first-class surface to
query, decoupled from the static marketing app. The README's stale "Mintlify vs self-host" line is
superseded by ADR-0096 (self-built, in-monorepo, operator-owned per ADR-0009).

## In scope (buildable now — no external account, deterministic, CI-exercised)

1. **Corpus builder** — walk the authoritative public docs (`apps/site/content/docs/**/*.mdx` +
   `packages/*/README.md`), normalize to typed `DocChunk[]` (id, source, title, section, text, kind,
   edition/package tag, SPDX license tag), Zod `.strict()`, deterministic heading-based chunking.
2. **`llms.txt` + `llms-full.txt` emitter** — llmstxt.org-format index + concatenated corpus,
   generated FROM the corpus (the service's canonical source-of-truth artifact).
3. **Retriever** — **reuse `@caisson/local-store`'s `LocalStore`** (hybrid `bun:sqlite` FTS5 +
   sqlite-vec `vec0`, fused by RRF, FTS5-floor degrade, golden-pinned, ADR-0067) + its `Embedder` port
   — do **not** rebuild retrieval (ADR-0003 service→base composition; no-copy-paste). New code is a thin
   `DocsIndex` wrapper: load `DocChunk[]` into a `LocalStore`, map `SearchHit.id → DocChunk` + citation,
   expose `search(query, k) → ScoredChunk[]`. The semantic leg runs through a **`FakeEmbedder`**
   (deterministic hash→vector, the ADR-0064-pattern stub) in CI; a **real OpenRouter embedder**
   (`qwen3-embedding-8b`, already in the stack, 1024-dim) wires at deploy with one env — vector path
   built + tested offline, live transport deploy-gated. With no embedder, retrieval is the FTS5 floor.
4. **HTTP service** — Bun server: `GET /health` (public), `GET /llms.txt` + `GET /llms-full.txt`
   (public artifacts), `POST /query` (**Bearer `DOCS_SERVICE_TOKEN`, `crypto.timingSafeEqual`**, Zod
   `.strict()` bounded body → ranked chunks). Security headers (nosniff/frame-deny/HSTS), no-CORS
   default (server-to-server). The HTTP contract is the cross-language seam the Python bot hits.
5. **Tests** — corpus determinism + schema, llms.txt format, lexical ranking (known query → expected
   top chunk), route auth (401/200 timing-safe), input validation (rejects oversized/unknown fields).
6. **Conformance** — `package.json` (`@caisson/service-docs`, `private`,
   `license: LicenseRef-Caisson-Commercial`, exports/build/lint/test), `tsconfig`, `eslint.config.js`
   mirroring `services/license`; README superseded per ADR-0096. Green `bun run check` + standards-gate.

## Out of scope (ADR-sanctioned seams / later slices — typed ports, not built live)

- **Live embedding provider** (real OpenRouter `qwen3-embedding-8b`) — the hybrid vector PATH is built
  - tested via `FakeEmbedder`; the live provider call is the deploy-gated seam (one env to flip).
- **`services/support-bot`** (Bucket C item 2 — Python; needs Discord token + hosted-inference key +
  cloud-runner deploy; next slice).
- **Persistent vector index + hosted deploy** of the docs service (DEPLOY-class, operator-gated).
- **Cross-wiring into `apps/site`** (it already ships its own Fumadocs `llms.txt`; unification is optional later).
- **ADRs/specs in the agent corpus** — default corpus is buyer-facing public docs only; ADR/spec
  ingestion is a config flag, default off (internal decision records).

## Verification (goal-backward)

- `bun run check` green (turbo build·lint·test) + `bun run gate` green (services exempt from module
  checks; license field correct).
- Corpus build is deterministic (same input → byte-identical corpus + llms.txt) — golden assertion.
- `POST /query` with a known support question returns the correct doc chunk as top hit, with citation.
- `/query` returns 401 without a valid Bearer (timing-safe), 200 with; oversized/unknown-field bodies
  rejected by Zod `.strict()`.
- Security audit (`auth` tag) PASS on the diff. EVAL: **N/A** — no live model/prompt in this slice
  (retrieval is deterministic lexical; the embedding model is a stubbed seam).

## Exit

One atomic PR `feat(docs): …`, green CI (incl. fleet gate jobs), goal-backward VERIFY + SWEEP notes,
`auth` security audit PASS, `docs/build-state.md` + `docs/state/readiness-and-backlog.md` reconciled
(services/docs pending → partial/shipped), memory captured.
