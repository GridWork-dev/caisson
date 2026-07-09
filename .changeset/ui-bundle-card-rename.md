---
"@caisson/ui": minor
---

BREAKING: `EditionCard` / `EditionCardProps` are renamed to `BundleCard` /
`BundleCardProps` (`components/bundle-card`), completing the six-bundle vocabulary flip
(ADR-0257/0258 — editions dissolved into bundles). Pure rename: props, markup, and the
shipped `.cs-edition*` CSS class contract are unchanged. Update imports from
`EditionCard` to `BundleCard`.
