// Commercial component tier barrel. Consumers import from `@caisson-sh/ui-pro/components`; set
// `transpilePackages: ["@caisson-sh/ui-pro"]` in next.config so the raw .tsx + co-located .css transpile
// (same delivery as the open @caisson-sh/ui floor it builds on).

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
export { AreaChart, BarChart, LineChart, Sparkline } from "./charts";
export type { CartesianChartProps, SparklineProps } from "./charts";
export { CommandPalette } from "./command-palette";
export type { CommandAction, CommandPaletteProps } from "./command-palette";
export { DiffViewer } from "./diff-viewer";
export type { DiffViewerProps } from "./diff-viewer";
export { KanbanBoard } from "./kanban-board";
export type { KanbanBoardProps } from "./kanban-board";
// Interactive primitives (ADR-0291) — the focus-managed/positioning-hard primitives that stay
// commercial (Tabs/Checkbox/Radio/Switch/Badge/Accordion are the open-base counterparts). The
// dialog-class primitive (trap+scrim+Escape) is the open `@caisson-sh/ui` Dialog, not a ui-pro
// component (ADR-0296 — supersedes ADR-0295's hand-rolled Drawer).
export { Tooltip } from "./tooltip";
export type { TooltipProps } from "./tooltip";
export { Popover } from "./popover";
export type { PopoverProps } from "./popover";
export { Menu } from "./menu";
export type { MenuItemSpec, MenuProps } from "./menu";

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
export {
  areaPath,
  extent,
  linearScale,
  linePath,
  niceTicks,
} from "../lib/charts";
export type { Point } from "../lib/charts";
export { fuzzyFilter, fuzzyMatch } from "../lib/fuzzy";
export type { FuzzyMatch } from "../lib/fuzzy";
export { diffJson, diffLines } from "../lib/diff";
export type {
  JsonChange,
  JsonChangeKind,
  LineChange,
  LineOp,
} from "../lib/diff";
export { columnCards, moveCard } from "../lib/board";
export type { BoardCard, BoardColumn, BoardLane } from "../lib/board";
export { computeFloatingPosition } from "../lib/position";
export type { FloatingPosition, Placement, Rect, Size } from "../lib/position";
