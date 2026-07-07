import { forwardRef } from "react";
import type { HTMLAttributes, ReactElement, ReactNode, Ref } from "react";

import { EmptyState } from "./empty-state";
import { LoadingState } from "./loading-state";
import { Pagination } from "./pagination";

import "./data-table.css";

/** A cell value usable for sorting/filtering (a rendered `ReactNode` can't be compared). */
export type DataTableValue = string | number | boolean | null | undefined;

export interface DataTableColumn<T> {
  /** Stable column key (the React key for the header/body cells in this column). */
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  /** Right-align + tabular numerals (money/credit/count columns). */
  numeric?: boolean;
  /** Make the header a sort control. Requires `sortValue` to know what to compare. */
  sortable?: boolean;
  /** The comparable value for this column (sort + built-in text filter). */
  sortValue?: (row: T) => DataTableValue;
}

/** Controlled single-column sort (the free line: one sorted column at a time). */
export interface DataTableSort {
  key: string;
  dir: "asc" | "desc";
}

export interface DataTableProps<T> extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
> {
  columns: readonly DataTableColumn<T>[];
  rows: readonly T[];
  /** Stable row key extractor. */
  rowKey: (row: T, index: number) => string;
  /** Renders the built-in `LoadingState` (table variant) in place of `rows`. */
  loading?: boolean;
  /** Skeleton row count while `loading`. Default 5. */
  loadingRows?: number;
  /** Rendered in place of the table body when `rows` is empty and not `loading`.
   * Defaults to a generic `<EmptyState>`. */
  empty?: ReactNode;
  /** Tighten padding + shrink type for data-heavy grids. */
  dense?: boolean;
  /**
   * Current sort (controlled). The matching column's header shows the direction and carries
   * `aria-sort`; rows are ordered by that column's `sortValue` during render. Pair with
   * `onSortToggle` for interactivity, or set it statically for a server-sorted view.
   */
  sort?: DataTableSort | null;
  /** Header click handler; receives the clicked column key. Cycle asc→desc→null in the parent. */
  onSortToggle?: (key: string) => void;
  /** Render a search box above the table. Filters rows whose `searchText` (or any sortable
   *  column's `sortValue`) contains `filter`, case-insensitively. */
  filterable?: boolean;
  /** Controlled filter text (paired with `onFilterChange`). */
  filter?: string;
  onFilterChange?: (value: string) => void;
  filterPlaceholder?: string;
  /** Extra searchable text per row (in addition to sortable columns). */
  searchText?: (row: T) => string;
  /** Enable pagination at this page size. Rows are the post-filter/post-sort set. */
  pageSize?: number;
  /** Current 0-indexed page (controlled). Default 0. */
  page?: number;
  onPageChange?: (page: number) => void;
}

