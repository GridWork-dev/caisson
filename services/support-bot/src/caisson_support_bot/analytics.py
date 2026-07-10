"""Per-answer product telemetry (2026-07-10): one PostHog event per pipeline verdict.

The confidence gate's thresholds (``SUPPORT_CONFIDENCE_HIGH``/``_LOW``) are env-tunable and wait
on real-traffic data — this module is that data. Every answered/escalated question emits a
``support_answer`` event carrying the tier, the raw self-assessed confidence, and the outcome; a
user replying ``escalate`` to a hedged MEDIUM answer emits ``support_escalate_reply`` — the free
"the hedge was wrong" label. Tuning is then reading a PostHog breakdown and setting two env vars.

Env-gated on ``POSTHOG_CAPTURE_KEY`` (the same convention as services/license's server-side
purchase capture); unset means the bot constructs no sink and nothing here runs. Fail-soft
throughout: a capture failure logs one line and never touches the answer path. The distinct id is
a salted-prefix SHA-256 of the Discord user id — never the raw id, never a username.
"""

from __future__ import annotations

import hashlib
import sys

import httpx

from .contracts import AnswerResult, ConfidenceTier

_QUESTION_CAP = 200
_REASON_CAP = 300


def hash_distinct_id(raw: str) -> str:
    """Stable pseudonymous distinct id for PostHog — hashed, prefixed, never the raw Discord id."""
    return "support:" + hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


def answer_event(
    *, question: str, result: AnswerResult, surface: str
) -> tuple[str, dict[str, object]]:
    """(event_name, properties) for one pipeline verdict — pure, the unit under test.

    ``outcome`` collapses the verdict into the three states tuning cares about; ``confidence`` is
    the raw self-assessment (None when the model never got far enough to grade — sentinel/empty
    retrieval/leak paths). ``tier`` is only meaningful on resolved answers, so it is only sent there.
    """
    props: dict[str, object] = {
        "surface": surface,
        "resolved": result.resolved,
        "confidence": result.confidence,
        "citations_count": len(result.citations),
        "question": question[:_QUESTION_CAP],
        "question_chars": len(question),
    }
    if result.resolved:
        props["tier"] = result.tier.value
        props["outcome"] = (
            "answered_high" if result.tier is ConfidenceTier.high else "answered_medium"
        )
    else:
        props["outcome"] = "escalated"
        if result.brief is not None:
            props["escalation_reason"] = result.brief.summary[:_REASON_CAP]
    return "support_answer", props


class AnswerAnalytics:
    """PostHog capture sink. Construct only when ``POSTHOG_CAPTURE_KEY`` is set (``__main__``)."""

    def __init__(self, *, key: str, host: str, client: httpx.AsyncClient) -> None:
        self._key = key
        self._url = host.rstrip("/") + "/capture/"
        self._client = client

    async def capture_answer(
        self, *, question: str, result: AnswerResult, surface: str, user_id: str
    ) -> None:
        event, props = answer_event(question=question, result=result, surface=surface)
        await self._post(event=event, distinct_id=hash_distinct_id(user_id), properties=props)

    async def capture_escalate_reply(
        self, *, user_id: str, referenced_answer: str | None
    ) -> None:
        """The reply-``escalate`` label: a human overrode a hedged answer with a real escalation."""
        await self._post(
            event="support_escalate_reply",
            distinct_id=hash_distinct_id(user_id),
            properties={
                "referenced_answer": (referenced_answer or "")[:_REASON_CAP],
                "surface": "channel",
            },
        )

    async def _post(
        self, *, event: str, distinct_id: str, properties: dict[str, object]
    ) -> None:
        try:
            resp = await self._client.post(
                self._url,
                json={
                    "api_key": self._key,
                    "event": event,
                    "distinct_id": distinct_id,
                    "properties": properties,
                },
            )
            if resp.status_code >= 400:
                sys.stderr.write(
                    f"[analytics] posthog capture {event} -> HTTP {resp.status_code}\n"
                )
        except httpx.HTTPError as exc:
            sys.stderr.write(
                f"[analytics] posthog capture {event} failed: {type(exc).__name__}\n"
            )
