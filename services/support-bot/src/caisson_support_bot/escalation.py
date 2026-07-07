"""Escalation: AI brief → chat-platform thread + human tag + persisted support_ticket (ADR-0009/0105).

Every unresolved question carries an AI brief (ADR-0009 binding). The operator chose **both** sinks:
a community-native chat-platform thread tagging a human, AND a durable ``support_ticket`` row (the
``ai_brief`` carrier). Both sit behind ports so the orchestration is testable without a live chat
gateway or Postgres: ``ChatPlatform`` (ADR-0287 — bot.py supplies a Discord-backed impl in
``_DiscordThreadOpener`` and a Slack-backed impl in ``chat_slack.SlackThreadOpener``, config-selected;
tests inject a fake) and ``TicketStore`` (``InMemoryTicketStore`` for tests, ``PostgresTicketStore``
via asyncpg for deploy).

A third, best-effort sink files a Linear Triage issue for the same brief (ADR-0206):
``IssueTracker`` (``linear_client.LinearIssueTracker`` for deploy; tests a fake). v1 is log-only for
the created issue URL — no ``support_ticket`` column carries it yet.
"""

from __future__ import annotations

import sys
import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Protocol, runtime_checkable

from .contracts import Brief, Ticket, TicketStatus

if TYPE_CHECKING:  # pragma: no cover - typing only
    import asyncpg


def format_brief(brief: Brief) -> str:
    """Render a brief as the message posted into the escalation thread."""
    lines = [
        "**AI support brief** — a human will follow up.",
        "",
        f"**Question:** {brief.question}",
        f"**Why escalated:** {brief.summary}",
    ]
    if brief.suggested_owner:
        lines.append(f"**Likely area:** `{brief.suggested_owner}`")
    if brief.sources_considered:
        shown = ", ".join(f"`{s}`" for s in brief.sources_considered[:8])
        lines.append(f"**Sources considered:** {shown}")
    return "\n".join(lines)


@runtime_checkable
class ChatPlatform(Protocol):
    """Open a handoff thread and return its id (or None if threads/ids are unavailable).

    The minimal chat-vendor seam ``Escalator`` needs (ADR-0287): post the escalation message and,
    where the platform supports it, thread/reply it. Implementations are Discord- and
    Slack-specific (``bot.py``'s ``_DiscordThreadOpener``, ``chat_slack.SlackThreadOpener``);
    ``Escalator`` depends only on this port. Best-effort by construction — a concrete impl owns
    catching its own failures, same as ``IssueTracker`` below.
    """

    async def open_thread(self, *, title: str, body: str) -> int | None: ...


@runtime_checkable
class TicketStore(Protocol):
    """Persist a support ticket; returns the stored row (id + created_at populated)."""

    async def create(self, ticket: Ticket) -> Ticket: ...


@runtime_checkable
class IssueTracker(Protocol):
    """File a Linear Triage issue for an escalation; returns its URL, or None on failure.

    Best-effort like ``ChatPlatform``: a concrete impl owns catching its own failures — Linear
    being down must never break escalation (ADR-0206).
    """

    async def create_issue(self, *, title: str, description: str) -> str | None: ...


class InMemoryTicketStore:
    """Non-durable store for tests + the no-Postgres degraded path."""

    def __init__(self) -> None:
        self.tickets: list[Ticket] = []

    async def create(self, ticket: Ticket) -> Ticket:
        self.tickets.append(ticket)
        return ticket


# CREATE TABLE for the durable store. Kept here so deploy can `ensure_schema` idempotently. The
# trailing ALTER covers an already-deployed table (CREATE TABLE IF NOT EXISTS no-ops on it) —
# ADD COLUMN IF NOT EXISTS makes both statements safe to replay every boot (ADR-0278 Track K:
# priority-support routing signal, see Ticket.priority).
SUPPORT_TICKET_SCHEMA = """
CREATE TABLE IF NOT EXISTS support_ticket (
    id                text        PRIMARY KEY,
    question          text        NOT NULL,
    ai_brief          jsonb       NOT NULL,
    status            text        NOT NULL DEFAULT 'open',
    discord_thread_id bigint,
    created_at        timestamptz NOT NULL DEFAULT now(),
    priority          boolean     NOT NULL DEFAULT false
);
ALTER TABLE support_ticket ADD COLUMN IF NOT EXISTS priority boolean NOT NULL DEFAULT false;
"""


