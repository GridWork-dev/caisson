# ADR-0411 — Retire `tooling/design-critic`: archive the ledger verbatim, add a D8 visual dimension to audit-harness

- **Date:** 2026-08-19
- **Status:** Accepted (operator lock at the session picker, 2026-08-18)
- **Supersedes (in part):** ADR-0134 §"Decision" item 1 and its "Downstream" note — the clause that
  generalized the critic "without replacing" it, and deferred adoption to a future integration.
  This ADR takes the replacement, and it is a RETIREMENT, not the fold that clause imagined.
  ADR-0407 §"Decision" parked **C04** pending "a fresh operator decision"; this is that decision.
- **Parent:** ADR-0101 (the advisory Layer-3 critic this retires) · ADR-0233 (the audit-harness
  dimension model D8 extends) · ADR-0374/0375/0376/0377 (the visual-remediation program that closed
  the ledger) · the 2026-08 consolidation audit, row C04
  (`outputs/audit/2026-08-consolidation/evidence/C04-design-critic-fold.md`)

## Context

`@caisson/design-critic` was the ADR-0101 Layer-3 advisory critic: a one-binary package
(`design-critic-reconcile`) over a stable-ID `findings.toml` ledger, deliberately non-blocking. It
carried the visual audits from the 2026-07 remediation program.

Two facts decide it.

**The ledger is closed.** All 729 findings are `status = "fixed"` — 709 fixed and 14 accepted and 6
open at the ADR-0375 closeout, then the sextet closed at ADR-0377, then the 2026-07-22 post-deploy
re-audit flipped the last 14 accepted illustration-placeholder rows (`8a652c92`, CAISSON-149).
Nothing is open and nothing is accepted. The package is a finished work queue, not a live one.

**The audit card's fold premise is wrong, and that changes the answer.** C04 asserts "both already
use the shared reconciler". They do not: audit-harness hand-rolls its own `reconcile()` with
different required arguments, and — the load-bearing part — the two stable-ID formulas are
hash-space incompatible. design-critic hashes three fields,
`sha256(workflow ∷ surface ∷ normalizeTitle(title))[:16]`; audit-harness hashes four,
`sha256(domain ∷ dimension ∷ subject ∷ normalizeTitle(title))[:16]`. Same algorithm, same separator,
same normalizer, different arity — so no assignment of domain/dimension/subject reproduces a
three-field digest. A fold would have silently rewritten the identity of 729 resolved findings, and
a re-keyed finding is a finding whose history you can no longer follow back to the commit that fixed
it. The card's own refute attempt reached the same conclusion from the other side.

So the fold C04 proposed is not available. What is available is retirement: keep the closed ledger
as an archive under its own formula, and give audit-harness the LENS the critic carried so future
visual work has a live home.

## Decision

**Retire `tooling/design-critic`.** Delete the package; archive its ledger byte-verbatim; add a new
**D8 `visual-quality`** dimension to `@caisson/audit-harness` as the successor lens.

1. `tooling/design-critic/findings.toml` moves by `git mv` to
   `outputs/archive/audit/design-critic-findings-2026-08-18.toml` — byte-identical, SHA-256
   `89e1b8582d0ea47d4d5359c0ed449d24f68dd13682ce1669173506a6e7ce5777`, 5,835 lines, 729 rows. A
   sibling `.README.md` records the tally, both ID formulas, and why the ids cannot be recomputed.
2. The rest of `tooling/design-critic/` is deleted: the CLI, `findings.ts` + its tests, and the
   package manifest. `bun.lock` drops the workspace; the tooling count goes 8 to 7 and Bun
   workspaces 74 to 73.
3. `@caisson/audit-harness` gains dimension **D8 `visual-quality`** — rendered-surface craft on the
   Nielsen rubric (hierarchy, spacing/alignment, type scale, contrast and focus states, interaction
   and motion honesty, empty/error states), routed to the `gw-frontend-designer` lane. It is keyed
   on the **domain**, not the surface class — `apps/*` and nothing else — for the same reason D5
   already is. Surface class does not track "has a UI", and keying D8 on `buyer-runtime` would have
   been wrong in both directions: `apps/admin` is classified `internal-only` (operator
   control-plane) yet is a real rendered UI the retired ledger audited, while the four `services/*`
   domains are classified `buyer-runtime` yet are backend APIs with nothing to render. A
   class-keyed D8 would therefore have manufactured four dead service cells while silently dropping
   admin — the one non-obvious call in this ADR, and the reason the applicability is a domain rider.
4. **Historical rows are never re-keyed.** No backfill, no id migration, no import of the archived
   ledger by audit-harness. The archive is read as history; D8 starts empty.

## Consequences

- The `design-critic-reconcile` binary is gone. Nothing depended on it: no source importer, no
  skill, no CI workflow, no `.claude/` entry — its only invocation path was a manual command in the
  completed `outputs/specs/visual-remediation-2026-07/SPEC.md`. Package instructions that forbade
  audit-harness from touching design-critic (`tooling/audit-harness/AGENTS.md`, `README.md`) are
  rewritten to say the opposite: the harness is now the only ledger, and the archive is off-limits
  to re-keying rather than off-limits to reference.
- **The 729 archived findings keep their original three-field ids and are not addressable from
  audit-harness.** Looking up a historical visual finding means reading the archived TOML directly.
  That is the deliberate price of not rewriting resolved history, and it is stated here because a
  future reader would otherwise assume the ids carried over.
- `outputs/audit/coverage.toml` keeps its three `domain = "tooling/design-critic"` round-1 cells.
  That file is an append-per-round record of what a real run actually scanned; deleting the rows
  would falsify round 1. Nothing reconciles coverage domains against the live domain list —
  `deriveDomains` reads `tooling/*` off disk, so the domain simply stops being produced.
- Re-introducing a standalone design critic later is a new package decision, not a revert. The lens
  now lives in the harness; a second ledger for the same lens is the thing this ADR removes.
- **Correction to the ADR-0409/0410 record.** PR #442 renumbered the `docs/adr-index.md` contiguity
  line's `**0409**` entry to `**0410**` instead of appending, which dropped 0409 from the line and
  left 0410 described as "the oxc adoption landing". Both numbers are restored to their real
  subjects in the same commit as this ADR.
