---
"@caisson/site": patch
---

The anti-slop static-HTML detector's CSS-cascade engine now actually runs: css-select, css-tree,
and domutils are declared dependencies instead of unresolved dynamic imports that silently fell
back to the weaker text-only detector in CI. The gate output is unchanged — all existing findings
remain allowlisted.
