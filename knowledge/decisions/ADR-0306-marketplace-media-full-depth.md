# ADR-0306 — Marketplace media full-depth pass (every module carries all applicable slide kinds)

**Status:** accepted · 2026-07-09 (operator-locked, Kickoff-I scope-lock fork round, question 5
of 7 — the largest of the three offered batch shapes). **Tags:** `ui`, `frontend`. Refines
ADR-0290 (content model unchanged); closes the F2 trigger-parked media row.

## Context

The F2 row's premise — modules "still carrying placeholder brand art" — no longer holds: the
sitting's recon measured the placeholder gap at **zero** (21 of 22 modules verifiably carry
authored mechanism diagrams; no placeholder-only entries; one module unaccounted, to be verified
in-wave). What remains is that ADR-0290 ranks slide kinds (live-component > code-artifact >
diagram) and most modules sit on diagram-first carousels — below the standard's own preference
where a better kind exists. Offered: declare F2 closed · upgrade only qualifying modules · a
full-depth pass. The operator locked full-depth.

## Decision

Every module's carousel carries **all applicable ADR-0290 slide kinds**: a live-component slide
wherever the module ships a showable `@caisson/ui` surface (server-safe/presentational per the
ADR-0099 recipe), a code-artifact slide wherever a real single-sourced snippet exists on the
module's depth page, and the existing mechanism diagram — each kind present when and only when
its source genuinely exists (the ADR-0082 honest-artifact floor governs; nothing fabricated to
fill a slot). Concept-only modules legitimately stay diagram-only. The one unaccounted module is
verified and brought to standard. Bundle slides keep the ADR-0290 parametrized hero-artifact
composition, untouched.

## Consequences

- The marketplace reaches the ADR-0290 preference order everywhere it can be reached, not just
  where it was cheap — the richest honest carousel each module supports (~22 modules touched).
- Biggest audit surface of the offered shapes: every new slide is a claim about shipped
  behavior, so the in-session SHIP audit checks slides against real exports, not just rendering.
- F2 closes as "upgraded to standard-preferred kinds", not "placeholders filled" — the board
  row's stale premise is corrected in the same stroke.
