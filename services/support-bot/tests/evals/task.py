"""The support-bot eval *task*: turn one dataset case into the string the graders score.

This is the only bot-specific glue in the eval package — ``harness.py`` stays a generic port. Each
case drives the REAL ``RagPipeline.answer`` with the repo's existing hermetic doubles
(``FakeRetriever`` / ``FakeInference`` from ``tests/conftest.py`` — reused, never duplicated), so the
eval grades the pipeline's true behavior, not a re-implementation of it. Zero network by construction:
the doubles never reach ``services/docs`` or OpenRouter.

Graded output, per case:

  - default                → ``result.model_dump_json()`` — the full ``AnswerResult`` JSON (what the
                             injection / grounding graders parse and assert against).
  - ``gradeSystemTurn``    → the COMPOSED SYSTEM TURN captured from ``FakeInference.calls[0][0]``. The
                             fence-breakout cases assert on what the pipeline actually sent to the
                             model, proving ``rag.py``'s fence-tag scrub neutralized the breakout —
                             the answer JSON alone can't show that.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from caisson_support_bot.docs_client import DocsUnavailableError
from caisson_support_bot.inference import FakeInference
from caisson_support_bot.rag import RagPipeline

from ..conftest import FakeRetriever, chunk
from .harness import DatasetCase


class _TaskChunk(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source: str = Field(min_length=1)
    text: str = Field(min_length=1)
    pkg: str | None = None


class TaskInput(BaseModel):
    """The pipeline drive carried in each case's ``input`` (strict — a stray field is a hard error)."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    question: str
    chunks: list[_TaskChunk] = Field(default_factory=list)
    # The model-resisted canned reply FakeInference returns (green-only datasets: every reply is one
    # the current pipeline handles safely). ``None`` lets the fake echo the question — unused here.
    reply: str | None = None
    # If set, FakeRetriever raises ``DocsUnavailableError(<this>)`` — drives the retrieval-failure leg.
    retrieval_error: str | None = Field(default=None, alias="retrievalError")
    # Fence-integrity cases grade the composed system turn instead of the answer JSON (see module doc).
    grade_system_turn: bool = Field(default=False, alias="gradeSystemTurn")


async def run_case_task(case: DatasetCase) -> str:
    """Build the pipeline for one case, run ``answer``, and return the string to grade."""
    ti = TaskInput.model_validate(case.input)
    chunks = [chunk(c.source, c.text, pkg=c.pkg) for c in ti.chunks]
    error = DocsUnavailableError(ti.retrieval_error) if ti.retrieval_error is not None else None
    fake = FakeInference(reply=ti.reply)
    pipe = RagPipeline(docs=FakeRetriever(chunks, error=error), inference=fake)

    result = await pipe.answer(ti.question)

    if ti.grade_system_turn:
        # The pipeline must have reached generation for a fence case to be meaningful; if it escalated
        # before composing the system turn (e.g. empty retrieval), the case is misconfigured — raise
        # rather than grade an empty string into a false pass (fail-closed).
        if not fake.calls:
            raise ValueError(
                f'case "{case.id}" is gradeSystemTurn but the pipeline never called the model '
                "(retrieval escalated first) — no composed system turn to grade"
            )
        return fake.calls[0][0]

    return result.model_dump_json()