function compareValues(a: DataTableValue, b: DataTableValue): number {
  // nullish sorts last regardless of direction inversion (applied by the caller).
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

/** Case-insensitive substring haystack for a row: its `searchText` + every sortable column value. */
function rowHaystack<T>(
  row: T,
  columns: readonly DataTableColumn<T>[],
  searchText?: (row: T) => string,
): string {
  const parts: string[] = [];
  if (searchText) parts.push(searchText(row));
  for (const col of columns) {
    if (col.sortValue) {
      const v = col.sortValue(row);
      if (v != null) parts.push(String(v));
    }
  }
  return parts.join(" ").toLowerCase();
}

function DataTableInner<T>(
  {
    columns,
    rows,
    rowKey,
    loading = false,
    loadingRows = 5,
    empty,
    dense = false,
    sort = null,
    onSortToggle,
    filterable = false,
    filter,
    onFilterChange,
    filterPlaceholder = "Search…",
    searchText,
    pageSize,
    page = 0,
    onPageChange,
    className,
    ...rest
  }: DataTableProps<T>,
  ref: Ref<HTMLDivElement>,
): ReactElement {
  const colCount = Math.max(1, columns.length);

  // filter → sort → paginate, all computed during render (no hooks — server-safe).
  const query = (filter ?? "").trim().toLowerCase();
  let view: readonly T[] = rows;
  if (query.length > 0) {
    view = view.filter((r) =>
      rowHaystack(r, columns, searchText).includes(query),
    );
  }
  if (sort) {
    const col = columns.find((c) => c.key === sort.key);
    if (col?.sortValue) {
      const val = col.sortValue;
      const dir = sort.dir === "asc" ? 1 : -1;
      view = [...view].sort((a, b) => dir * compareValues(val(a), val(b)));
    }
  }

  const total = view.length;
  const pageCount = pageSize ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  const safePage = Math.min(Math.max(0, page), pageCount - 1);
  const pageRows =
    pageSize != null
      ? view.slice(safePage * pageSize, safePage * pageSize + pageSize)
      : view;

  const ariaSort = (key: string): "ascending" | "descending" | undefined =>
    sort?.key === key
      ? sort.dir === "asc"
        ? "ascending"
        : "descending"
      : undefined;

  return (
    <div
      ref={ref}
      className={className ? `cs-table-wrap ${className}` : "cs-table-wrap"}
      {...rest}
    >
      {filterable ? (
        <div className="cs-table__toolbar">
          <input
            type="search"
            className="cs-table__search"
            value={filter ?? ""}
            placeholder={filterPlaceholder}
            aria-label="Filter rows"
            onChange={(e) => onFilterChange?.(e.target.value)}
          />
        </div>
      ) : null}
      <table className="cs-table" data-dense={dense ? "" : undefined}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                data-numeric={col.numeric ? "" : undefined}
                aria-sort={
                  col.sortable ? (ariaSort(col.key) ?? "none") : undefined
                }
              >
                {col.sortable ? (
                  <button
                    type="button"
                    className="cs-table__sort"
                    onClick={() => onSortToggle?.(col.key)}
                    data-active={sort?.key === col.key ? "" : undefined}
                  >
                    {col.header}
                    <span className="cs-table__sort-arrow" aria-hidden="true">
                      {sort?.key === col.key
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
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={colCount} className="cs-table__state-cell">
                <LoadingState
                  variant="table"
                  rows={loadingRows}
                  columns={colCount}
                />
              </td>
            </tr>
          ) : pageRows.length === 0 ? (
            <tr>
              <td colSpan={colCount} className="cs-table__state-cell">
                {empty ?? <EmptyState title="No rows yet" />}
              </td>
            </tr>
          ) : (
            pageRows.map((row, i) => (
              <tr key={rowKey(row, i)}>
                {columns.map((col) => (
                  <td key={col.key} data-numeric={col.numeric ? "" : undefined}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      {pageSize != null && pageCount > 1 ? (
        <Pagination
          className="cs-table__pager"
          page={safePage}
          pageCount={pageCount}
          {...(onPageChange ? { onPageChange } : {})}
        />
      ) : null}
    </div>
  );
}

/**
 * DataTable — typed generic columns (`{ key, header, render }`) + rows, with built-in `loading`
 * (skeleton) and empty states already wired in. Numeric columns right-align with tabular figures.
 *
 * The free data line: optional single-column sort, a substring filter, and pagination, all computed
 * purely during render from CONTROLLED props — so the component stays hooks-free and renders in a
 * server tree unchanged. Supply `onSortToggle` / `onFilterChange` / `onPageChange` from a client
 * parent for interactivity, or set `sort` / `filter` / `page` statically (e.g. from the URL). The
 * batteries-included interactive grid (multi-filter, grouping, export, virtualization) is the
 * commercial `DataTablePro`.
 *
 * Recipe-compliant (ADR-0099): co-located CSS reading only `var(--cs-*)`, `dense`/`numeric` as
 * `data-*`, BEM block `cs-table`, `forwardRef` on the scroll wrapper. Generic components can't use
 * the plain `forwardRef<T, P>` signature, so the ref-forwarding inner function is cast through the
 * documented generic-forwardRef pattern.
 */
export const DataTable = forwardRef(DataTableInner) as <T>(
  props: DataTableProps<T> & { ref?: Ref<HTMLDivElement> },
) => ReactElement;
