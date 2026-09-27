"use client";

import { useCallback, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { Button, Select } from "@caisson-sh/ui/components";

import {
  aggregate,
  applyFilters,
  groupRows,
  sortRows,
  toCsv,
  type Aggregator,
  type Cell,
  type ColumnFilter,
  type FilterOp,
  type SortState,
} from "../lib/table-ops.ts";
import { windowRange } from "../lib/virtual.ts";

import "./data-table-pro.css";

export interface DataTableProColumn<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  /** Right-align + tabular numerals. */
  numeric?: boolean;
  /** The comparable/exportable value — enables sort, filter, group, and CSV for this column. */
  value?: (row: T) => Cell;
  sortable?: boolean;
  filterable?: boolean;
  groupable?: boolean;
  /** Aggregator shown in a group's summary row (default `count`). */
  aggregate?: Aggregator;
  /** Plain-text header for CSV export (defaults to `key`). */
  exportHeader?: string;
}

/** A saved column/filter/sort/group configuration the user can re-apply. */
export interface SavedView {
  name: string;
  filters: ColumnFilter[];
  sort: SortState | null;
  groupBy: string | null;
}

export interface DataTableProProps<T> {
  columns: readonly DataTableProColumn<T>[];
  rows: readonly T[];
  rowKey: (row: T, index: number) => string;
  dense?: boolean;
  /** Enable windowed rendering at this fixed row height (px). Recommended past ~1k rows. */
  rowHeight?: number;
  /** Scroll viewport height (px) when virtualized. Default 480. */
  viewportHeight?: number;
  /** Enable CSV export under this file name. */
  exportFileName?: string;
  /** Controlled saved views + persistence callbacks. */
  views?: readonly SavedView[];
  onSaveView?: (view: SavedView) => void;
  emptyLabel?: string;
}

const FILTER_OPS: { value: FilterOp; label: string }[] = [
  { value: "contains", label: "contains" },
  { value: "equals", label: "equals" },
  { value: "notEquals", label: "does not equal" },
  { value: "gt", label: ">" },
  { value: "gte", label: "≥" },
  { value: "lt", label: "<" },
  { value: "lte", label: "≤" },
];

