# SWEEP — `services/docs` (Act 5, downstream impact + gaps)

What else moved, what's now unblocked, what to queue.

## Downstream impact

- **No breaking changes.** New workspace member `@caisson/service-docs` (private, commercial); only the
  root `bun.lock` changed besides the new tree. No existing package's API touched. `apps/site`'s own
  `/llms.txt` (Fumadocs) is untouched — the two are complementary by ADR-0096.
- **Standards surface:** the gate count moved 36→42 checked, **0 scaffold-skipped** (services/docs now
  ships code). Both gates green; the open↔commercial boundary holds (commercial service → commercial/open
  base deps only).
- **CI:** the new package's `build`/`lint`/`test` ride the existing turbo tasks on the self-hosted
  fleet `check` job. `test` runs the real sqlite-vec extension (Linux fleet loads it natively;
  local-store owns the macOS `setCustomSQLite` path). No new CI wiring needed.

## Unblocked

- **`services/support-bot` (Bucket C item 2)** — its RAG now has a corpus + a retrieval contract to
  consume: `POST /query` over HTTP (language-agnostic, so the Python bot calls it directly). ADR-0096's
  "docs precede the bot" sequencing is satisfied.
- **Buyer-agent grounding** — the same `/query` + `/llms.txt` surface grounds buyer agents (ADR-0009).

## Gaps queued (non-blocking)

| Gap                                                                                                                                                                                                                      | Where it lands                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| **Real embedder wire** (OpenRouter `qwen3-embedding-8b`) for semantic recall — replace `DocsIndex.build(chunks)` with `…(chunks, embedder)` in `server.ts`; needs `OPENROUTER_API_KEY` + `fetchWithTimeout` embed client | support-bot slice or a `needs-config` follow-up (readiness §2) |
| **Persistent index + hosted deploy** of the docs service (DEPLOY-class)                                                                                                                                                  | sequenced with the support-bot deploy                          |
| **ADR/spec ingestion** into the corpus (config flag, default off)                                                                                                                                                        | when internal-doc grounding is wanted                          |
| **`apps/site` ↔ services/docs `llms.txt` unification** (optional — they're decoupled by design today)                                                                                                                    | optional later                                                 |
| **Embedding-text egress note** — when the real embedder lands, chunk text egresses to OpenRouter; add the security-surfaces ledger row + skip any credential-bearing source (mirrors the gridwork memory-embed rule)     | with the embedder wire                                         |

## Tech-debt check

- Zero accidental TODO/FIXME introduced. The one in-source seam (`server.ts` embedder wire) is
  ADR-sanctioned and commented. No copy-paste (gate green). No `any`, no `console.log`.
- `FakeEmbedder` is explicitly framed as a test-only wiring stub (not a retriever) in code + VERIFY —
  prevents a future reader from mistaking it for the offline production path.
