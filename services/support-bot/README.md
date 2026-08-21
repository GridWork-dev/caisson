# services/support-bot (Python)

Custom AI support service (ADR-0009 · implementation ADR-0105): a **discord.py** bot over a
**codebase-grounded RAG** pipeline. It answers community questions **only** from the documented
Caisson codebase — retrieval is an HTTP call to `services/docs` `POST /query` (one corpus, one owner),
generation is **OpenRouter** (one key, provider-agnostic). On a question it can't resolve, it drafts an
**AI brief**, opens a Discord thread tagging a human, and persists a `support_ticket` row. Hosted
inference (API, not local models), cloud-deployed (the one component on cloud infra). Doubles as a
shippable value-add template.

## Architecture

```
Discord (/ask slash + #ask-ai listener)
        │
        ▼
   RagPipeline ── retrieve ──▶ DocsClient ──HTTP Bearer──▶ services/docs POST /query
        │                                                   (hybrid FTS5+vec corpus)
        ├── ground (citations + INSUFFICIENT_CONTEXT sentinel)
        ├── generate ──▶ Inference port ──▶ OpenRouterInference (httpx)
        │
        ▼
   resolved? ──yes──▶ reply with answer + source citations
        │
        └──no──▶ Escalator: build AI brief ─▶ ChatPlatform.open_thread (tag @support)
                                            ├▶ TicketStore (Postgres support_ticket.ai_brief)
                                            └▶ IssueTracker (Linear Triage issue, best-effort)
```

The pipeline, clients, and stores sit behind ports (`Inference`, `TicketStore`, `ChatPlatform`) so CI
runs hermetic: `FakeInference` + `InMemoryTicketStore` + httpx `MockTransport`. **Live secrets + cloud
deploy are the operator-gated seam.**

**ChatPlatform (ADR-0287):** the bot's own surface (`/ask`, `#ask-ai`) stays Discord — only the
escalation-notify thread is driver-selected. `chat_platform=discord` (default) reuses the live
Discord channel the question arrived on; `chat_platform=slack` posts via Slack's Web API to a fixed
escalation channel instead (`SlackThreadOpener`, `chat_slack.py`), config-gated fail-closed by
`Settings`.

## Run locally

```bash
uv sync
# required env (fail-closed if unset):
export DISCORD_TOKEN=...            # Discord bot token
export OPENROUTER_API_KEY=...       # generation
export DOCS_SERVICE_URL=https://docs.internal   # services/docs base URL
export DOCS_SERVICE_TOKEN=...       # Bearer for POST /query
# optional:
export SUPPORT_CHANNEL_ID=...       # the #ask-ai channel id (listener)
export SUPPORT_HUMAN_ROLE_ID=...    # role to tag on escalation
export DATABASE_URL=postgres://...  # support_ticket persistence (omit ⇒ thread-only escalation)
export OPENROUTER_MODEL=anthropic/claude-sonnet-4.6   # default; any OpenRouter slug (ADR-0105/0234)
export BILLING_GRANT_TOKEN=...      # Bearer for POST /billing-grant (entitlement→role push); route not served when unset
export HEARTBEAT_ENABLED=false      # T41 enables the Google custom dead-man metric on GCE
export GOOGLE_CLOUD_PROJECT=...     # required only when HEARTBEAT_ENABLED=true; ADC supplies auth
export GUILD_ID=...                 # pins billing grants to the Caisson guild (sole-guild fallback when unset)
export LINEAR_API_KEY=...           # Linear personal API key; all 3 LINEAR_* must be set together or the sink stays off
export LINEAR_TEAM_ID=...           # the CAISSON team issueCreate files the Triage issue under
export LINEAR_TRIAGE_STATE_ID=...   # explicit Triage workflow state id passed on every issueCreate
export CHAT_PLATFORM=discord        # or "slack" — selects the escalation-notify driver (ADR-0287)
export SLACK_BOT_TOKEN=...          # Slack bot token (chat:write); required when CHAT_PLATFORM=slack
export SLACK_ESCALATION_CHANNEL_ID=... # Slack channel id escalations post to; required when CHAT_PLATFORM=slack
export SLACK_ESCALATION_MENTION=...  # Slack mention in SLACK syntax (<!subteam^ID> or <@U…>), NOT Discord's <@&roleId>; unset posts with no ping
uv run python -m caisson_support_bot
```

## Test / lint / typecheck

```bash
uv run ruff check .
uv run pyright
uv run pytest
```

## Deploy (operator-gated)

Build the `Dockerfile` and push to Railway (recommended) or Fly.io. The gateway connection is outbound;
inbound is one aiohttp app on `health_port` — `GET /health` (always, the runner's liveness probe) plus
`POST /billing-grant` (ADR-0203 — token-gated entitlement→Discord-role push, called by `services/license`
and `apps/site`; not served when `BILLING_GRANT_TOKEN` is unset). Set the env above as the platform's
secrets.

### Disposable GCE worker contract

`gce-deploy.toml` is the values-free handoff to T41. It maps the bot container's
`DISCORD_TOKEN`, `DATABASE_URL`, and `BILLING_GRANT_TOKEN`, plus cloudflared's `TUNNEL_TOKEN`, to
the four dedicated Secret Manager container names. Secret values stay operator-seeded out of band.

The process handles `SIGTERM` directly: it closes the authenticated mutation gate first, drains
in-flight callbacks within `SHUTDOWN_GRACE_S`, asks Discord to close, then bounds HTTP and asyncpg
cleanup. Gateway reconnect/resume uses discord.py's native exponential full-jitter loop.
Billing grants are retry-safe because roles already held by the member are filtered before
`add_roles`.

When `HEARTBEAT_ENABLED=true`, the bot writes
`custom.googleapis.com/caisson/support_bot/heartbeat` only while the Discord Gateway is ready. The
loop has no database dependency and keeps no local state; T41 owns the missing-data alert policy.
