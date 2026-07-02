"""Escalation: brief formatting, the TicketStore port, and the Escalator orchestration."""

from __future__ import annotations

from caisson_support_bot.contracts import Brief, Ticket, TicketStatus
from caisson_support_bot.escalation import (
    SUPPORT_TICKET_SCHEMA,
    Escalator,
    InMemoryTicketStore,
    PostgresTicketStore,
    format_brief,
)

from .conftest import FakeIssueTracker, FakeThreadOpener, sample_brief


def test_format_brief_contains_question_summary_and_sources() -> None:
    brief = Brief(
        question="how do credits work?",
        summary="no documentation matched",
        sources_considered=["packages/credits/README.md"],
        suggested_owner="@caisson/credits",
    )
    out = format_brief(brief)
    assert "how do credits work?" in out
    assert "no documentation matched" in out
    assert "packages/credits/README.md" in out
    assert "@caisson/credits" in out


async def test_escalator_opens_thread_tags_human_and_persists_ticket() -> None:
    store = InMemoryTicketStore()
    opener = FakeThreadOpener(thread_id=777)
    esc = Escalator(store=store, thread_opener=opener, human_mention="<@&4242>")

    ticket = await esc.escalate(sample_brief())

    assert len(store.tickets) == 1
    assert ticket.discord_thread_id == 777
    assert ticket.status is TicketStatus.open
    assert ticket.ai_brief.question == "how do credits work?"
    # the human mention is prepended to the posted thread body.
    _title, body = opener.opened[0]
    assert body.startswith("<@&4242>")


async def test_escalator_without_store_still_returns_ticket() -> None:
    opener = FakeThreadOpener()
    esc = Escalator(store=None, thread_opener=opener, human_mention=None)
    ticket = await esc.escalate(sample_brief())
    assert ticket.id  # uuid assigned
    assert len(opener.opened) == 1


async def test_escalator_without_opener_persists_only() -> None:
    store = InMemoryTicketStore()
    esc = Escalator(store=store, thread_opener=None)
    ticket = await esc.escalate(sample_brief())
    assert ticket.discord_thread_id is None
    assert store.tickets[0] is ticket


async def test_postgres_store_uses_parameterized_sql() -> None:
    # A fake connection/pool that records the SQL + args — proves the INSERT is parameterized
    # (no f-string interpolation of ticket data into the query string — the SQL-injection floor).
    recorded: dict[str, object] = {}

    class _FakeConn:
        async def fetchrow(self, query: str, *args: object):
            recorded["query"] = query
            recorded["args"] = args
            return {"created_at": None}

        async def execute(self, query: str, *args: object) -> str:
            recorded["schema"] = query
            return "OK"

    class _Acquire:
        async def __aenter__(self) -> _FakeConn:
            return _FakeConn()

        async def __aexit__(self, *exc: object) -> None:
            return None

    class _FakePool:
        def acquire(self) -> _Acquire:
            return _Acquire()

    store = PostgresTicketStore(_FakePool())  # type: ignore[arg-type]
    brief = Brief(question="q'; DROP TABLE support_ticket;--", summary="s")
    ticket = Ticket(id="id1", question=brief.question, ai_brief=brief)
    await store.create(ticket)

    query = str(recorded["query"])
    args = recorded["args"]
    assert "$1" in query and "$2" in query and "$3::jsonb" in query
    assert isinstance(args, tuple) and args[0] == "id1"
    # the injection payload travels as a bound parameter, never concatenated into the SQL text.
    assert "DROP TABLE" not in query
    assert any("DROP TABLE" in str(a) for a in args)


def test_schema_is_idempotent_create() -> None:
    assert "CREATE TABLE IF NOT EXISTS support_ticket" in SUPPORT_TICKET_SCHEMA
    assert "ai_brief" in SUPPORT_TICKET_SCHEMA


async def test_escalator_files_a_linear_issue_alongside_thread_and_ticket() -> None:
    store = InMemoryTicketStore()
    tracker = FakeIssueTracker()
    esc = Escalator(store=store, thread_opener=FakeThreadOpener(), issue_tracker=tracker)

    ticket = await esc.escalate(sample_brief())

    assert ticket.id  # thread + store sinks still ran normally.
    assert len(tracker.created) == 1
    title, description = tracker.created[0]
    assert "how do credits work?" in title
    assert "how do credits work?" in description


async def test_escalator_without_issue_tracker_is_unaffected() -> None:
    store = InMemoryTicketStore()
    esc = Escalator(store=store, thread_opener=FakeThreadOpener(), issue_tracker=None)
    ticket = await esc.escalate(sample_brief())
    assert ticket.id
    assert len(store.tickets) == 1


async def test_escalator_survives_a_raising_issue_tracker() -> None:
    # Best-effort (ADR-0206): a Linear outage must never lose the thread/ticket sinks. This proves it
    # even against an IssueTracker impl that misbehaves and raises, not just one that returns None.
    store = InMemoryTicketStore()
    opener = FakeThreadOpener()
    tracker = FakeIssueTracker(error=RuntimeError("linear is down"))
    esc = Escalator(store=store, thread_opener=opener, issue_tracker=tracker)

    ticket = await esc.escalate(sample_brief())

    assert ticket.id
    assert len(store.tickets) == 1
    assert len(opener.opened) == 1
    assert len(tracker.created) == 1  # it was called, and its failure was swallowed.


async def test_escalator_tolerates_issue_tracker_returning_none() -> None:
    # LinearIssueTracker itself never raises — its failure path returns None (see test_linear_client).
    store = InMemoryTicketStore()
    tracker = FakeIssueTracker(url=None)
    esc = Escalator(store=store, thread_opener=FakeThreadOpener(), issue_tracker=tracker)
    ticket = await esc.escalate(sample_brief())
    assert ticket.id
    assert len(tracker.created) == 1
