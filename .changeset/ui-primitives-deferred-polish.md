---
"@caisson/ui": patch
"@caisson/ui-pro": patch
---

Closes out the a11y and perf polish deferred from the interactive-primitives review:

- `Dialog` now locks background scroll while open (a native `<dialog>`'s `showModal()`
  traps focus and makes the page inert, but never stopped it from scrolling underneath),
  restoring the prior value on close — including for nested dialogs, which share one
  counted lock so an inner dialog closing doesn't unlock scroll while an outer one is
  still open. Every drawer/modal consumer picks this up automatically.
- `Tabs` no longer points `aria-controls` at a tabpanel id that doesn't exist in the DOM.
  Only the active tab's panel is ever mounted, so inactive tabs now omit `aria-controls`
  instead of referencing a dangling id.
- `Tooltip`'s merged trigger ref is now memoized instead of being rebuilt on every render.