function fmtAgg(value: number | null): string {
  if (value === null) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/**
 * DataTablePro — the commercial advanced grid, layered on the floor DataTable's column/row contract
 * (a superset column type: add `value` to make a column sortable/filterable/groupable/exportable).
 * Batteries-included and interactive: a multi-column filter builder, single-column sort, row
 * grouping with per-group aggregation, column show/hide + pin-left, CSV export, saved views, and
 * fixed-height row virtualization for large sets. Fully keyboard operable with ARIA sort state and
 * grouped `rowgroup` semantics; themed entirely through the floor token contract.
 */
export function DataTablePro<T>({
  columns,
  rows,
  rowKey,
  dense = false,
  rowHeight,
  viewportHeight = 480,
  exportFileName,
  views,
  onSaveView,
  emptyLabel = "No rows match the current filters.",
}: DataTableProProps<T>) {
  const [filters, setFilters] = useState<ColumnFilter[]>([]);
  const [sort, setSort] = useState<SortState | null>(null);
  const [groupBy, setGroupBy] = useState<string | null>(null);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [pinned, setPinned] = useState<ReadonlySet<string>>(new Set());
  const [scrollTop, setScrollTop] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const accessors = useMemo(() => {
    const map: Record<string, (row: T) => Cell> = {};
    for (const c of columns) if (c.value) map[c.key] = c.value;
    return map;
  }, [columns]);

  // Ordered visible columns: pinned first (kept in declared order), then the rest.
  const visible = useMemo(() => {
    const shown = columns.filter((c) => !hidden.has(c.key));
    return [
      ...shown.filter((c) => pinned.has(c.key)),
      ...shown.filter((c) => !pinned.has(c.key)),
    ];
  }, [columns, hidden, pinned]);

  const processed = useMemo(() => {
    const filtered = applyFilters(rows, filters, accessors);
    return sortRows(filtered, sort, accessors);
  }, [rows, filters, sort, accessors]);

  const toggleSort = useCallback((key: string) => {
    setSort((prev) =>
      prev?.columnKey !== key
        ? { columnKey: key, dir: "asc" }
        : prev.dir === "asc"
          ? { columnKey: key, dir: "desc" }
          : null,
    );
  }, []);

  const setPin = (key: string, on: boolean) =>
    setPinned((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });

  const setShown = (key: string, on: boolean) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (on) next.delete(key);
      else next.add(key);
      return next;
    });

  const exportCsv = useCallback(() => {
    const cols = visible.filter((c) => c.value);
    const header = cols.map((c) => c.exportHeader ?? c.key);
    const body = processed.map((row) =>
      cols.map((c) => {
        const v = c.value!(row);
        return v == null ? "" : String(v);
      }),
    );
    const csv = toCsv([header, ...body]);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = exportFileName ?? "export.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [visible, processed, exportFileName]);

  const groupCol = groupBy ? columns.find((c) => c.key === groupBy) : undefined;
  const groups =
    groupCol?.value !== undefined ? groupRows(processed, groupCol.value) : null;

  const virtual = rowHeight != null && groups === null;
  const win = virtual
    ? windowRange(processed.length, scrollTop, rowHeight!, viewportHeight)
    : null;
  const windowRows = win ? processed.slice(win.start, win.end) : processed;

  const ariaSort = (key: string): "ascending" | "descending" | undefined =>
    sort?.columnKey === key
      ? sort.dir === "asc"
        ? "ascending"
        : "descending"
      : undefined;

  const colCount = visible.length;
  const filterableCols = columns.filter(
    (c) => c.value && c.filterable !== false,
  );
  const groupableCols = columns.filter((c) => c.value && c.groupable);
  // Instance-unique ids so the toolbar labels bind to their Selects (jsx-a11y
  // label-has-associated-control can't see through the kit's Select wrapper).
  const uid = useId();

  return (
    <div className="cs-grid" data-dense={dense ? "" : undefined}>
      <div className="cs-grid__toolbar">
        <FilterBuilder
          columns={filterableCols.map((c) => ({
            key: c.key,
            label: c.exportHeader ?? c.key,
          }))}
          filters={filters}
          onChange={setFilters}
        />
        <div className="cs-grid__tools">
          {groupableCols.length > 0 ? (
            <label className="cs-grid__tool" htmlFor={`${uid}-group`}>
              <span className="cs-grid__tool-label">Group</span>
              <Select
                id={`${uid}-group`}
                aria-label="Group by column"
                value={groupBy ?? ""}
                onChange={(e) => setGroupBy(e.target.value || null)}
                options={[
                  { value: "", label: "None" },
                  ...groupableCols.map((c) => ({
                    value: c.key,
                    label: c.exportHeader ?? c.key,
                  })),
                ]}
              />
            </label>
          ) : null}

          <details className="cs-grid__columns">
            <summary>Columns</summary>
            <ul className="cs-grid__col-menu">
              {columns.map((c) => (
                <li key={c.key} className="cs-grid__col-menu-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={!hidden.has(c.key)}
                      onChange={(e) => setShown(c.key, e.target.checked)}
                    />
                    {c.exportHeader ?? c.key}
                  </label>
                  <label className="cs-grid__pin">
                    <input
                      type="checkbox"
                      checked={pinned.has(c.key)}
                      onChange={(e) => setPin(c.key, e.target.checked)}
                    />
                    Pin
                  </label>
                </li>
              ))}
            </ul>
          </details>

          {views && views.length > 0 ? (
            <label className="cs-grid__tool" htmlFor={`${uid}-view`}>
              <span className="cs-grid__tool-label">View</span>
              <Select
                id={`${uid}-view`}
                aria-label="Apply saved view"
                defaultValue=""
                onChange={(e) => {
                  const v = views.find((x) => x.name === e.target.value);
                  if (v) {
                    setFilters(v.filters);
                    setSort(v.sort);
                    setGroupBy(v.groupBy);
                  }
                }}
                options={[
                  { value: "", label: "Saved views…" },
                  ...views.map((v) => ({ value: v.name, label: v.name })),
                ]}
              />
            </label>
          ) : null}

          {onSaveView ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const name = globalThis.prompt?.("Name this view");
                if (name) onSaveView({ name, filters, sort, groupBy });
              }}
            >
              Save view
            </Button>
          ) : null}

          {exportFileName !== undefined ? (
            <Button variant="ghost" size="sm" onClick={exportCsv}>
              Export CSV
            </Button>
          ) : null}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="cs-grid__scroll"
        style={virtual ? { maxHeight: `${viewportHeight}px` } : undefined}
        onScroll={
          virtual ? (e) => setScrollTop(e.currentTarget.scrollTop) : undefined
        }
      >
        <table className="cs-grid__table">
          <thead>
            <tr>
              {visible.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  data-numeric={col.numeric ? "" : undefined}
                  data-pinned={pinned.has(col.key) ? "" : undefined}
                  aria-sort={
                    col.sortable ? (ariaSort(col.key) ?? "none") : undefined
                  }
                >
                  {col.sortable && col.value ? (
                    <button
                      type="button"
                      className="cs-grid__sort"
                      onClick={() => toggleSort(col.key)}
                      data-active={sort?.columnKey === col.key ? "" : undefined}
                    >
                      {col.header}
                      <span className="cs-grid__sort-arrow" aria-hidden="true">
                        {sort?.columnKey === col.key
                          ? sort.dir === "asc"
                            ? "▲"
                            : "▼"
                          : "↕"}
                      </span>
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>

          {groups ? (
            groups.map((g) => (
              <tbody key={g.key} className="cs-grid__group">
                <tr className="cs-grid__group-head">
                  <th scope="colgroup" colSpan={colCount}>
                    <span className="cs-grid__group-name">
                      {String(g.value ?? "—")}
                    </span>
                    <span className="cs-grid__group-count">
                      {g.rows.length} rows
                    </span>
                    {visible
                      .filter((c) => c.value && c.aggregate)
                      .map((c) => (
                        <span key={c.key} className="cs-grid__group-agg">
                          {(c.exportHeader ?? c.key) + " "}
                          {c.aggregate}:{" "}
                          {fmtAgg(aggregate(g.rows, c.value!, c.aggregate!))}
                        </span>
                      ))}
                  </th>
                </tr>
                {g.rows.map((row, i) => (
                  <BodyRow
                    key={rowKey(row, i)}
                    row={row}
                    columns={visible}
                    pinned={pinned}
                  />
                ))}
              </tbody>
            ))
          ) : (
            <tbody>
              {processed.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="cs-grid__empty">
                    {emptyLabel}
                  </td>
                </tr>
              ) : (
                <>
                  {win && win.padTop > 0 ? (
                    <tr
                      aria-hidden="true"
                      style={{ height: `${win.padTop}px` }}
                    >
                      <td colSpan={colCount} />
                    </tr>
                  ) : null}
                  {windowRows.map((row, i) => (
                    <BodyRow
                      key={rowKey(row, (win?.start ?? 0) + i)}
                      row={row}
                      columns={visible}
                      pinned={pinned}
                      height={rowHeight}
                    />
                  ))}
                  {win && win.padBottom > 0 ? (
                    <tr
                      aria-hidden="true"
                      style={{ height: `${win.padBottom}px` }}
                    >
                      <td colSpan={colCount} />
                    </tr>
                  ) : null}
                </>
              )}
            </tbody>
          )}
        </table>
      </div>

      <p className="cs-grid__status" role="status">
        {processed.length} of {rows.length} rows
        {filters.length > 0 ? ` · ${filters.length} filters` : ""}
      </p>
    </div>
  );
}

