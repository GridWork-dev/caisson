# Behavior and full-testing rubric

- Start with a user goal; route load alone is not a pass.
- Prove visible and relevant browser signals before and after every meaningful action.
- Exercise cancel, back, retry, invalid input, duplicate action, empty/loading/error, timeout, and degraded dependency recovery.
- Verify authentication, authorization, entitlement, ownership, and external-handoff boundaries fail closed.
- Complete the journey with keyboard alone; verify focus order, names/roles, focus return, and modal/popover escape behavior.
- Test mobile/desktop, light/dark, zoom/reflow, pointer/keyboard, and reduced motion.
- Detect stale optimistic state, double submits, missing progress, silent failures, misleading success, and unrecoverable navigation.
- Treat commercial/compliance copy, prices, plan/license state, and status labels as observable contracts.
- Do not call a hidden/private implementation detail the oracle. Pin what a user or browser can observe.
- Restore production state and prove cleanup before continuing.
