# SWEEP — services/support-bot (downstream impact + gaps)

What else does this change touch, and what's left?

## Downstream impact

- **First Python surface in the repo.** Establishes uv + ruff + pyright + pytest as the Python
  toolchain and a path-scoped CI workflow (`support-bot.yml`). NOT in the Bun workspace (workspaces
  lists `services/{license,docs}` explicitly), so `bun install` + the TS gates are untouched —
  confirmed: no `package.json`, the standards-gate/depcruise don't scan `services/`.
- **Closes the `services/docs` consumer loop.** `services/docs` was "partial until the bot consumes
  it" (readiness-and-backlog). The bot now consumes `POST /query` over HTTP, so the docs service moves
  from partial → consumed. P6 Bucket C item 2 is built.
- **New egress sinks** (OpenRouter generation, Discord gateway) + a new Postgres table
  (`support_ticket`). The gridwork security-surfaces ledger is cross-repo (gridwork-core); the sinks
  are recorded in SECURITY.md here and called out in ADR-0105.

## Gaps / follow-ups (queued, non-blocking)

| Gap                                                        | Why deferred                                                                                         | Where                                                  |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Cloud deploy (Railway rec / Fly alt)                       | operator-gated DEPLOY act; needs the live secrets                                                    | ADR-0105 deferred; `Dockerfile` + `/health` ship ready |
| Live OpenRouter key + Discord bot token + Postgres DSN     | operator secrets                                                                                     | deploy seam                                            |
| `services/docs` real OpenRouter embedder                   | the docs-service's own deploy seam (unchanged)                                                       | docs `server.ts` `DocsIndex.build`                     |
| Live-Postgres integration test for `PostgresTicketStore`   | no-secret CI posture; parameterization is unit-covered                                               | deploy-time add                                        |
| Anthropic-direct `Inference` impl                          | the port is ready; add if quality demands                                                            | ADR-0105 deferred                                      |
| Buyer-template extraction of the bot                       | a later GTM slice                                                                                    | ADR-0009 "doubles as template"                         |
| Multi-turn memory / per-user rate limits                   | single-shot Q→A first                                                                                | SPEC out-of-scope                                      |
| `support-bot.yml` → required check                         | advisory until proven green on the fleet                                                             | promote after first green run                          |
| Post-generation citation-presence check before `resolved`  | SECURITY infosec #1 — defense-in-depth on grounding; risks false escalations w/o live-model evidence | `rag.py` after generate                                |
| Sanitize operator infra hostname out of user-facing briefs | SECURITY infosec #2 — verified no secret leaks today; low-value polish                               | `rag.py` `_brief` summary                              |

**Security audit:** SECURED — 6/6 threats CLOSED, 0 BLOCKERs (`SECURITY.md`). The two rows above are the
auditor's informational defense-in-depth notes, not findings.

## No regressions

The change is additive — a new directory + a new path-scoped workflow. No existing package, gate, or
workflow is modified. `bun install` and the required TS checks (check · standards-gate · registry-index)
are unaffected.
