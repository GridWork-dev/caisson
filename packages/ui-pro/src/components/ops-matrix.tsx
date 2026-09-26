import { forwardRef } from "react";
import type { HTMLAttributes, ReactNode } from "react";

import { Icon } from "@caisson-sh/ui/components";

import "./ops-matrix.css";

/**
 * A matrix cell: a boolean (covered / not), a coverage tri-state (`yes`/`partial`/`no`, optionally
 * labelled), or free text (a note, scope, or value).
 */
export type OpsCell =
  | boolean
  | string
  | { state: "yes" | "partial" | "no"; label?: string };

export interface OpsMatrixRow {
  /** Row label (the row-header cell). */
  label: ReactNode;
  /** One cell per column, in column order. */
  cells: readonly OpsCell[];
}

export interface OpsMatrixProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
> {
  /** The leading corner header over the row-label column. Default "Item". */
  rowHeader?: string;
  columns: readonly string[];
  rows: readonly OpsMatrixRow[];
  /** Visually-hidden `<caption>` naming the matrix for assistive tech. */
  caption?: string;
  /** Pin the header row + first column while scrolling. Default true. */
  sticky?: boolean;
}

function CellContent({ cell }: { cell: OpsCell }) {
  if (typeof cell === "boolean") {
    return cell ? (
      <Icon name="check" aria-label="covered" />
    ) : (
      <span aria-label="not covered">—</span>
    );
  }
  if (typeof cell === "string") {
    return <span className="cs-ops__note">{cell}</span>;
  }
  const label =
    cell.label ??
    (cell.state === "yes"
      ? "covered"
      : cell.state === "partial"
        ? "partial coverage"
        : "not covered");
  if (cell.state === "yes") return <Icon name="check" aria-label={label} />;
  if (cell.state === "partial")
    return <Icon name="circle-dot" aria-label={label} />;
  return <span aria-label={label}>—</span>;
}

function cellState(cell: OpsCell): "yes" | "partial" | "no" | "note" {
  if (typeof cell === "boolean") return cell ? "yes" : "no";
  if (typeof cell === "string") return "note";
  return cell.state;
}

/**
 * OpsMatrix — a coverage/comparison matrix generalized from the pricing SKU table: rows × columns of
 * covered / partial / not-covered / note cells. Drives permission matrices, control-coverage grids,
 * and edition/SKU comparisons from one contract. Presentational and recipe-compliant (co-located CSS
 * on `var(--cs-*)`, tri-state via `data-state`, `forwardRef` on the scroll frame); every cell carries
 * an `aria-label` so the glyphs are not the only signal.
 */
export const OpsMatrix = forwardRef<HTMLDivElement, OpsMatrixProps>(
  function OpsMatrix(
    {
      rowHeader = "Item",
      columns,
      rows,
      caption,
      sticky = true,
      className,
      ...rest
    },
    ref,
  ) {
    return (
      <div
        ref={ref}
        className={className ? `cs-ops ${className}` : "cs-ops"}
        data-sticky={sticky ? "" : undefined}
        {...rest}
      >
        <div className="cs-ops__wrap">
          <table className="cs-ops__table">
            {caption ? (
              <caption className="cs-ops__caption">{caption}</caption>
            ) : null}
            <thead>
              <tr>
                <th scope="col">{rowHeader}</th>
                {columns.map((c) => (
                  <th key={c} scope="col">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  <th scope="row">{r.label}</th>
                  {r.cells.map((cell, ci) => (
                    <td key={ci} data-state={cellState(cell)}>
                      <CellContent cell={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  },
);
