# PLAN — services/support-bot

Atomic tasks, each its own commit. Verify command per task. Routing: Opus main thread (context-bearing,
auth/secrets-tagged, first Python surface — security-sensitive). No subagent fanout.

## Layout

```
services/support-bot/
  pyproject.toml          uv project; deps: discord.py, httpx, pydantic, pydantic-settings, asyncpg
                          dev: pytest, pytest-asyncio, ruff, pyright
  .python-version         3.12
  Dockerfile              slim python; runs `python -m caisson_support_bot`
  README.md               (update the stub)
  ruff.toml / [tool.*]    in pyproject
  src/caisson_support_bot/
    __init__.py
    config.py             Settings (pydantic-settings): tokens, URLs, model, channel/role ids
    contracts.py          pydantic models: ScoredChunk, DocsQueryResponse, AnswerResult, Ticket, Brief
    docs_client.py        async DocsClient.query(q,k) -> list[ScoredChunk]  (httpx, Bearer, timeout)
    inference.py          Inference port + OpenRouterInference (httpx) + FakeInference
    rag.py                RagPipeline.answer(question) -> AnswerResult (retrieve→ground→generate→decide)
    escalation.py         build_brief(); TicketStore port + InMemory + Postgres(asyncpg); Escalator
    bot.py                discord.py: /ask slash + on_message #ask-ai listener → pipeline → reply/escalate
    health.py             tiny asyncio HTTP /health for cloud-runner liveness
    __main__.py           load Settings, build deps, start health + gateway
  tests/
    conftest.py, test_contracts.py, test_docs_client.py, test_inference.py,
    test_rag.py, test_escalation.py, test_bot_handlers.py
```

## Tasks

1. **scaffold + toolchain** — pyproject (deps + ruff/pyright/pytest config), .python-version,
   Dockerfile, **init**, update README. Verify: `uv sync && uv run ruff check . && uv run pyright`
   (pyright may warn on empty src — acceptable until task 2).
2. **config + contracts** — `Settings` + pydantic boundary models. Verify: `uv run pytest tests/test_contracts.py`.
3. **docs_client** — httpx Bearer client over `/query`, bounded timeout, pydantic-parsed. Verify:
   `pytest tests/test_docs_client.py` (httpx MockTransport — 200 happy, 401, timeout).
4. **inference** — `Inference` port, `OpenRouterInference` (httpx chat/completions), `FakeInference`.
   Verify: `pytest tests/test_inference.py` (MockTransport asserts headers/body; fake returns canned).
5. **rag pipeline** — retrieve → grounded prompt (citations + `INSUFFICIENT_CONTEXT` sentinel) →
   generate → `AnswerResult{resolved, answer, citations, brief?}`. Verify: `pytest tests/test_rag.py`
   (resolved path, empty-retrieval→escalate, sentinel→escalate).
6. **escalation** — `build_brief`, `TicketStore` port + InMemory + Postgres(asyncpg, parameterized),
   `Escalator` (thread + tag + store). Verify: `pytest tests/test_escalation.py` (InMemory; brief shape;
   Postgres SQL is parameterized — asserted by string inspection / skipped integration).
7. **bot + health + entrypoint** — discord.py `/ask` + listener handlers (unit-testable, fake
   interaction), `/health`, `__main__`. Verify: `pytest tests/test_bot_handlers.py` + `python -c import`.
8. **CI lane** — add an advisory `support-bot` job to `.github/workflows/ci.yml` (setup-uv → ruff →
   pyright → pytest) on `[self-hosted, gw-linux-amd64]`. Verify: yaml lint + local full `pytest`.
9. **act trail + state** — VERIFY + SWEEP notes; reconcile `docs/build-state.md`,
   `docs/state/readiness-and-backlog.md`, the decisions board; ADR-0105 already written. Verify: `gw verify docs` if applicable.

## Threat model (drives the SECURITY audit at SHIP — auth/secrets/external-system tags)

- T1 secret leak: tokens in code/logs → env-only, never logged; fail-closed startup.
- T2 SSRF/unbounded egress: only two sinks (docs URL from env, OpenRouter constant) → both bounded
  timeout; docs URL validated `https`/host-from-config.
- T3 SQL injection on the ticket store → parameterized asyncpg only.
- T4 prompt injection / ungrounded answer → grounded system prompt + sentinel + citations; escalate
  on insufficiency (ADR-0009 binding).
- T5 input abuse: oversized/garbage question → trim + length cap + pydantic bounds before dispatch.
- T6 the new external sinks (OpenRouter generation, Discord gateway) → record a row in
  `identity/security-surfaces.md`-equivalent (note in SECURITY.md; gridwork ledger is cross-repo).
