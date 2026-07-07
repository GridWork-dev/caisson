// Commercial component tier barrel. Consumers import from `@caisson/ui-pro/components`; set
// `transpilePackages: ["@caisson/ui-pro"]` in next.config so the raw .tsx + co-located .css transpile
// (same delivery as the open @caisson/ui floor it builds on).

export { DataTablePro } from "./data-table-pro";
export type {
  DataTableProColumn,
  DataTableProProps,
  SavedView,
} from "./data-table-pro";
export { TreePro } from "./tree-pro";
export type { TreeProProps } from "./tree-pro";
export { OpsMatrix } from "./ops-matrix";
export type { OpsCell, OpsMatrixProps, OpsMatrixRow } from "./ops-matrix";
export { AuditTimeline, shortHash } from "./audit-timeline";
export type { AuditEntry, AuditTimelineProps } from "./audit-timeline";
export { PayloadViewer } from "./payload-viewer";
export type { PayloadViewerProps } from "./payload-viewer";
export { TypeToConfirm } from "./type-to-confirm";
export type { ConfirmState, TypeToConfirmProps } from "./type-to-confirm";
export { DateRangePicker } from "./date-range-picker";
export type { DateRangePickerProps } from "./date-range-picker";

// Pure transforms + shared types — exported for direct testing and server-side reuse (the AGENTS
// contract): the sellable logic behind the interactive components lives in these, not the UI.
export {
  aggregate,
  applyFilters,
  compareCells,
  groupRows,
  matchesFilter,
  sortRows,
  toCsv,
} from "../lib/table-ops";
export type {
  Accessor,
  AccessorMap,
  Aggregator,
  Cell,
  ColumnFilter,
  FilterOp,
  RowGroup,
  SortDir,
  SortState,
} from "../lib/table-ops";
export { windowRange } from "../lib/virtual";
export type { RenderWindow } from "../lib/virtual";
export { flattenTree } from "../lib/tree";
export type { FlatNode, TreeNode } from "../lib/tree";
export { chainIntact, verifyChain } from "../lib/audit-chain";
export type { ChainEntry, LinkStatus } from "../lib/audit-chain";
export {
  DEFAULT_REDACT_KEYS,
  REDACTED,
  isRedactedKey,
  redactValue,
} from "../lib/redact";
export {
  billingCycle,
  fiscalQuarter,
  lastMonth,
  lastNDays,
  previousPeriod,
  standardPresets,
  thisMonth,
  yearToDate,
} from "../lib/date-presets";
export type {
  DateRange,
  PresetOptions,
  RangePreset,
} from "../lib/date-presets";
