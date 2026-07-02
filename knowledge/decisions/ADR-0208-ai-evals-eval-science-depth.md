# ADR-0208 — ai-evals eval-science depth: exit-classifier, Wilson-CI gate, reflexivity queue, Fleiss-kappa

**Status:** accepted · 2026-07-02 (harvest slice-2 wave, ADR-0204 scope + harden-in-place locks).
**Relates:** ADR-0062 (ai-evals module), ADR-0013 (golden/baseline discipline), ADR-0003 (down-only:
ai-evals never imports ai-kit or provider SDKs), ADR-0133 (clean-lift: exit-classifier + judge),
lift-sweep #5/#11/#15 (telesis + throughframe patterns, rebuild-clean).

## Context

Of the five harvest capabilities, only the LLM judge (port + cassette replay) exists. The baseline gate is
a flat mean-vs-committed-baseline compare — no confidence-interval statistic, no isolation of eval spend
from production budget, no mechanism that feeds production judge-disagreements back into the golden set,
and no multi-rater agreement or stability check. All four missing capabilities are dependency-free math +
port-shaped seams, which is exactly ai-evals' design lane.

## Decision

Build all four INSIDE `packages/ai-evals` (per the ADR-0204 harden-in-place lock; AI Production Kit
membership unchanged):

1. **exit-classifier** — Zod-typed taxonomy classifying WHY a run exited (success/error/timeout/refusal/
   budget-exhausted/…), usable as a grader annotation.
2. **Wilson-CI golden-set gate** — Wilson score interval statistic on pass-rates (dependency-free)
   augmenting the flat mean gate, + a budget-isolated eval ledger via an injected storage port (eval spend
   never mingles with ai-meter's production budget).
3. **Reflexivity queue** — accumulate/consolidate API capturing production judge-disagreement cases back
   into the golden dataset (throughframe pattern, rebuild-clean), queue behind a port.
4. **Fleiss-kappa ensemble + counterfactual stability** — multi-rater agreement over N judge verdicts +
   a perturbation-stability harness shape, with known-kappa test fixtures.

## Rejected

- **Seed these as new Agentic-Dev packages** — rejected by the ADR-0204 asymmetry lock.
- **A live-provider judge implementation in-package** — the Judge stays a caller-injected port
  (AGENTS.md discipline); ai-evals remains dependency-free.
