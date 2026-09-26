# @caisson/ui-pro

The premium component tier for Caisson applications. It layers advanced data-ops
and compliance surfaces on the open `@caisson/ui` design-system floor — the
components a free kit paywalls, plus domain-composed operations views.

Licensed Apache-2.0. It builds on the open
Apache-2.0 `@caisson/ui` base and adds nothing you cannot theme through the same
token contract.

## Components

- **DataTablePro** — the advanced grid: multi-column filtering, row grouping with
  aggregation, column pinning and visibility, CSV export, and windowed rendering
  for large row sets. Layers on the floor `DataTable` column/row contract.
- **TreePro** — a virtualized tree for large hierarchies with lazy-loaded
  children and keyboard navigation.
- **OpsMatrix** — a generalized coverage matrix for permissions, controls, and
  SKU comparisons.
- **AuditTimeline** — a hash-chain event timeline with per-link verification
  badges. Takes chain entries as props; no runtime coupling to a store.
- **PayloadViewer** — a redaction-aware JSON / payload viewer with a collapsible
  tree, copy, and path masking.
- **TypeToConfirm** — a destructive-action dialog armed by retyping the resource
  name, with busy and result states.
- **DateRangePicker** — a range picker with fiscal-quarter and billing-cycle
  presets, a comparison range, and timezone-aware output.

## Accessibility

Every component ships full keyboard navigation, correct ARIA roles and labels,
and focus management (trap and restore in overlays). This is a launch
requirement, not a polish item.

## Usage

Components are shipped as raw `.tsx` with co-located CSS. In a Next application,
add the package to `transpilePackages` and import the token stylesheet from
`@caisson/ui` once at the root.

```tsx
import { DataTablePro } from "@caisson/ui-pro/components";
```
