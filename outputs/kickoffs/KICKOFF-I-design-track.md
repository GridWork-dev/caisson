# Kickoff I — Design track: signature three.js piece · bespoke module media · polish backlog

**Status: SCOPE LOCKED 2026-07-09 (ADR-0304..0307) — BUILD RUNNING.** Authored 2026-07-09 per
ADR-0299 lock 4 ("spec next, don't start"). The scope-lock fork round ran as the opening act
(seven questions, two rounds; the operator redirected the concept class mid-round to an ambient
reactive background field). Locks: depth-fog lattice field · poster-first idle-hydrate ·
≤130KB three.js core · sitewide motion pass · media full-depth pass · lighthouse warn→error ·
compare-P3 + board-sweep ride-alongs. Fork-round record:
`docs/state/decisions-and-forks.md` §Kickoff-I scope-lock round.

**Provenance:** the residual board after Kickoff G closed (delta artifact
`outputs/reviews/visual-audit-delta-2026-07-09.md` — 0 P0 / 0 buyer-visible P1 on G-owned
surfaces) plus the standing trigger-parked design rows in `docs/state/outstanding-work.md` §3.
**Sibling boundary:** same as G — this kickoff owns `apps/site` presentation +
`packages/{brand,ui}` visuals; it never touches the registry Worker, license service, admin
app, or CI.

## Candidate scope (operator picks at the lock sitting)

1. **The three.js signature piece** — the homepage signature-visual slot, blank since the
   ADR-0104 brand block reserved it. Big lift: needs a concept round (what the piece depicts —
   e.g. the caisson/pressure metaphor of the brand story), a performance budget (LCP guard,
   `prefers-reduced-motion` fallback, mobile static poster), and a bundle-isolation plan
   (client-only dynamic import; the marketing bundle must not grow for non-home routes).
   Fork candidates: concept direction · static-fallback posture · budget ceiling.
2. **Bespoke module media batch** — the modules still carrying placeholder brand art in the
   marketplace carousel (the F2 trigger-parked row; the mechanism-diagram set now covers 20 —
   the batch decides which remaining modules get authored diagrams vs live-component slides
   per the ADR-0290 standard). Fork candidates: which modules, which slide kind each.
3. **Marketing-motion pass** — the ADR-0078 expressive-motion language is specified but only
   partially applied (reveal animations exist; the hero/section transitions and the
   marketplace card-viewer open/close have no authored motion). Fork candidate: scope to hero
   only vs sitewide pass.
4. **Anything parked at the lock sitting** — the board's small polish rows that survive to
   the sitting ride along or get explicitly dropped.

## Binding rules (inherited, not up for re-lock)

- Design lane per `identity/design-doctrine.md`: **refero research first**, then the
  `impeccable` craft pass inside the brand floor (ADR-0078); never restyle from intuition.
- Media standard: ADR-0290 (live-component or real-artifact static slides; no video).
- Copy law ADR-0080 + the ADR-0237 rider-2 full V1-live posture (no future framing).
- Review gate: in-session SHIP audit lane (gw-code-reviewer opus on the wave diff +
  gw-frontend-designer visual pass); findings fixed in-branch before the PR opens.
- Every dispatch sets `model` explicitly; parallel writers isolate in worktrees.

## Exit criteria (draft)

- Every locked scope item shipped through the standard wave shape (research → forks → build →
  in-session audit → PR → merge-when-green), with a prod visual-harness delta run over the
  touched routes as the verify artifact.
- The trigger-parked design rows in `outputs/../outstanding-work.md` §3 either shipped, or
  re-parked with a named trigger — nothing silently dropped.
