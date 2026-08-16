# @caisson/eslint-config

## 0.1.0

### Minor Changes

- 59e1365: Static a11y lint floor (Kickoff T task 14): eslint-plugin-jsx-a11y recommended wired into the
  shared eslint config, scoped to JSX surfaces. Severities ride at warn for this wave because the
  remaining findings live in packages/ui and apps/site (frozen, owned by the parallel design
  session); the reconcile session fixes those and deletes the warn mapping so the plugin's own
  error severities gate the repo. ui-pro's nine findings are fixed here: labels bound to their
  Selects via useId, redundant tbody role dropped, menu/tree/option containers made
  programmatically focusable, treeitems carry aria-selected, and keyboard handling moved onto the
  focused tree rows.

## 0.0.1

### Patch Changes

- 8253e76: OSS launch readiness wave. LICENSE copyright restamped to Caisson Software LLC across the
  open set. README/AGENTS prose trued to the built reality: six-bundle vocabulary, current
  entitlement examples, decision-record citations stripped from public-facing docs. The
  eu-ai-act-sample template's kernel pin corrected to the current release line, with a
  dynamic staleness test so future version cuts fail loud. Docs service search now races the
  per-query embed against an eight-second deadline and degrades to the keyword floor instead
  of holding the query open past caller budgets; a refund-policy docs page makes refund
  questions answerable. Site sign-in sets a non-HttpOnly session-hint cookie so owned-items
  UI renders without an extra round trip, and the build ignores a spurious Next trace
  warning. Public-mirror exporter hardened: prose renames scoped to the open package set,
  four mirror-only test exclusions, a root bunfig for the mirror workspace, and a historical
  backfill mode for the rot-guard.
