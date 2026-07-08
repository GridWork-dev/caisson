---
"@caisson/ui-pro": minor
---

Add four focus-managed interactive primitives: Tooltip, Popover, Menu (dropdown), and Drawer.
All hand-rolled with zero Radix and no `@floating-ui` dependency and rendered through a
portal via `react-dom`'s own `createPortal`. Tooltip follows the WAI-ARIA Tooltip pattern
(hover/focus-triggered, `aria-describedby`); Popover is a non-modal trigger-anchored
disclosure (`aria-expanded`/`aria-controls`, Escape-to-close-and-refocus, outside-click
dismiss) positioned by a small pure, unit-tested placement function (anchor to the trigger,
flip when it would overflow the viewport, clamp on the cross axis); Menu follows the
WAI-ARIA Menu Button pattern (`role="menu"`/`"menuitem"`, roving tabindex, arrow-key
navigation). Drawer is a modal, edge-anchored dialog (`role="dialog"`/`aria-modal`) with a
hand-written focus trap, Escape-to-close, a click-to-close scrim, locked body scroll, and
focus-return to whatever triggered it — the right shape for an off-canvas panel like a
mobile nav, where Popover's non-modal disclosure isn't. Every new primitive ships with an
automated axe-core accessibility regression test exercised against a real, interactive DOM.
