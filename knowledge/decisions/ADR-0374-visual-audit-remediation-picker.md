# ADR-0374 — Visual-audit remediation picker (2026-07-21, one round, four locks)

Status: accepted
Date: 2026-07-21

## Context

The 2026-07-21 full-surface visual audit (141 surfaces, hybrid rubric fleet + opencode ×
kimi-k3 adversarial round — report `outputs/reviews/visual-audit-2026-07-21.md`, ledger
reconciled to 723 rows) surfaced two operator forks it explicitly did not auto-decide, plus
the scope/execution questions for remediating the full finding set (4 P0 · 42 P1 · 188 P2 ·
268 P3 new, 89 still-present priors). All four put to the operator at one picker round.

## Locks

1. **F8 code-surface contract → UNIFY THEME-FOLLOWING.** All code artifacts (code blocks,
   terminals, Shiki-rendered panels) follow the active theme — light code surfaces in light
   mode. **Partially supersedes ADR-0078 §8 brand law B12** ("Code blocks are always-dark…
   code is the evidence hero"); the always-dark lock is retired. Mechanism: the shiki
   dual-theme CSS variables are already emitted (recorded in ADR-0298's decided-by-evidence
   note) — route the remaining always-dark paths through the theme-following contract. The
   unambiguous bug rides the same lane: the glossary flat-monochrome code (unregistered Shiki
   lang). Rider: this is a deliberate operator override of the adversarial-round "keep dual"
   recommendation; light-mode Shiki tokens must be tuned against the elevation system and a
   golden-file re-snapshot is required.
2. **Q1 social proof → build the truthful-signals block IN THIS PHASE.** No fabricated
   proof — the block surfaces only the true, underused signals (Apache-2.0 open base · live
   docs depth · build-state transparency) near the money CTAs (bundle popout + marketplace),
   inside the ADR-0082/0237 truthful-to-built floor. Rider: future `gw-persona-walkthrough`
   dispatches carry the locked positioning ADRs (0082/0237/0080) in their constraint set so
   personas stop critiquing settled posture.
3. **Scope → EVERYTHING, TIERED.** P0/P1 + the adversarially-ordered queue as engineered
   fixes; P2 batched per surface family; the 268-item P3 tail swept as bulk copy/cosmetic
   lanes. End state: nothing open in the ledger except operator-`accepted` rows. Ledger
   closure is verified by the next audit re-run (reconcile), not by hand-editing rows.
4. **Execution → PARALLEL WORKTREE WAVE per ADR-0328 D6.** Four tree-disjoint branch
   clusters, one PR each (hard), push-not-merge, boards frozen mid-wave, dedicated reconcile
   session at 2+ branches. Cluster map + shared-file ownership: the wave SPEC at
   `outputs/specs/visual-remediation-2026-07/SPEC.md`.

## Consequences

- ADR-0078 B12 is the only clause superseded; the rest of the brand-law set stands.
- CAISSON-135…142 map onto the four wave branches; the truthful-signals block lands as a new
  Linear work item. CAISSON-131 (persona) closes into lock 2's reframe.
- The fix-first F6 bundle-count truth fix (ADR-0082 violation) becomes the first commit of
  its cluster branch rather than a standalone PR.