class PostgresTicketStore:
    """asyncpg-backed durable store. Parameterized SQL only (no string interpolation — injection floor)."""

    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    async def ensure_schema(self) -> None:
        async with self._pool.acquire() as conn:
            await conn.execute(SUPPORT_TICKET_SCHEMA)

    async def create(self, ticket: Ticket) -> Ticket:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO support_ticket
                    (id, question, ai_brief, status, discord_thread_id, priority)
                VALUES ($1, $2, $3::jsonb, $4, $5, $6)
                RETURNING created_at
                """,
                ticket.id,
                ticket.question,
                ticket.ai_brief.model_dump_json(),
                ticket.status.value,
                ticket.discord_thread_id,
                ticket.priority,
            )
        return ticket.model_copy(
            update={"created_at": row["created_at"] if row else ticket.created_at}
        )


class Escalator:
    """Orchestrates a single escalation: open a thread, file a Linear issue, then persist the ticket.

    The thread and the Linear issue are both best-effort (neither failure may lose the ticket); the
    store is the source of truth for ``ai_brief``. Any port may be None (deployments degrade per
    whichever sinks are configured).
    """

    def __init__(
        self,
        *,
        store: TicketStore | None = None,
        thread_opener: ChatPlatform | None = None,
        issue_tracker: IssueTracker | None = None,
        human_mention: str | None = None,
        priority: bool = False,
    ) -> None:
        self._store = store
        self._opener = thread_opener
        self._issue_tracker = issue_tracker
        self._human_mention = human_mention
        # ADR-0278 Track K: set once per escalation by the caller (bot.py resolves it from the
        # escalating member's Discord roles). Fail-closed default — an Escalator built with no
        # signal always takes the normal lane.
        self._priority = priority

    async def escalate(self, brief: Brief) -> Ticket:
        body = format_brief(brief)
        if self._priority:
            # Best-effort framing, never "SLA" (ADR-0278: response-time, not a contractual
            # guarantee) — a plain routing tag, not a promise about when a human responds.
            body = f"**Priority support escalation**\n{body}"
        if self._human_mention:
            body = f"{self._human_mention}\n\n{body}"

        # `thread_id` stays Discord-shaped (a `bigint`-column-typed numeric snowflake) — the Slack
        # driver always resolves this to None (see `chat_slack.py`'s module docstring): Slack's own
        # message timestamp is a decimal STRING, not an int, and widening this column to a
        # platform-neutral id is a schema migration out of scope for a driver addition. The
        # escalation still posts and the ticket still persists either way; only the audit-trail id
        # goes unset when the active ChatPlatform is Slack.
        thread_id: int | None = None
        if self._opener is not None:
            prefix = "Priority: " if self._priority else "Support: "
            title = f"{prefix}{brief.question[:80]}"
            thread_id = await self._opener.open_thread(title=title, body=body)

        if self._issue_tracker is not None:
            # Best-effort (ADR-0206): v1 is log-only for the created issue URL — no support_ticket
            # column carries it yet, so a Linear outage never blocks the thread/store sinks above.
            # LinearIssueTracker already never raises on its own; this guard is defense-in-depth so
            # ANY IssueTracker impl (including a future/misbehaving one) can never sink escalate().
            issue_prefix = "Priority support escalation" if self._priority else "Support escalation"
            try:
                issue_url = await self._issue_tracker.create_issue(
                    title=f"{issue_prefix}: {brief.question[:80]}", description=body
                )
            except (
                Exception
            ) as exc:  # best-effort sink: any failure here must never lose the ticket.
                sys.stderr.write(f"[linear] triage issue creation raised unexpectedly: {exc}\n")
            else:
                if issue_url:
                    sys.stderr.write(f"[linear] triage issue created: {issue_url}\n")

        ticket = Ticket(
            id=uuid.uuid4().hex,
            question=brief.question,
            ai_brief=brief,
            status=TicketStatus.open,
            discord_thread_id=thread_id,
            created_at=datetime.now(UTC),
            priority=self._priority,
        )
        if self._store is not None:
            ticket = await self._store.create(ticket)
        return ticket
