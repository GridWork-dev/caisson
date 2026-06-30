# SPEC — services/support-bot (P6 Bucket C item 2)

tags: `ai`, `auth`, `secrets`, `external-system`
ADRs: implements ADR-0009 (shape) + ADR-0105 (implementation locks); consumes ADR-0096 (docs /query)

## Goal

A custom, self-built **Discord AI support bot** that answers community questions **grounded only in
the Caisson codebase/docs** (via the `services/docs` `POST /query` RAG contract), and on any question
it cannot resolve, **drafts an AI brief, opens a thread tagging a human, and persists a
`support_ticket` row**. Hosted inference (OpenRouter), cloud-deployed. Doubles as a buyer-shippable
template.

## Why

Support is a retention lever (docs/support quality is a measured dev-tool retention driver) and the
Discord community is the moat (ADR-0009). One content artifact — the docs corpus + `llms.txt` — powers
the bot AND buyers' own agents. Owning the bot (vs Inkeep/Plain/Pylon) lets us ship it as a value-add.

## In scope

- A `discord.py` 2.x bot: `/ask <question>` slash command + an `#ask-ai` channel listener, both
  through one RAG pipeline.
- A **RAG pipeline**: retrieve from `services/docs /query` → assemble a grounded, citation-carrying
  prompt → generate via OpenRouter → decide _resolved_ vs _escalate_.
- A grounded answer with **source citations** (the chunk `source` paths), or an honest "I don't know,
  a human will follow up" when context is insufficient (never an ungrounded answer).
- **Escalation**: build an AI brief (question + retrieved sources + why-unresolved) → open a Discord
  thread + tag `@support` + insert a `support_ticket` row (`ai_brief`).
- Thin httpx clients (docs + OpenRouter) with bounded timeouts; pydantic-validated boundaries.
- Full Python toolchain (uv/ruff/pyright/pytest) + an advisory CI lane on the self-hosted fleet.
- A `Dockerfile` + `/health` endpoint so a cloud runner (Railway/Fly) can host it.

## Out of scope (deferred seams)

- Live deploy to a cloud runner (operator-gated DEPLOY; target recommended = Railway).
- The real OpenRouter generation key + Discord bot token + Postgres DSN (operator secrets).
- An Anthropic-direct inference impl (the port is ready).
- Multi-turn conversation memory / per-user rate limits (single-shot Q→A first).

## Contracts

- **Consumes** `services/docs`: `POST {DOCS_SERVICE_URL}/query`, `Authorization: Bearer
{DOCS_SERVICE_TOKEN}`, body `{query: str≤2000, k?: 1..20}` → `{chunks: ScoredChunk[]}` where a
  `ScoredChunk = {id, source, title, section, kind, pkg?, license, text, score}`.
- **Calls** OpenRouter: `POST https://openrouter.ai/api/v1/chat/completions`, `Authorization: Bearer
{OPENROUTER_API_KEY}`, body `{model, messages, temperature, max_tokens}`.
- **Writes** Postgres `support_ticket(id, question, ai_brief, status, created_at, discord_thread_id?)`.

## Security floor (Python-adapted from identity/security.md)

- Secrets from env only (pydantic-settings); never hardcoded; fail-closed if a required secret is
  unset at startup.
- Bounded timeouts on every outbound httpx call (the `fetchWithTimeout` invariant).
- Parameterized SQL only (asyncpg `$1` placeholders) — no f-string SQL.
- Bound + trim user input to the docs `/query` max (2000) before dispatch; pydantic models with
  constraints at every boundary (the Zod `.strict()` analogue).
- The grounded system prompt instructs the model to answer ONLY from supplied context and to emit an
  explicit `INSUFFICIENT_CONTEXT` sentinel rather than guess (no hallucinated support — ADR-0009).
- `/health` is unauthenticated liveness only (no secret); any future token check uses
  `hmac.compare_digest`.

## Acceptance (goal-backward)

1. A question with a matching doc chunk → a grounded answer citing the chunk `source`(s).
2. A question with no retrieval (or model-signalled insufficient context) → NO ungrounded answer;
   instead an AI brief + a thread + a `support_ticket` row are produced.
3. The docs + OpenRouter clients are exercised in CI with no live secrets (MockTransport).
4. `ruff` + `pyright` clean; `pytest` green; the CI lane runs on the fleet.
5. A `python -m caisson_support_bot` entrypoint connects the live gateway when secrets are present
   (manually verifiable; not run in CI).