function BodyRow<T>({
  row,
  columns,
  pinned,
  height,
}: {
  row: T;
  columns: readonly DataTableProColumn<T>[];
  pinned: ReadonlySet<string>;
  height?: number | undefined;
}) {
  return (
    <tr style={height != null ? { height: `${height}px` } : undefined}>
      {columns.map((col) => (
        <td
          key={col.key}
          data-numeric={col.numeric ? "" : undefined}
          data-pinned={pinned.has(col.key) ? "" : undefined}
        >
          {col.render(row)}
        </td>
      ))}
    </tr>
  );
}

function FilterBuilder({
  columns,
  filters,
  onChange,
}: {
  columns: { key: string; label: string }[];
  filters: ColumnFilter[];
  onChange: (next: ColumnFilter[]) => void;
}) {
  const [columnKey, setColumnKey] = useState(columns[0]?.key ?? "");
  const [op, setOp] = useState<FilterOp>("contains");
  const [value, setValue] = useState("");

  if (columns.length === 0) return null;

  const add = () => {
    if (!columnKey || value.trim() === "") return;
    onChange([...filters, { columnKey, op, value }]);
    setValue("");
  };

  return (
    <div className="cs-grid__filters">
      <div className="cs-grid__filter-add" role="group" aria-label="Add filter">
        <Select
          aria-label="Filter column"
          value={columnKey}
          onChange={(e) => setColumnKey(e.target.value)}
          options={columns.map((c) => ({ value: c.key, label: c.label }))}
        />
        <Select
          aria-label="Filter operator"
          value={op}
          onChange={(e) => setOp(e.target.value as FilterOp)}
          options={FILTER_OPS}
        />
        <input
          className="cs-grid__filter-value"
          aria-label="Filter value"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
          placeholder="value"
        />
        <Button variant="ghost" size="sm" onClick={add}>
          Add filter
        </Button>
      </div>
      {filters.length > 0 ? (
        <ul className="cs-grid__filter-chips">
          {filters.map((f, i) => {
            const label =
              columns.find((c) => c.key === f.columnKey)?.label ?? f.columnKey;
            return (
              <li key={i} className="cs-grid__chip">
                <span>
                  {label} {f.op} “{f.value}”
                </span>
                <button
                  type="button"
                  aria-label={`Remove filter ${label} ${f.op} ${f.value}`}
                  onClick={() => onChange(filters.filter((_, j) => j !== i))}
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
