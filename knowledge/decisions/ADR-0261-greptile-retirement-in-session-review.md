# ADR-0261 — Greptile retired; the review gate is the in-session SHIP audit lane

**Status:** accepted · 2026-07-06 (operator decision taken live mid-PR #128; number 0261 was
reserved at the Kickoff D/E merge and this ADR formalizes the already-recorded lock).
**Supersedes** the PR-review half of the CI/credit rework (PRs #51/#60 — the path-scoped
`greptile-gate` required check) and every "greptile glob/rules row per new package"
requirement in specs/plans. **Extends** ADR-0016 (required checks). Append-only; supersede
with a later ADR, never edit.

## Context

Greptile (Starter plan) was the external PR reviewer, wired as the path-scoped
`greptile-gate` required check (PR #51, latency-tuned in #60). On 2026-07-06 the plan's
monthly review limit was hit mid-PR #128. The operator dropped the vendor outright — no
upgrade, no replacement external reviewer.

## Decision

1. **Greptile and the `greptile-gate` check are RETIRED.** `.github/workflows/greptile-gate.yml`
   and `.greptile/` are deleted; the `/greptile` skill and `@greptileai` mentions no longer
   function against this repo.
2. **The review gate is the in-session SHIP audit lane** per gridwork doctrine:
   `gw-code-reviewer` (opus) + `gw-security-auditor` (fable on the money/license seams this
   repo is full of) run against the branch diff before the PR opens; findings are
   adversarially verified and fixed in-session. This lane caught and fixed 12 findings on
   PR #128, including three P1 money bugs — it is the proven replacement, not a downgrade.
3. **CI required checks reduce to** `check` · `standards-gate` · `registry-index` ·
   `oscal-conformance` (convention: the private free-plan repo has no enforced branch
   protection, so "required" is discipline, not a GitHub gate).
4. **Teardown residue is tracked, not lost:** uninstall the Greptile GitHub app from the
   `caisson-sh` org and drop `GREPTILE_API_KEY` from `~/.gridwork/caisson.env` at the
   ADR-0226 credential sweep (rows in `docs/state/outstanding-work.md` §1).

## Consequences

- Specs/plans that mandated a greptile glob + `.greptile/rules.md` row per new package are
  void on that point (catalog-rework SPEC/PLAN already carry the correction).
- Review latency budgeting (the up-to-35-min gate wait) disappears from merge planning.
- The gate's design stays recoverable from git history (PRs #51/#60) if a future external
  reviewer is ever wired; re-wiring requires a new ADR.
