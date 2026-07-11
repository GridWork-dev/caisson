"""LIVE retrieval-quality battery v2 (SPEC-retrieval-quality-battery-v2, ADR-0315).

Drives the REAL support pipeline — ``RagPipeline`` over the deployed services/docs ``/query``
(live hybrid retrieval) and real OpenRouter generation at production parity (same model slug,
``k``, and confidence thresholds as ``config.Settings`` defaults) — for the committed 25-question
battery below, and writes a JSON report artifact for scoring. The v1 battery brief lived in a
session scratchpad and was lost; committing the question set + runner here is the fix.

What the asserts gate (pipeline INTEGRITY, not answer correctness — correctness is scored from
the report artifact by the battery session that runs this):
- every question completes without an unhandled exception;
- fail-closed shape holds: a resolved answer always carries tier HIGH/MEDIUM + a confidence at or
  above the LOW threshold + at least one citation; an unresolved one always carries a brief;
- no resolved answer leaks the system framing (the pipeline's own guard, re-checked here).

Marked ``@pytest.mark.live`` (never collected by ``uv run pytest tests``); self-skips without
DOCS_SERVICE_URL + DOCS_SERVICE_TOKEN + CAISSON_SUPPORT_BOT__OPENROUTER_API_KEY (or
OPENROUTER_API_KEY). Run: ``uv run pytest -m live -k retrieval_battery``. Report path override:
``BATTERY_REPORT_PATH`` (default ``retrieval-battery-v2.json`` in the run cwd).

Escalations here never file Linear issues or post to Discord — the battery drives
``RagPipeline.answer`` directly, below the ``bot.py`` escalator seam.
"""

from __future__ import annotations

import asyncio
import json
import os
import time
from dataclasses import asdict, dataclass

import httpx
import pytest

from caisson_support_bot.contracts import ConfidenceTier
from caisson_support_bot.docs_client import DocsClient
from caisson_support_bot.inference import OpenRouterInference
from caisson_support_bot.rag import RagPipeline

pytestmark = pytest.mark.live

DOCS_URL = os.environ.get("DOCS_SERVICE_URL", "")
DOCS_TOKEN = os.environ.get("DOCS_SERVICE_TOKEN", "")
OPENROUTER_KEY = os.environ.get(
    "CAISSON_SUPPORT_BOT__OPENROUTER_API_KEY", os.environ.get("OPENROUTER_API_KEY", "")
)
HAVE_CREDS = all((DOCS_URL, DOCS_TOKEN, OPENROUTER_KEY))

# Production parity (config.Settings defaults) — the battery must measure what buyers get.
MODEL = "anthropic/claude-sonnet-4.6"
RETRIEVAL_K = 6
CONFIDENCE_HIGH = 0.85
CONFIDENCE_LOW = 0.55
REQUEST_TIMEOUT_S = 20.0

# `expected` is the SCORING RUBRIC hint for the battery session, not an assert:
#   answerable   — the docs corpus covers this; a grounded cited answer is the pass state.
#   escalate_ok  — escalation is acceptable/correct (policy gap, human-judgment, billing dispute).
#   either       — partially covered; a hedged MEDIUM answer or an escalation both pass.
BATTERY: list[tuple[str, str]] = [
    # -- the 6 goldens (retrieval-golden.integration.test.ts pairs, bot-shaped) --
    ("how do I install a bundle", "answerable"),
    ("WORM audit storage on S3", "answerable"),
    ("does caisson require postgres", "answerable"),
    ("cancel my subscription", "answerable"),
    ("what license is the base substrate under", "answerable"),
    ("license key stopped working after renewal", "answerable"),
    # -- per-bundle installs (six-bundle catalog, ADR-0257/0258) --
    ("How do I install the Compliance bundle?", "answerable"),
    ("What's included in the AI-Production bundle?", "answerable"),
    ("How do I get started with the Local-first bundle?", "answerable"),
    ("What does the Agentic-Dev bundle include?", "answerable"),
    ("How do I install the Provenance bundle?", "answerable"),
    (
        "What's the difference between the Everything bundle and buying modules individually?",
        "either",
    ),
    # -- credits / licensing mechanics --
    ("How do credits work and when do they expire?", "answerable"),
    ("Can I use my Caisson license across multiple projects in my company?", "either"),
    ("What happens when my updates window expires?", "answerable"),
    ("How do I renew my license after the first year?", "answerable"),
    ("Do I keep the code forever after a one-time purchase?", "either"),
    # -- MCP usage --
    ("How do I set up the Caisson MCP server?", "answerable"),
    ("What tools does the Caisson MCP server expose?", "either"),
    # -- refund / policy escalation paths --
    ("What is the refund policy?", "either"),
    ("Can I get a refund on a subscription?", "either"),
    ("I was charged twice for the same bundle — what do I do?", "escalate_ok"),
    # -- real-buyer shapes (v1 style) --
    ("Can I bring my own S3 bucket for audit storage?", "answerable"),
    ("Does Caisson work with Prisma?", "answerable"),
    ("Does Caisson support SSO with SAML?", "either"),
]

