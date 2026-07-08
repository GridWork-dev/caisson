---
"@caisson/ui": minor
---

Add six interactive primitives: Tabs, Checkbox, Radio, Switch, Badge, and Accordion. All
hand-rolled with zero Radix and zero new dependencies, following the kit's existing recipe —
co-located CSS reading only `--cs-*` tokens, `forwardRef` onto a single root, BEM naming,
`>=24px` touch targets, and hand-written keyboard interaction per the relevant WAI-ARIA
authoring pattern (tablist/tab/tabpanel for Tabs, native `<details name>` exclusive-group
for single-open Accordions, `role="switch"` for Switch). Every new primitive ships with an
automated axe-core accessibility regression test.
