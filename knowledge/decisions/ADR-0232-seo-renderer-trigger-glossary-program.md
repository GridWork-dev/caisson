# ADR-0232 — SEO section-union renderer trigger + glossary program pre-commit

**Status:** accepted · 2026-07-03 (fourth picker round, operator-locked). Locks the four forks of
`outputs/specs/deferred-respec/SPEC-seo-section-union-renderer.md`; extends the Stream-D
2026-06-30 board lock (option (a) shipped; union renderer (b) deferred behind a trigger).
**Fork C is an operator OVERRIDE of the tabled wait-for-demand recommendation.**
Append-only; supersede with a later ADR, never edit.
**Tags:** `frontend`, `ui`.

## Context

The Stream-D recon rejected the rigid IntentLadder at ~6 hand-crafted, divergent marketing pages
and deferred the flexible discriminated-union `<PageSections>` renderer behind a real-program
trigger. The drafted SPEC set the trigger bar but left threshold, program definition, first
program, and board wording as operator forks.

## Decision

| Fork                      | Lock                                                                                                                                                                                                                                                                                      |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A — trigger threshold** | **N ≈ 20+** committed near-identical pages (the Stream-D bar kept).                                                                                                                                                                                                                       |
| **B — "one program"**     | A **single committed initiative** of ≥ 20 near-identical pages; aggregating smaller candidate programs does not qualify.                                                                                                                                                                  |
| **C — first program**     | **OVERRIDE: pre-commit the bulk glossary/definition-term program now** — the one candidate that plausibly clears N≈20 alone. The glossary program gets its **own product SPEC**; the renderer is locked as that program's implementation detail, built together with it (SPEC Tasks 1–5). |
| **D — board wording**     | Edit the `decisions-and-forks.md` row to reference the SPEC by name + this ADR.                                                                                                                                                                                                           |

## Consequences

- Fork C fires the trigger: the next SEO work item is the **glossary program product SPEC**
  (term list, IA/routing, content sourcing, per-page data shape), and its PLAN carries the
  renderer build (SPEC Tasks 1–5, ~1–2 days mechanical) as the implementation vehicle.
- No renderer code lands before the glossary product SPEC is authored and its forks locked —
  the renderer never ships ahead of the program that justifies it (Forks A/B still govern any
  FUTURE second program).
- Board row updated per Fork D (this change).
