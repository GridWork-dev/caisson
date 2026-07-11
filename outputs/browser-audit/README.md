# Production browser audit evidence

Browser-audit runs are ignored by default because they can contain large screenshot matrices,
production state, and credential-adjacent browser evidence. A run is promoted into git only after
its mutation journal is closed, its artifacts validate, and a credential scan is clean.

## Tracked run

- [`2026-07-10-full-01/REPORT.md`](2026-07-10-full-01/REPORT.md) — reviewed full public-surface
  audit with signed-out buyer/admin boundary checks.
- The report, findings, mutation journal, decision record, manifest, accessibility snapshots,
  route metrics, Lighthouse reports, and performance trace are tracked.
- `2026-07-10-full-01/screenshots/` remains organized in this audit worktree but gitignored. It
  contains 147 screenshots / approximately 235 MB and can be regenerated from the run contract.

The manifest and finding evidence paths intentionally preserve the local screenshot references.
Their machine-readable metrics, accessibility trees, and Lighthouse evidence remain tracked so a
fresh clone retains the reviewable basis for every finding without permanently adding the image
matrix to repository history.

## Verification

See [`2026-07-10-full-01/VERIFY.md`](2026-07-10-full-01/VERIFY.md) for the promotion checks and
repository gates run before this evidence bundle was committed.
