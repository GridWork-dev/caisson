---
"@caisson/ui": minor
---

BREAKING: `EditionCard` / `EditionCardProps` are renamed to `BundleCard` /
`BundleCardProps` (`components/bundle-card`), completing the six-bundle vocabulary flip
now that editions are sold as bundles. Pure rename: props, markup, and the
shipped `.cs-edition*` CSS class contract are unchanged. Update imports from
`EditionCard` to `BundleCard`.
