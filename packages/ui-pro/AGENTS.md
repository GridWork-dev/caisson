# @caisson/ui-pro — authoring contract

The advanced component tier. Consume it from an application; nothing under
`packages/` may depend on it (it is a leaf).

## Rules

- Import components from `@caisson/ui-pro/components`.
- Every component themes through the `@caisson/ui` token contract (`var(--cs-*)`).
  Never hardcode a brand value.
- The data-ops components (`DataTablePro`, `OpsMatrix`, `PayloadViewer`) build on
  the open floor primitives — pass the same column/row and value contracts.
- The compliance components (`AuditTimeline`, `TypeToConfirm`) take their data as
  props and emit through callbacks. They never import a runtime store, so they
  stay portable across applications.
- Interactive components manage their own state; the pure transforms behind them
  (filter, sort, group, aggregate, CSV, tree-flatten) are exported for testing
  and server-side reuse.

## Accessibility contract

Keyboard operability, ARIA roles/labels, and focus management are part of each
component's public contract. A change that regresses them is a breaking change.
