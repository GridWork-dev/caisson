"""Unit tests for the eval harness itself (mini-port of the TS ``wilson.test.ts`` + baseline-gate
tests). NOT ``eval``-marked — this runs in the default ``uv run pytest`` lane, so a harness bug is
caught by the normal suite, independently of the (deselected-by-default) eval gate it powers.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from pydantic import ValidationError

from .harness import (
    EvalRun,
    GraderArgs,
    ScoredCase,
    gate_against_baseline,
    injection_grader,
    load_baseline,
    wilson_lower_bound,
)


def _grader_args(output: str, expected: object) -> GraderArgs:
    return GraderArgs(
        eval="e", scorer="s", case_id="c0", input=None, output=output, expected=expected
    )


def _run(
    *,
    name: str = "e",
    score: float = 1.0,
    cases: int = 1,
    threshold: float = 1.0,
    scorers: dict[str, float] | None = None,
    scored_cases: list[ScoredCase] | None = None,
    wilson_floor: float | None = None,
) -> EvalRun:
    scorers = scorers if scorers is not None else {"s": score}
    scored_cases = (
        scored_cases
        if scored_cases is not None
        else [ScoredCase("c0", {"s": score}, {"s": score >= 1.0}, score)]
    )
    return EvalRun(
        name=name,
        prompt_version_id="00000000-0000-4000-8000-000000000003",
        threshold=threshold,
        cases=cases,
        score=score,
        scorers=scorers,
        passed=score >= threshold,
        scored_cases=scored_cases,
        wilson_floor=wilson_floor,
    )


# --- Wilson lower bound (mirror of wilson.test.ts basics) ---------------------------------------


def test_wilson_large_sample_is_tight() -> None:
    lb = wilson_lower_bound(300, 300)
    assert lb > 0.95
    assert lb <= 1.0


def test_wilson_small_sample_is_wide() -> None:
    # 3/3 at 100% observed is not the same confidence as 300/300 — the bound is well below 0.5.
    assert wilson_lower_bound(3, 3) == pytest.approx(0.4385, abs=1e-4)


def test_wilson_no_trials_is_zero() -> None:
    assert wilson_lower_bound(0, 0) == 0.0


def test_wilson_zero_successes_is_zero() -> None:
    assert wilson_lower_bound(0, 10) == 0.0


# --- Injection grader fail-closed behavior ------------------------------------------------------


def test_injection_grader_raises_on_empty_rubric() -> None:
    # A malformed/empty rubric must RAISE, not silently pass — the check can't be disabled by omission.
    with pytest.raises(ValidationError):
        injection_grader()(_grader_args("anything", {"mustNotContain": []}))


def test_injection_grader_denies_forbidden_substring_case_insensitively() -> None:
    grade = injection_grader()
    hit = grade(_grader_args("... SECRET_LEAKED ...", {"mustNotContain": ["secret_leaked"]}))
    assert hit.passed is False and hit.score == 0.0
    clean = grade(_grader_args("a safe answer", {"mustNotContain": ["SECRET_LEAKED"]}))
    assert clean.passed is True and clean.score == 1.0


# --- Baseline gate: BLESS rewrite + regression detection ----------------------------------------


def test_bless_rewrites_baseline_then_plain_run_compares_green(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    baseline = tmp_path / "baseline.json"
    run = _run(name="demo", score=1.0, cases=2, scorers={"s": 1.0})

    monkeypatch.setenv("BLESS", "1")
    minted = gate_against_baseline(baseline, [run])
    assert minted.passed is True and minted.blessed is True
    assert baseline.exists()
    loaded = load_baseline(baseline)  # round-trips through the strict schema
    assert loaded.evals["demo"].score == 1.0
    assert loaded.evals["demo"].cases == 2

    monkeypatch.delenv("BLESS", raising=False)
    compared = gate_against_baseline(baseline, [run])
    assert compared.passed is True and compared.blessed is False


def test_missing_baseline_without_bless_is_an_error(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("BLESS", raising=False)
    with pytest.raises(FileNotFoundError):
        gate_against_baseline(tmp_path / "nope.json", [_run()])


def test_score_regression_is_detected(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    baseline = tmp_path / "baseline.json"
    monkeypatch.setenv("BLESS", "1")
    # Bless at a perfect score, threshold 0 so only the score drop (not below-threshold) can fire.
    gate_against_baseline(baseline, [_run(name="reg", score=1.0, threshold=0.0)])

    monkeypatch.delenv("BLESS", raising=False)
    result = gate_against_baseline(baseline, [_run(name="reg", score=0.5, threshold=0.0)])
    assert result.passed is False
    kinds = {f.kind for c in result.comparisons for f in c.findings}
    assert "score-regression" in kinds


def test_fewer_cases_is_detected(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    baseline = tmp_path / "baseline.json"
    monkeypatch.setenv("BLESS", "1")
    gate_against_baseline(baseline, [_run(name="shrink", cases=20, threshold=0.0)])

    monkeypatch.delenv("BLESS", raising=False)
    result = gate_against_baseline(baseline, [_run(name="shrink", cases=10, threshold=0.0)])
    assert result.passed is False
    kinds = {f.kind for c in result.comparisons for f in c.findings}
    assert "fewer-cases" in kinds


def test_wilson_below_floor_is_detected(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    baseline = tmp_path / "baseline.json"
    # 10/10 passes → Wilson lower bound ≈ 0.722, which sits below a 0.8 floor even at a perfect mean.
    scored = [ScoredCase(f"c{i}", {"s": 1.0}, {"s": True}, 1.0) for i in range(10)]
    run = _run(
        name="floor", score=1.0, cases=10, threshold=0.0, scored_cases=scored, wilson_floor=0.8
    )

    monkeypatch.setenv("BLESS", "1")
    gate_against_baseline(baseline, [run])
    monkeypatch.delenv("BLESS", raising=False)
    result = gate_against_baseline(baseline, [run])
    assert result.passed is False
    kinds = {f.kind for c in result.comparisons for f in c.findings}
    assert "wilson-below-floor" in kinds
