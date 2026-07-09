# SECURITY — services/support-bot (P6 Bucket C item 2)

**Phase:** P6 — Discord AI support bot (first Python surface)
**Tags:** `ai`, `auth`, `secrets`, `external-system`
**ASVS Level:** 2 (auth/secrets/external-system; client-of-tokens, no inbound authz surface)
**Verdict:** SECURED — 6/6 threats CLOSED, 0 BLOCKERs.
**Disposition basis:** each Tn verified against implemented code (cite path:line), not documentation/intent.

This service is a **client of tokens** (it SENDS the docs Bearer + OpenRouter Bearer); it does not
VERIFY any inbound token. The only inbound surface is the unauthenticated `/health` liveness endpoint
(`health.py`), which carries no secret and performs no comparison — so the `crypto.timingSafeEqual` /
`hmac.compare_digest` rule applies vacuously (no secret-comparison site exists; grep confirms). The
`/health` `0.0.0.0` bind is a deliberate container-liveness surface, explicitly `# noqa: S104`-annotated
(`health.py:19`) — acknowledged, not a finding.

## Threat Verification

| Threat ID | Category                                  | Disposition     | Status | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------- | ----------------------------------------- | --------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1        | secrets — token leak                      | mitigate        | CLOSED | env-only via pydantic-settings (`config.py:15-59`); required secrets have NO defaults → fail-closed at `Settings()` (`__main__.py:65-72`, `SystemExit(1)`); zero `logging`/`print`/`log.` in `src/` (grep: none); no hardcoded token literals (grep: none); `.env` gitignored at repo root (`git check-ignore` confirms)                                                                                                                                                                                      |
| T2        | external-system — SSRF / unbounded egress | mitigate        | CLOSED | exactly two egress sinks: docs URL (env) + OpenRouter constant (`inference.py:16`, hardcoded `https://`); single shared `httpx.AsyncClient(timeout=httpx.Timeout(settings.request_timeout_s))` (`__main__.py:29-30`) injected into BOTH clients → both bounded; `request_timeout_s` bounded `gt=0, le=120` (`config.py:39`); docs URL forced `https` (loopback dev exception) (`config.py:61-68`); no other HTTP lib (`urllib`/`requests`/`aiohttp` grep: none)                                               |
| T3        | injection — SQL on ticket store           | mitigate        | CLOSED | parameterized asyncpg only: `fetchrow` with `$1..$5` placeholders, values passed as positional args (`escalation.py:88-99`); schema is a static constant (`escalation.py:64-73`, `:84`) with no interpolation; no f-string/`%`/`.format` SQL (grep: none); test asserts `'; DROP TABLE …` payload travels as a bound arg and is absent from the query text (`tests/test_escalation.py:63-100`)                                                                                                                |
| T4        | ai — prompt injection / ungrounded answer | mitigate        | CLOSED | grounded system prompt "answer USING ONLY the numbered context … do not use outside knowledge" (`rag.py:18-25`); `INSUFFICIENT_CONTEXT` sentinel (`rag.py:16`, `:95`); citations from chunk `source` paths on the resolved path (`rag.py:108`); three escalation triggers — retrieval fail (`rag.py:68`), empty retrieval (`rag.py:77`), sentinel (`rag.py:95`) — each returns `resolved=False` + a `Brief`; tests cover all three + sentinel-in-prompt (`tests/test_rag.py:24-60`); ADR-0009 binding honored |
| T5        | input abuse — oversized/garbage question  | mitigate        | CLOSED | trim + cap before dispatch: `question.strip()[:max_chars]` (`bot.py:61`); both surfaces pass `max_chars=settings.max_question_chars` (`bot.py:141`, `:156`); `max_question_chars` pydantic-bounded `ge=1, le=2000` (`config.py:41`) — cannot be misconfigured above the docs `/query` ceiling; empty-after-trim short-circuits with no dispatch (`bot.py:62-63`); all boundary shapes are pydantic models (`contracts.py`)                                                                                    |
| T6        | external-system — new sinks acknowledged  | accept (ledger) | CLOSED | recorded in the Acknowledged Sinks Ledger below                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

## Acknowledged Sinks Ledger (T6 — gridwork `identity/security-surfaces.md` is cross-repo)

New external surfaces introduced by this service (first Python surface in the repo):

