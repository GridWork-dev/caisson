# VERIFY — `services/docs` (goal-backward, Act 4)

Re-asking the SPEC goal against the merged diff + tests — not a task checklist.

**Goal:** stand up `services/docs` as the first-class, agent-queryable docs corpus — chunked corpus
from authoritative docs, canonical `llms.txt`/`llms-full.txt`, and a typed `POST /query` retrieval
contract the (Python) support-bot + buyer agents consume cross-language; read-by-agents, distinct from
`apps/site`.

## Verdict: **PASS (in-scope)** — the buildable-now corpus + retrieval + HTTP contract is real,

tested, and conformant. The live embedding provider is the one deploy-gated seam (by design, ADR-0064
pattern); the bare FTS floor is precise-but-low-recall on full sentences offline (honest fail-closed).

## Clause-by-clause

| SPEC clause                                                                                            | Evidence                                                                                                                                                                           | Status                    |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Corpus from `content/docs/**.mdx` + `packages/*/README.md`, typed + metadata, deterministic            | `corpus.ts` + `chunk.ts`; `corpus.integration.test.ts` (byte-stable across rebuilds, schema-valid, base docs tagged Apache-2.0); live boot indexed **121 chunks**                  | ✅                        |
| One-idea-per-section chunking, heading preserved (self-contained)                                      | `chunk.ts` `splitSections` keeps the heading in chunk text; `chunk.test.ts` asserts it                                                                                             | ✅                        |
| `llms.txt` + `llms-full.txt` in llmstxt.org format                                                     | `llms-txt.ts`; `llms-txt.test.ts` asserts exact `- [Title](URL): Description.` lines, H1 + blockquote + H2 sections; live `/llms.txt` renders correctly                            | ✅                        |
| Retrieval reuses `@caisson/local-store` (hybrid FTS5+vec0 RRF) + `Embedder` port — not rebuilt         | `index-store.ts` composes `LocalStore`; no retrieval engine duplicated (copy-guard gate green)                                                                                     | ✅                        |
| Hybrid vector path built + exercised offline; real embedder deploy-gated                               | `FakeEmbedder` (wiring stub) + `index-store.integration.test.ts` hybrid leg ranks the on-topic chunk; real OpenRouter embedder wires at `server.ts` `DocsIndex.build(…, embedder)` | ✅ (live provider = seam) |
| `POST /query` Bearer-gated (`timingSafeEqual`), Zod `.strict()` bounded, security headers, fail-closed | `app.ts` + `server.ts`; `app.integration.test.ts` (401 no/bad token, 200 valid, 400 oversized/unknown-field/bad-JSON, 404, 405, security headers present)                          | ✅                        |
| Cross-language seam = HTTP (Python bot)                                                                | `POST /query` JSON contract; `ScoredChunk` is Zod-validated; no TS import required by the consumer                                                                                 | ✅                        |
| Conformance: license + both gates + `bun run check`                                                    | `package.json` `LicenseRef-Caisson-Commercial`; kernel gate (42 checked, conform) + standards-gate (0 errors) green; turbo **122/122**                                             | ✅                        |

## Goal-backward question: _did the code achieve the stated goal?_

**Yes, for the in-scope surface.** An agent can fetch a canonical corpus index (`/llms.txt`), pull the
full corpus (`/llms-full.txt`), and retrieve cited chunks for a query (`POST /query`) over an
auth-gated, validated HTTP contract — the support-bot's RAG grounding surface now exists. The corpus is
deterministic and conformant.

## Honest gaps (carried to SWEEP / build-state)

1. **Semantic recall needs the deploy-wired embedder.** Offline the server runs the bare FTS floor
   (exact phrase / keyword) — a natural-language sentence with no exact phrase returns `[]` (precise,
   fail-closed, never confidently-wrong). Real semantic recall ships when the OpenRouter embedder is
   wired at deploy. `FakeEmbedder` validates the hybrid WIRING only; it is semantically inert on the
   real corpus (must NOT be the production retriever).
2. **No persistent index / hosted deploy** — the corpus is rebuilt in-memory at boot (DEPLOY-class).
3. **Live embedding transport un-exercised** — the `Embedder` port is wired; the real provider call is
   the seam (no network in this slice).

## EVAL: N/A

No live model or prompt in this slice — retrieval is deterministic (FTS floor) and the embedder is a
stub. There is nothing to eval until the real embedder + a grounded-answer surface land (the support-bot
slice). No EVAL act required.
