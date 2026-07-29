---
"@caisson/standards-gate": patch
---

Both catalog parity checks gain the direction they were missing. The price check now also fails when the pricebook carries a row no price lock backs, which previously passed forever even though such a row still feeds upgrade credits and checkout quotes, and a renamed or retired one keeps quoting a product that no longer ships. The membership check now re-runs its claim against the published registry index as well as the workspace manifests, since the index is what a live buyer's grants actually resolve from; a gap there is reported as a warning, because publishing a member before folding it into its bundle legitimately opens that window for one release.
