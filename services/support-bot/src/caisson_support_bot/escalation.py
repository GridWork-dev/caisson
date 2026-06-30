"""Escalation: AI brief → Discord thread + human tag + persisted support_ticket (ADR-0009/0105).

Every unresolved question carries an AI brief (ADR-0009 binding). The operator chose **both** sinks:
a community-native Discord thread tagging a human, AND a durable ``support_ticket`` row (the
``ai_brief`` carrier). Both sit behind ports so the orchestration is testable without Discord or
Postgres: ``ThreadOpener`` (bot.py supplies a discord-backed impl; tests a fake) and ``TicketStore``
(``InMemoryTicketStore`` for tests, ``PostgresTicketStore`` via asyncpg for deploy).
"""

from __future__ import annotations

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
class ThreadOpener(Protocol):
    """Open a handoff thread and return its id (or None if threads are unavailable)."""

    async def open_thread(self, *, title: str, body: str) -> int | None: ...


@runtime_checkable
class TicketStore(Protocol):
    """Persist a support ticket; returns the stored row (id + created_at populated)."""

    async def create(self, ticket: Ticket) -> Ticket: ...


class InMemoryTicketStore:
    """Non-durable store for tests + the no-Postgres degraded path."""

    def __init__(self) -> None:
        self.tickets: list[Ticket] = []

    async def create(self, ticket: Ticket) -> Ticket:
        self.tickets.append(ticket)
        return ticket


# CREATE TABLE for the durable store. Kept here so deploy can `ensure_schema` idempotently.
SUPPORT_TICKET_SCHEMA = """
CREATE TABLE IF NOT EXISTS support_ticket (
    id                text        PRIMARY KEY,
    question          text        NOT NULL,
    ai_brief          jsonb       NOT NULL,
    status            text        NOT NULL DEFAULT 'open',
    discord_thread_id bigint,
    created_at        timestamptz NOT NULL DEFAULT now()
);
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
                INSERT INTO support_ticket (id, question, ai_brief, status, discord_thread_id)
                VALUES ($1, $2, $3::jsonb, $4, $5)
                RETURNING created_at
                """,
                ticket.id,
                ticket.question,
                ticket.ai_brief.model_dump_json(),
                ticket.status.value,
                ticket.discord_thread_id,
            )
        return ticket.model_copy(
            update={"created_at": row["created_at"] if row else ticket.created_at}
        )


class Escalator:
    """Orchestrates a single escalation: open a thread, then persist the ticket.

    The thread is best-effort (a Discord failure must not lose the ticket); the store is the source of
    truth for ``ai_brief``. Either port may be None (thread-only or store-only deployments degrade).
    """

    def __init__(
        self,
        *,
        store: TicketStore | None = None,
        thread_opener: ThreadOpener | None = None,
        human_mention: str | None = None,
    ) -> None:
        self._store = store
        self._opener = thread_opener
        self._human_mention = human_mention

    async def escalate(self, brief: Brief) -> Ticket:
        body = format_brief(brief)
        if self._human_mention:
            body = f"{self._human_mention}\n\n{body}"

        thread_id: int | None = None
        if self._opener is not None:
            title = f"Support: {brief.question[:80]}"
            thread_id = await self._opener.open_thread(title=title, body=body)

        ticket = Ticket(
            id=uuid.uuid4().hex,
            question=brief.question,
            ai_brief=brief,
            status=TicketStatus.open,
            discord_thread_id=thread_id,
            created_at=datetime.now(UTC),
        )
        if self._store is not None:
            ticket = await self._store.create(ticket)
        return ticket
