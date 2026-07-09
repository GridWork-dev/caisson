# VERIFY — services/support-bot (goal-backward vs SPEC)

Re-asking the SPEC "Goal" against the implemented code + tests — not a task checklist.

**Goal:** a Discord AI support bot that answers grounded ONLY in the Caisson codebase/docs (via the
`services/docs /query` contract), and on any unresolved question drafts an AI brief + opens a thread
tagging a human + persists a `support_ticket` row. Hosted inference (OpenRouter), cloud-deployable,
doubles as a buyer template.

## Acceptance results

| #   | Acceptance criterion                                                                                  | Verdict   | Evidence                                                                                                                                                                                                          |
| --- | ----------------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Question with a matching chunk → grounded answer citing the chunk `source`                            | ✅        | `rag.py` resolved path returns `citations=[c.source …]`; `test_rag.py::test_resolved_answer_carries_citations`, `test_bot_handlers.py::…resolved…`                                                                |
| 2   | No retrieval / insufficient context → NO ungrounded answer; AI brief + thread + ticket                | ✅        | three escalation triggers in `rag.py` (empty, retrieval-fail, `INSUFFICIENT_CONTEXT` sentinel); `Escalator` opens thread + writes ticket; `test_rag.py` (3 paths) + `test_escalation.py` + `test_bot_handlers.py` |
| 3   | Docs + OpenRouter clients exercised in CI with no live secrets                                        | ✅        | httpx `MockTransport` in `test_docs_client.py` + `test_inference.py` (Bearer/headers/body asserted, 401/timeout/malformed mapped)                                                                                 |
| 4   | `ruff` + `pyright` clean; `pytest` green; CI lane on the fleet                                        | ✅        | local: ruff `All checks passed`, `ruff format --check` clean, pyright `0 errors`, `32 passed`; `.github/workflows/support-bot.yml` runs on `[self-hosted, gw-linux-amd64]`                                        |
| 5   | `python -m caisson_support_bot` connects the live gateway when secrets present; fail-closed otherwise | ✅ (seam) | `__main__.main` fail-closes with a clear message + exit 1 on missing config (verified: exit=1); the live gateway/OpenRouter/Postgres are the operator-gated deploy seam                                           |

## Goal achieved?

**YES.** Every acceptance criterion is met by tested code. The grounding contract (ADR-0009: never
answer outside the RAG) is enforced structurally — the only path to a user-facing answer is
`result.resolved`, which requires a non-sentinel completion over retrieved chunks; all other paths
escalate with a brief. The bot is a pure client of the `services/docs` contract (one corpus, one
owner). The "full runnable bot" depth means all real code paths exist (live discord.py gateway,
real OpenRouter + docs httpx clients, asyncpg store); CI stays hermetic via MockTransport + fakes.

## Honest scoping (carried to SWEEP)

- The **live seam** (Discord token, OpenRouter key, docs token, Postgres DSN, cloud deploy) is not
  exercised in CI — by design, secret-gated. The gateway handlers are unit-tested via the pure
  `handle_question`, not a live socket.
- The real OpenRouter **embedder** for `services/docs` is still its own deploy seam (unchanged here);
  the bot retrieves over whatever the docs service serves (FTS5 floor today).
- `PostgresTicketStore` is covered by a parameterization test against a fake connection, not a live
  Postgres (consistent with the no-secret CI posture). A live-PG integration test is a deploy-time add.
