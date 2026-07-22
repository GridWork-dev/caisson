# ADR-0376 — Visual-remediation residual picker (2026-07-22, four locks)

Status: accepted
Date: 2026-07-22

## Context

The ADR-0375 closeout reconciled the design-critic ledger to 682 fixed / 37 accepted /
4 open. The same-day residual picker put the leftovers to the operator: the four open
rows, the accepted families that are genuinely executable, and the verification cadence.
This ADR records the locks; the `fix/vr-residuals` batch implements locks 1 and 3.

## Locks

1. **Open-row trio → FIXED NOW.** Recon amendment (same sitting): two of the three were
   already fixed by the ADR-0374 wave itself and their ledger rows were stale opens —
   the footer "Resources" letter-spacing (the `.cs-footer-heading` rule replaced the
   borrowed inline-flex `.cs-status`, per-character advance verified uniform) and the
   CatalogNav duplicate theme toggle (removed in the wave; AdminNav carries the one
   global toggle). Both flip at the lock-4 reconcile. The one real fix, shipped in the
   residual batch: the admin foundations page's orphaned Panel C (auto-fit minmax sat on
   the exact 3-column threshold at ~1280px; now an explicit 3-up grid for the fixed
   A/B/C set). Ledger open count target after the next reconcile: 0.
2. **Illustration placeholders → FULL DESIGN KICKOFF.** The 14 accepted
   empty-blueprint-slot rows are answered with a proper design-track kickoff: a bespoke
   blueprint/cross-section schematic system per DESIGN.md §5 across the remaining
   module/bundle surfaces (extending the Kickoff-I live-component precedent, honest
   artifacts only). Operator-in-loop kickoff (design-typed per WS10); the accepted
   status on those rows stands until the kickoff ships, then closes by re-audit.
3. **Accepted-exec quartet → BUILT.** Four accepted families move to built in the
   residual batch: a sticky in-page TOC jump-nav rail on the legal pages (fills the
   flagged right-column dead space without touching the 62ch measure), the Turnstile
   footer-newsletter root-cause fix (the desktop "Unable to connect" error state),
   silencing the vendor console-NaN emission (one fix clears the 13-row family), and
   the retention-runner light-mode card-tint token fix (site-wide surface-1 step, with
   contrast-gate + golden re-snapshots).
4. **Re-audit → AFTER THE BATCH SHIPS.** The next full visual audit runs once the
   residual batch merges and deploys — one run verifies the wave, the closeout, and the
   residuals together; its reconcile flips the executed accepted rows and the open trio.

## Consequences

- The ledger converges to fixed/accepted-only with a single verifying audit round.
- The schematics kickoff is the one remaining visual program; it carries its own SPEC
  and does not block the residual batch.
- ADR-0375's counsel rider on the legal restyle is unaffected; the TOC rail is styling
  and navigation only, no legal copy changes.
