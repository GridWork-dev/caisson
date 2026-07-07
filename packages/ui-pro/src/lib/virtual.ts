/**
 * Fixed-row-height windowing math for virtualized lists/grids. Pure — given the scroll offset and
 * viewport height it returns the slice of rows to render plus the spacer heights that keep the
 * scrollbar honest. Reused by DataTablePro and TreePro.
 */

export interface RenderWindow {
  /** First row index to render (inclusive). */
  start: number;
  /** Last row index to render (exclusive). */
  end: number;
  /** Spacer height above the rendered slice, in px. */
  padTop: number;
  /** Spacer height below the rendered slice, in px. */
  padBottom: number;
}

/**
 * Compute the render window. `overscan` rows are rendered beyond the viewport on each side to hide
 * scroll seams. Guard is fail-closed on a non-positive/NaN `rowHeight` — `!(rowHeight > 0)` renders
 * ALL rows (a correct, if unvirtualized, view) rather than an empty or negative window.
 */
export function windowRange(
  total: number,
  scrollTop: number,
  rowHeight: number,
  viewportHeight: number,
  overscan = 4,
): RenderWindow {
  if (!(rowHeight > 0) || total <= 0) {
    return { start: 0, end: Math.max(0, total), padTop: 0, padBottom: 0 };
  }
  const offset = Math.max(0, scrollTop);
  const visible = Math.max(1, Math.ceil(viewportHeight / rowHeight));
  const start = Math.max(0, Math.floor(offset / rowHeight) - overscan);
  const end = Math.min(total, start + visible + overscan * 2);
  return {
    start,
    end,
    padTop: start * rowHeight,
    padBottom: (total - end) * rowHeight,
  };
}
