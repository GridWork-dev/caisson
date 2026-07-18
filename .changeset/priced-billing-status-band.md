---
"@caisson/agent-trajectory": minor
---

Usage events gain a fourth billing band, `priced`: pricebook-computed integer credits
attached to real adapter-extracted token counts, with provenance stamped in the new
optional `priceBookVersion` field. Priced events are cost statements, never charges —
only `metered` remains ledger-truth. The schema now enforces the credit invariant
(nonzero credits are only valid on `metered`/`priced` events), and run projections
report a `priced` usage band alongside the existing three.
