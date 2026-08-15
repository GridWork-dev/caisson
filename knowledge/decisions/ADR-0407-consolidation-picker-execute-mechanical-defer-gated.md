# ADR-0407 — Consolidation picker: execute the 18 verified cuts, defer the 6 decision-gated rows

- **Date:** 2026-08-15
- **Status:** Accepted (operator lock at the session picker, 2026-08-15)
- **Parent:** ADR-0397–0402 (the audit-remediation wave whose kickoff hard-don'ts the audit
  respected) · the 2026-08 consolidation audit (`outputs/audit/2026-08-consolidation/REPORT.md`,
  PR #423)

## Context

The 2026-08 consolidation audit admitted 18 refutation-verified reductions/ownership folds
(estimated 1,634–1,711 net lines) and 6 decision-gated / next-major / high-risk candidates
(`outputs/audit/2026-08-consolidation/PICKER-TABLE.md`). The picker round had been pending since
2026-08-10.

## Decision

**Execute rows 1–18 as one wave; defer rows 19–24.** The wave ran as a single worktree lane
(`chore/consolidation-wave-1`), one commit per cut, every card's premise re-verified against
current `main` before cutting (the audit base was five days stale; several card facts had
drifted and were handled at execution: a new CSS-module referencing file, C03's removal shifting
C06's count by one, and C05's cli rationale comment).

The deferred rows stay parked exactly as the picker table records them:

- **C01** (delete/delist `@caisson/analytics`) and **C04** (design-critic fold) each require a
  superseding ADR and are not taken here.
- **C10** belongs only in `field-crypto@2.0.0` (public API removal from a sold package).
- **C13**, **C16**, **C25** remain conditional/high-risk as tabled.

## Consequences

- Net ~1,050 lines deleted plus ~380 lines moved into owned homes; two live defect classes
  closed on the way (the Better Stack unauthenticated bypass, and the dependency-cruiser
  hand-copy drift that had silently stopped guarding the five ADR-0257 bundle roots).
- `@caisson/tenancy-rls` gains its first standalone public transactor export
  (`createPgTransactor`), a minor bump.
- The Better Stack Worker must be redeployed and auth-smoked (401/200) after merge — recorded in
  the wave PR as a deploy obligation.
- Re-proposing any deferred row re-enters through a fresh operator decision, not this ADR.