| Sink                   | Direction | Endpoint                                                                    | Auth                           | Bound                               | Source                                          |
| ---------------------- | --------- | --------------------------------------------------------------------------- | ------------------------------ | ----------------------------------- | ----------------------------------------------- |
| services/docs `/query` | outbound  | `${DOCS_SERVICE_URL}/query` (env; `https` enforced, loopback dev exception) | `Bearer ${DOCS_SERVICE_TOKEN}` | timeout `request_timeout_s` (≤120s) | `docs_client.py:53-72`, `config.py:23-28,61-68` |
| OpenRouter generation  | outbound  | `https://openrouter.ai/api/v1/chat/completions` (hardcoded constant)        | `Bearer ${OPENROUTER_API_KEY}` | same shared timeout                 | `inference.py:16,52-72`                         |
| Discord gateway        | outbound  | discord.py-managed WSS to Discord                                           | `${DISCORD_TOKEN}`             | framework-managed                   | `bot.py`, `__main__.py:55`                      |
| `/health`              | inbound   | `0.0.0.0:${HEALTH_PORT}` (default 8080)                                     | none (liveness only)           | n/a                                 | `health.py:15-42`                               |

No new published port lands a token-verifying surface; `/health` is the sole inbound surface and is
unauthenticated by design (no secret, no business data).

## Unregistered Flags

None. No `SUMMARY.md` `## Threat Flags` section exists for this phase (no SUMMARY.md present in
`outputs/specs/p6-support-bot/`); the four declared surfaces above are all mapped to T2/T6. No new
attack surface was found during the audit that is unmapped to a threat ID.

## Accepted Risks Log

- **AR-1 — `/health` binds `0.0.0.0` unauthenticated (LOW, accepted).** Deliberate container-liveness
  surface for a cloud runner (Railway/Fly). No secret, no business data, returns only `{"ok":bool}`
  readiness. Annotated `# noqa: S104` (`health.py:19`). Per the audit scope this is acknowledged, not a
  finding.
- **AR-2 — `/health` reads up to 2048 request bytes and ignores them (LOW, accepted).** `reader.read(2048)`
  drains and discards the request (`health.py:25`); no parsing, no path routing, bounded read, `Connection: close`.
  Not a DoS amplifier.

## Informational / defense-in-depth (NOT findings — no fix required to ship)

1. **T4 residual — no output-side injection filter.** Grounding is enforced solely by the system prompt
   (`rag.py:18-25`). Direct injection in the user question and indirect injection via retrieved chunk
   text are both possible in principle. Residual risk is low: the corpus is the **owned** Caisson
   codebase/docs (trusted source), `temperature=0.1` (`inference.py:42`), and an unconvincing/sentinel
   answer escalates rather than fabricates. Future hardening: post-generation citation-presence check
   before marking `resolved`.
2. **Brief summary embeds raw exception text.** On retrieval/generation failure the `exc` string becomes
   `Brief.summary` (`rag.py:72,91`), which is posted to a Discord thread and persisted. Verified the
   exception text contains **no secret** — `DocsUnavailableError`/`InferenceError` carry only status codes
   or httpx error strings (which may include the operator's own docs hostname, not a token; the `Bearer`
   header is never in the exception). Low-value hardening: sanitize the operator infra hostname out of
   user-facing briefs.
3. **`Settings()` `ValidationError` printed to stderr on startup (`__main__.py:67-71`).** Considered and
   cleared for T1: the required secret fields (`min_length=1`) fail only when **empty or missing**, so a
   real (non-empty) secret value never reaches the error; pydantic emits `input_value` only for the
   fields that failed, and a populated secret passes. No secret value can reach stderr through this path.

## Method notes

- Implementation files were treated as READ-ONLY; only this `SECURITY.md` was written.
- Verification was grep-anchored to the cited files, not inferred from structure or comments:
  secret-logging (none), hardcoded-secret literals (none), f-string/`%`/`.format` SQL (none),
  secret-comparison sites (none), HTTP-client constructions (one, timeout-bound), non-httpx network
  libs (none).
- `ruff` config selects the bandit `S` ruleset (`pyproject.toml:41`), so the lint gate enforces the
  no-hardcoded-secret / bind-acknowledgement floor in CI as a backstop.
