import { forwardRef } from "react";
import type { HTMLAttributes } from "react";

import { Icon } from "./icon";

import "./sku-matrix.css";

/** One matrix row: a label + a cell per column. `true`/`false` = included/excluded, string = note/price. */
export interface SkuMatrixRow {
  label: string;
  cells: readonly (boolean | string)[];
}

export interface SkuMatrixProps extends HTMLAttributes<HTMLDivElement> {
  /** Column headers (editions); the leading "Module" header is fixed. */
  columns: readonly string[];
  /** One row per module; each row has a `label` and a cell per column. */
  rows: readonly SkuMatrixRow[];
}

/**
 * SkuMatrix (V14 — editions × modules). Presentational; no Radix behavior needed.
 * Recipe-compliant (ADR-0099): co-located CSS reading only `var(--cs-*)`, BEM block `cs-matrix`,
 * `forwardRef` on the single DOM root (the scroll wrapper). The row-label weight that was an inline
 * `style` in the old `apps/site` primitive is now the `.cs-matrix th[scope="row"]` rule.
 */
export const SkuMatrix = forwardRef<HTMLDivElement, SkuMatrixProps>(
  function SkuMatrix({ columns, rows, className, ...rest }, ref) {
    return (
      <div
        ref={ref}
        className={
          className ? `cs-matrix__wrap ${className}` : "cs-matrix__wrap"
        }
        {...rest}
      >
        <table className="cs-matrix">
          <thead>
            <tr>
              <th scope="col">Module</th>
              {columns.map((c) => (
                <th key={c} scope="col">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <th scope="row">{r.label}</th>
                {r.cells.map((cell, i) =>
                  typeof cell === "boolean" ? (
                    <td
                      key={i}
                      className={cell ? "cs-matrix__yes" : undefined}
                      aria-label={cell ? "included" : "not included"}
                    >
                      {cell ? <Icon name="check" /> : "—"}
                    </td>
                  ) : (
                    <td key={i} className="cs-matrix__price">
                      {cell}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  },
);
