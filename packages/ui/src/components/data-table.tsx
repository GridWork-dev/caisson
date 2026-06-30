import { forwardRef } from "react";
import type { HTMLAttributes, ReactElement, ReactNode, Ref } from "react";

import { EmptyState } from "./empty-state";
import { LoadingState } from "./loading-state";

import "./data-table.css";

export interface DataTableColumn<T> {
  /** Stable column key (the React key for the header/body cells in this column). */
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  /** Right-align + tabular numerals (money/credit/count columns). */
  numeric?: boolean;
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
    className,
    ...rest
  }: DataTableProps<T>,
  ref: Ref<HTMLDivElement>,
): ReactElement {
  const colCount = Math.max(1, columns.length);

  return (
    <div
      ref={ref}
      className={className ? `cs-table-wrap ${className}` : "cs-table-wrap"}
      {...rest}
    >
      <table className="cs-table" data-dense={dense ? "" : undefined}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                data-numeric={col.numeric ? "" : undefined}
              >
                {col.header}
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
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={colCount} className="cs-table__state-cell">
                {empty ?? <EmptyState title="No rows yet" />}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
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
    </div>
  );
}

/**
 * DataTable — typed generic columns (`{ key, header, render }`) + rows, with the
 * built-in `loading` (skeleton) and empty states `EmptyState`/`LoadingState` already
 * wired in (a view never hand-rolls the three-state branch). Numeric columns
 * right-align with tabular figures via `numeric`.
 *
 * Recipe-compliant (ADR-0099): co-located CSS reading only `var(--cs-*)`, `dense` /
 * `numeric` as `data-*` attributes, BEM block `cs-table`, `forwardRef` on the scroll
 * wrapper (mirrors `SkuMatrix`). Presentational — no Radix. Generic components can't
 * use the plain `forwardRef<T, P>` signature, so the ref-forwarding inner function is
 * cast through the documented generic-forwardRef pattern.
 */
export const DataTable = forwardRef(DataTableInner) as <T>(
  props: DataTableProps<T> & { ref?: Ref<HTMLDivElement> },
) => ReactElement;
