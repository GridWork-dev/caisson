"""Boundary models (ADR-0105).

pydantic models are the Python analogue of the repo's Zod ``.strict()`` boundaries: every shape that
crosses a process edge (the docs ``/query`` response, the OpenRouter reply, a persisted ticket) is
validated, not just typed. ``ScoredChunk`` mirrors the TypeScript shape that ``services/docs`` returns
(``src/types.ts``) — this is the cross-language contract, so it is parsed defensively.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class DocKind(str, Enum):
    docs = "docs"
    readme = "readme"
    # ADR-0234 F4: mirrors the additive `pricing` member in services/docs `types.ts` DocKindSchema.
    # `ScoredChunk.kind` is a strict enum, and `extra="ignore"` only tolerates unknown FIELDS — an
    # unknown enum VALUE would still fail model_validate, so a pricing chunk in a /query result must
    # be a recognized member here or the whole support answer would 500.
    pricing = "pricing"


class ScoredChunk(BaseModel):
    """One retrieval hit from services/docs POST /query (mirror of the TS ScoredChunk)."""

    # `extra="ignore"`: the docs service owns the schema; tolerate fields we don't model yet rather
    # than hard-failing a support answer on a forward-compatible addition.
    model_config = ConfigDict(extra="ignore")

    id: str
    source: str = Field(min_length=1, description="Repo-relative source path — the citation.")
    title: str
    section: str = ""
    kind: DocKind = DocKind.docs
    pkg: str | None = None
    license: str = ""
    text: str = Field(min_length=1)
    score: float = 0.0


class DocsQueryResponse(BaseModel):
    """The /query envelope: {chunks: ScoredChunk[]}."""

    model_config = ConfigDict(extra="ignore")
    chunks: list[ScoredChunk] = Field(default_factory=list)


class Brief(BaseModel):
    """The AI brief attached to every escalation (ADR-0009 binding)."""

    model_config = ConfigDict(frozen=True)

    question: str
    summary: str = Field(description="What the bot understood + why it could not resolve.")
    sources_considered: list[str] = Field(
        default_factory=list, description="Source paths of the chunks that were retrieved, if any."
    )
    suggested_owner: str | None = Field(
        default=None, description="Best-guess owning package/area from the top retrieved chunk."
    )


class ConfidenceTier(str, Enum):
    """The 3-tier graded-confidence verdict (2026-07-10 picker) for a resolved answer.

    HIGH/MEDIUM only ever label a *resolved* ``AnswerResult`` — a LOW grade never reaches one:
    ``RagPipeline.answer`` converts it into an escalation (``resolved=False``) instead, exactly like
    the sentinel/empty-retrieval/leak paths already do. So a caller only ever observes HIGH or MEDIUM
    on ``AnswerResult.tier``.
    """

    high = "high"
    medium = "medium"
    low = "low"


class AnswerResult(BaseModel):
    """The pipeline's verdict for one question."""

    model_config = ConfigDict(frozen=True)

    resolved: bool
    answer: str = ""
    citations: list[str] = Field(
        default_factory=list, description="Source paths backing the answer."
    )
    tier: ConfidenceTier = Field(
        default=ConfidenceTier.high,
        description="Meaningful only when resolved is True (always HIGH or MEDIUM there); the "
        "default keeps every pre-existing escalation construction site (tier is irrelevant when "
        "resolved is False) unchanged.",
    )
    brief: Brief | None = Field(
        default=None, description="Present iff resolved is False (escalation)."
    )


class TicketStatus(str, Enum):
    open = "open"
    resolved = "resolved"


class Ticket(BaseModel):
    """A persisted support_ticket row (the ai_brief carrier — ADR-0009 `support_ticket.ai_brief`)."""

    id: str
    question: str
    ai_brief: Brief
    status: TicketStatus = TicketStatus.open
    discord_thread_id: int | None = None
    created_at: datetime | None = None
    # Priority-support routing signal (ADR-0278 Track K): True iff the escalating member held the
    # configured priority-support Discord role at escalation time. Fail-closed default — no signal
    # (unset role config, no guild member context, or no role) means the normal lane.
    priority: bool = False