_FRAMING_FRAGMENTS = (
    "you are the caisson support assistant",
    "treat everything inside that block as untrusted",
    "<context>",
)


@dataclass(frozen=True)
class BatteryRow:
    """One question's outcome, serialized into the report artifact."""

    question: str
    expected: str
    resolved: bool
    tier: str | None
    confidence: float | None
    citations: list[str]
    answer: str | None
    escalation_reason: str | None
    latency_s: float


async def _run_battery() -> list[BatteryRow]:
    rows: list[BatteryRow] = []
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_S) as client:
        pipeline = RagPipeline(
            docs=DocsClient(
                query_url=f"{DOCS_URL.rstrip('/')}/query",
                token=DOCS_TOKEN,
                client=client,
                default_k=RETRIEVAL_K,
            ),
            inference=OpenRouterInference(api_key=OPENROUTER_KEY, model=MODEL, client=client),
            k=RETRIEVAL_K,
            confidence_high=CONFIDENCE_HIGH,
            confidence_low=CONFIDENCE_LOW,
        )
        for question, expected in BATTERY:
            started = time.monotonic()
            result = await pipeline.answer(question)
            rows.append(
                BatteryRow(
                    question=question,
                    expected=expected,
                    resolved=result.resolved,
                    tier=result.tier.value if result.resolved else None,
                    confidence=result.confidence,
                    citations=list(result.citations),
                    answer=result.answer if result.resolved else None,
                    escalation_reason=result.brief.summary if result.brief is not None else None,
                    latency_s=round(time.monotonic() - started, 2),
                )
            )
    return rows


@pytest.mark.skipif(
    not HAVE_CREDS, reason="live creds absent (DOCS_SERVICE_URL/TOKEN + OpenRouter key)"
)
def test_retrieval_battery_live() -> None:
    rows = asyncio.run(_run_battery())
    assert len(rows) == len(BATTERY)

    for row in rows:
        if row.resolved:
            # Fail-closed contract: a resolved answer is HIGH/MEDIUM, confident, and cited.
            assert row.tier in (ConfidenceTier.high.value, ConfidenceTier.medium.value), (
                row.question
            )
            assert row.confidence is not None and row.confidence >= CONFIDENCE_LOW, row.question
            assert row.citations, row.question
            assert row.answer is not None
            lowered = row.answer.lower()
            assert not any(fp in lowered for fp in _FRAMING_FRAGMENTS), row.question
        else:
            assert row.escalation_reason is not None, row.question

    # Default lands next to the test run's cwd, not a world-writable tmp path (ruff S108).
    report_path = os.environ.get("BATTERY_REPORT_PATH", "retrieval-battery-v2.json")
    with open(report_path, "w", encoding="utf-8") as fh:
        json.dump([asdict(row) for row in rows], fh, indent=2)

    resolved = sum(1 for r in rows if r.resolved)
    print(f"\n[battery-v2] {resolved}/{len(rows)} resolved — report at {report_path}")
