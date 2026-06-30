"""The RAG pipeline (ADR-0009 binding: answer ONLY from the codebase/docs; never guess).

retrieve → ground → generate → decide. Grounding instructs the model to answer strictly from the
retrieved chunks and to emit an explicit ``INSUFFICIENT_CONTEXT`` sentinel rather than hallucinate.
Three paths lead to escalation (``resolved = False`` + a ``Brief``): retrieval is empty, retrieval
fails, or the model returns the sentinel. Everything else is a grounded answer carrying the source
paths of the chunks it was given as citations.
"""

from __future__ import annotations

from .contracts import AnswerResult, Brief, ScoredChunk
from .docs_client import DocsUnavailableError, Retriever
from .inference import Inference, InferenceError

SENTINEL = "INSUFFICIENT_CONTEXT"

SYSTEM_PROMPT = (
    "You are the Caisson support assistant. Answer the user's question USING ONLY the numbered "
    "context sources below — they are excerpts from the Caisson codebase and documentation. Do not "
    "use any outside knowledge. Cite the sources you rely on inline by their path in square brackets, "
    f"e.g. [packages/billing/README.md]. If the context does not contain enough information to answer "
    f"correctly, reply with EXACTLY the token {SENTINEL} and nothing else — do not guess. Be concise "
    "and accurate; a wrong answer is worse than an escalation."
)

# Cap the context fed to the model so a pathological corpus can't blow the token budget.
_MAX_CONTEXT_CHARS = 12_000


def _build_context(chunks: list[ScoredChunk]) -> str:
    """Render retrieved chunks into a numbered, citation-tagged context block."""
    parts: list[str] = []
    used = 0
    for i, c in enumerate(chunks, start=1):
        block = f"[{i}] source: {c.source}\n{c.text}\n"
        if used + len(block) > _MAX_CONTEXT_CHARS:
            break
        parts.append(block)
        used += len(block)
    return "\n".join(parts)


def _brief(question: str, chunks: list[ScoredChunk], reason: str) -> Brief:
    """Assemble the AI brief that rides every escalation (ADR-0009)."""
    sources = [c.source for c in chunks]
    owner = next((c.pkg for c in chunks if c.pkg), None)
    return Brief(
        question=question,
        summary=reason,
        sources_considered=sources,
        suggested_owner=owner,
    )


class RagPipeline:
    """Orchestrates retrieval + grounded generation for one question."""

    def __init__(self, *, docs: Retriever, inference: Inference, k: int = 6) -> None:
        self._docs = docs
        self._inference = inference
        self._k = k

    async def answer(self, question: str) -> AnswerResult:
        # 1. retrieve — a retrieval failure escalates rather than answering ungrounded.
        try:
            chunks = await self._docs.query(question, self._k)
        except DocsUnavailableError as exc:
            return AnswerResult(
                resolved=False,
                brief=_brief(
                    question, [], f"Retrieval was unavailable ({exc}); could not ground an answer."
                ),
            )

        # 2. empty retrieval ⇒ nothing to ground on ⇒ escalate.
        if not chunks:
            return AnswerResult(
                resolved=False,
                brief=_brief(question, [], "No documentation matched the question."),
            )

        # 3. ground + generate.
        context = _build_context(chunks)
        user = f"Context sources:\n\n{context}\n\nQuestion: {question}"
        try:
            raw = await self._inference.generate(system=SYSTEM_PROMPT, user=user)
        except InferenceError as exc:
            return AnswerResult(
                resolved=False,
                brief=_brief(question, chunks, f"Generation failed ({exc}); retrieval succeeded."),
            )

        # 4. decide — the sentinel (alone) means the model judged the context insufficient.
        if raw.strip() == SENTINEL or raw.strip().startswith(SENTINEL):
            return AnswerResult(
                resolved=False,
                brief=_brief(
                    question,
                    chunks,
                    f"Retrieved {len(chunks)} source(s) but the model judged them insufficient to answer.",
                ),
            )

        return AnswerResult(
            resolved=True,
            answer=raw,
            citations=[c.source for c in chunks],
        )
