---
"@caisson/ui-pro": minor
---

Add three focus-managed interactive primitives: Tooltip, Popover, and Menu (dropdown). All
hand-rolled with zero Radix and no `@floating-ui` dependency — positioning is computed by a
small pure, unit-tested placement function (anchor to the trigger, flip when it would
overflow the viewport, clamp on the cross axis) and rendered through a portal via
`react-dom`'s own `createPortal`. Tooltip follows the WAI-ARIA Tooltip pattern
(hover/focus-triggered, `aria-describedby`); Popover is a non-modal trigger-anchored
disclosure (`aria-expanded`/`aria-controls`, Escape-to-close-and-refocus, outside-click
dismiss); Menu follows the WAI-ARIA Menu Button pattern (`role="menu"`/`"menuitem"`, roving
tabindex, arrow-key navigation). Every new primitive ships with an automated axe-core
accessibility regression test exercised against a real, interactive DOM.
