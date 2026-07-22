# ADR-0376 — Visual-remediation residual picker (2026-07-22, four locks)

Status: accepted
Date: 2026-07-22

## Context

The ADR-0375 closeout reconciled the design-critic ledger to 682 fixed / 37 accepted /
4 open. The same-day residual picker put the leftovers to the operator: the four open
rows, the accepted families that are genuinely executable, and the verification cadence.
This ADR records the locks; the `fix/vr-residuals` batch implements locks 1 and 3.

## Locks

1. **Open-row trio → FIXED NOW.** The footer "Resources" letter-spacing anomaly (one
   bug, two ledger rows), the AdminNav+CatalogNav stacked theme toggles (merged to
   one), and the admin foundations page's orphaned Panel C desktop layout ship in the
   residual batch. Ledger open count target after the next reconcile: 0.
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
