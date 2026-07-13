---
"@caisson/eslint-config": minor
"@caisson/ui-pro": patch
---

Static a11y lint floor (Kickoff T task 14): eslint-plugin-jsx-a11y recommended wired into the
shared eslint config, scoped to JSX surfaces. Severities ride at warn for this wave because the
remaining findings live in packages/ui and apps/site (frozen, owned by the parallel design
session); the reconcile session fixes those and deletes the warn mapping so the plugin's own
error severities gate the repo. ui-pro's nine findings are fixed here: labels bound to their
Selects via useId, redundant tbody role dropped, menu/tree/option containers made
programmatically focusable, treeitems carry aria-selected, and keyboard handling moved onto the
focused tree rows.
