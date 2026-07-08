---
"@caisson/site": patch
"@caisson/admin": patch
"@caisson/testing": patch
---

Repoint hand-rolled inline controls at the new kit interactive primitives: the marketplace
facet Type/Category/Price/Media filters now use `Radio`/`Checkbox` instead of raw
`<input>` elements, the primary-nav Editions/Marketplace/Resources disclosures now build on
the new `Popover` primitive (removing duplicated Escape/outside-click/focus-return
handling), the mobile hamburger nav now builds on the new `Drawer` primitive (removing
duplicated Escape handling; scrim-close, focus trap, and focus-return are the primitive's
job now), and the admin business-mutation panel's checkbox uses the same kit `Checkbox`.
`@caisson/testing` gains a shared axe-core + JSDOM harness (`renderIntoJsdom`,
`expectNoA11yViolations`/`expectNoA11yViolationsIn`) backing the new primitives' a11y
regression tests. Private packages only; no publishable release.
