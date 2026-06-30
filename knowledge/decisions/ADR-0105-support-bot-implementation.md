# ADR-0105 — support-bot implementation locks (discord.py · OpenRouter · thread+Postgres escalation)

Status: accepted · 2026-06-29 · implements ADR-0009 (does not supersede it) · Phase P6 Bucket C

ADR-0009 locked the _shape_ of `services/support-bot` (custom-built · Discord · Python · codebase
RAG · hosted inference · cloud-deployed · AI-brief escalation · doubles as a buyer template). This
ADR locks the implementation forks the operator resolved in the build picker (2026-06-29), inside
that envelope. Append-only; supersede with a later ADR, never edit.

## Decisions

1. **Discord library → `discord.py` 2.x.** The production standard (largest community + most
   examples), `app_commands` slash + a `message_content` channel listener. Chosen over Pycord /
   interactions.py because the bot **doubles as a buyer-shippable template** — buyers' own devs find
   the most answers against discord.py. Surface: a `/ask` slash command **and** an `#ask-ai` channel
   listener, both routed through one RAG pipeline.

2. **Generation inference → OpenRouter, one credential.** A single `OPENROUTER_API_KEY` covers both
   the docs-service embedder (qwen3-embedding, deploy seam) **and** generation, via a thin httpx
   client over `POST /api/v1/chat/completions` (OpenAI-compatible). Provider-agnostic = on-brand
   "AI Production Kit"; model is swappable by env without code change. The inference call sits behind
   an `Inference` port (a `FakeInference` drives tests), so an Anthropic-direct impl can be added
   later without touching the pipeline. No native vendor SDK — the thin client is more transparent
   for the template buyer and keeps the dependency surface small.

3. **Retrieval → HTTP to `services/docs` `POST /query`** (ADR-0009 / ADR-0096 contract): Bearer
   `DOCS_SERVICE_TOKEN`, body `{query≤2000, k?:1..20}` → `{chunks: ScoredChunk[]}`. The bot is a
   client only; it never embeds the corpus itself (one corpus, one owner). Bounded httpx timeouts on
   every outbound call (the Python analogue of the repo's `fetchWithTimeout` invariant).

4. **Escalation store → both a Discord thread AND a Postgres `support_ticket` row.** On an unresolved
   question (empty retrieval, or the grounded model signals insufficient context) the bot opens a
   thread, posts the AI brief, and tags a human `@support` role (community-native handoff) **and**
   persists a `support_ticket` row carrying `ai_brief` (durable + queryable for a future dashboard,
   matching the ADR-0009 `support_ticket.ai_brief` naming). Both sit behind a `TicketStore` port
   (`InMemoryTicketStore` for tests; `PostgresTicketStore` via asyncpg, parameterized SQL only).

5. **Build depth → full runnable bot, hermetic CI.** All real code paths exist — the live discord.py
   gateway entrypoint, the real OpenRouter + docs httpx clients, the asyncpg Postgres store. CI stays
   secret-free: httpx `MockTransport` exercises the clients, `FakeInference` + `InMemoryTicketStore`
   drive the pipeline, the gateway handlers are unit-tested against fake interactions. **Live secrets
   (`DISCORD_TOKEN`, `OPENROUTER_API_KEY`, `DOCS_SERVICE_TOKEN`, `DATABASE_URL`) + cloud deploy are
   the operator-gated seam** — the same philosophy as the docs-service FakeEmbedder/deploy seam.

6. **Python toolchain (first Python surface in the repo) → uv + ruff + pyright + pytest**, Python
   3.12, `pyproject.toml`, NOT in the Bun workspace (workspaces lists `services/{license,docs}`
   explicitly, not `services/*`), so `bun install` and the TS gates are untouched. A new advisory CI
   job (`support-bot`) runs the Python gate on the self-hosted `gw-linux-amd64` fleet.

## Deferred (recommended, not blocking — operator-gated DEPLOY act)

- **Cloud runner target → Railway (recommended).** Easiest no-sleep git-push deploy for an always-on
  gateway ($5/mo, persistent process, one-click Postgres); Fly.io is the cheaper edge alternative
  (~$2-5/mo, Docker). Picked at DEPLOY, not at build. A `Dockerfile` + health endpoint ship so either
  target works.
- **Anthropic-direct inference impl** — the `Inference` port is ready; add when/if quality demands it.
- **Buyer-facing template extraction** — the bot is built template-clean, but packaging it as a
  shippable value-add is a later GTM slice.

## Binding (carried from ADR-0009)

The bot answers **only** from the docs/codebase RAG (no ungrounded answers); every escalation carries
an AI brief; it is the only support component on cloud infra.
