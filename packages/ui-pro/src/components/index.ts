// Commercial component tier barrel. Consumers import from `@caisson-sh/ui-pro/components`; set
// `transpilePackages: ["@caisson-sh/ui-pro"]` in next.config so the raw .tsx + co-located .css transpile
// (same delivery as the open @caisson-sh/ui floor it builds on).

export { DataTablePro } from "./data-table-pro.tsx";
export type {
  DataTableProColumn,
  DataTableProProps,
  SavedView,
} from "./data-table-pro.tsx";
export { TreePro } from "./tree-pro.tsx";
export type { TreeProProps } from "./tree-pro.tsx";
export { OpsMatrix } from "./ops-matrix.tsx";
export type { OpsCell, OpsMatrixProps, OpsMatrixRow } from "./ops-matrix.tsx";
export { AuditTimeline, shortHash } from "./audit-timeline.tsx";
export type { AuditEntry, AuditTimelineProps } from "./audit-timeline.tsx";
export { PayloadViewer } from "./payload-viewer.tsx";
export type { PayloadViewerProps } from "./payload-viewer.tsx";
export { TypeToConfirm } from "./type-to-confirm.tsx";
export type { ConfirmState, TypeToConfirmProps } from "./type-to-confirm.tsx";
export { DateRangePicker } from "./date-range-picker.tsx";
export type { DateRangePickerProps } from "./date-range-picker.tsx";
export { AreaChart, BarChart, LineChart, Sparkline } from "./charts.tsx";
export type { CartesianChartProps, SparklineProps } from "./charts.tsx";
export { CommandPalette } from "./command-palette.tsx";
export type { CommandAction, CommandPaletteProps } from "./command-palette.tsx";
export { DiffViewer } from "./diff-viewer.tsx";
export type { DiffViewerProps } from "./diff-viewer.tsx";
export { KanbanBoard } from "./kanban-board.tsx";
export type { KanbanBoardProps } from "./kanban-board.tsx";
// Interactive primitives (ADR-0291) — the focus-managed/positioning-hard primitives that stay
// commercial (Tabs/Checkbox/Radio/Switch/Badge/Accordion are the open-base counterparts). The
// dialog-class primitive (trap+scrim+Escape) is the open `@caisson-sh/ui` Dialog, not a ui-pro
// component (ADR-0296 — supersedes ADR-0295's hand-rolled Drawer).
export { Tooltip } from "./tooltip.tsx";
export type { TooltipProps } from "./tooltip.tsx";
export { Popover } from "./popover.tsx";
export type { PopoverProps } from "./popover.tsx";
export { Menu } from "./menu.tsx";
export type { MenuItemSpec, MenuProps } from "./menu.tsx";

// Pure transforms + shared types — exported for direct testing and server-side reuse (the AGENTS
// contract): the logic behind the interactive components lives in these, not the UI.
export {
  aggregate,
  applyFilters,
  compareCells,
  groupRows,
  matchesFilter,
  sortRows,
  toCsv,
} from "../lib/table-ops.ts";
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
} from "../lib/table-ops.ts";
export { windowRange } from "../lib/virtual.ts";
export type { RenderWindow } from "../lib/virtual.ts";
export { flattenTree } from "../lib/tree.ts";
export type { FlatNode, TreeNode } from "../lib/tree.ts";
export { chainIntact, verifyChain } from "../lib/audit-chain.ts";
export type { ChainEntry, LinkStatus } from "../lib/audit-chain.ts";
export {
  DEFAULT_REDACT_KEYS,
  REDACTED,
  isRedactedKey,
  redactValue,
} from "../lib/redact.ts";
export {
  billingCycle,
  fiscalQuarter,
  lastMonth,
  lastNDays,
  previousPeriod,
  standardPresets,
  thisMonth,
  yearToDate,
} from "../lib/date-presets.ts";
export type {
  DateRange,
  PresetOptions,
  RangePreset,
} from "../lib/date-presets.ts";
export {
  areaPath,
  extent,
  linearScale,
  linePath,
  niceTicks,
} from "../lib/charts.ts";
export type { Point } from "../lib/charts.ts";
export { fuzzyFilter, fuzzyMatch } from "../lib/fuzzy.ts";
export type { FuzzyMatch } from "../lib/fuzzy.ts";
export { diffJson, diffLines } from "../lib/diff.ts";
export type {
  JsonChange,
  JsonChangeKind,
  LineChange,
  LineOp,
} from "../lib/diff.ts";
export { columnCards, moveCard } from "../lib/board.ts";
export type { BoardCard, BoardColumn, BoardLane } from "../lib/board.ts";
export { computeFloatingPosition } from "../lib/position.ts";
export type {
  FloatingPosition,
  Placement,
  Rect,
  Size,
} from "../lib/position.ts";
