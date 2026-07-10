# ADR-0309 — Lighthouse assertions promoted to error-level; Kickoff-I wave evidence + ride-alongs

**Status:** accepted · 2026-07-09 (operator-locked, Kickoff-I scope-lock fork round, questions
6–7 of 7). **Tags:** `ui`, `infra`. Hardens the ADR-0079 CWV posture's enforcement; records the
sitting's ride-along scope.

## Context

`apps/site/lighthouserc.json` carries real budgets (LCP < 2500ms · TBT < 300ms · CLS < 0.1 ·
FCP < 1800ms · perf ≥ 0.9) but every assertion is `warn` and the workflow is
`workflow_dispatch`-only with `continue-on-error` — informational, never red. No bundle-size
gate exists anywhere in CI. A homepage WebGL piece (ADR-0306) lands into that vacuum. Offered:
evidence-only · promote assertions to error · wire a required CI gate. The operator locked the
middle option, plus the ride-along question's widest answer.

## Decision

1. **Assertions flip `warn` → `error`.** The lighthouserc budget assertions become error-level;
   the workflow stays manual-dispatch (not a required check — no new flaky gate the week before
   launch). When run, a budget miss is a red run, not a shrug.
2. **Wave evidence contract.** The Kickoff-I wave's verify artifact set: the ≤130KB home-route
   chunk ceiling asserted from `next build` output · one manual lighthouse dispatch against the
   built wave · a prod visual-harness delta over every touched route.
3. **Ride-alongs.** The wave takes the compare-page mobile-table P3 (390px checkmark columns
   squeezing the Detail column — verify against ADR-0299 §3a's shipped fix first, then fix
   what remains) **plus** a fresh sweep of `docs/state/outstanding-work.md` §3 and the delta
   doc for any other sub-hour design polish; every surviving row ships or re-parks with a named
   trigger, nothing silently dropped.

## Consequences

- The CWV budgets get teeth exactly when the first heavy visual lands, without adding a
  required check that could flake the launch-week merge queue.
- Bundle discipline stays self-policed (asserted per-wave, not per-PR) — accepted; a required
  bundle gate remains available as a future flip if a regression ever slips through.
- The residual board leaves the sitting fully dispositioned: everything design-flavored is
  either in this wave or parked on a named trigger.
