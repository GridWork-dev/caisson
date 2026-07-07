import { forwardRef } from "react";
import type { HTMLAttributes, ReactElement } from "react";

import "./pagination.css";

export interface PaginationProps extends Omit<
  HTMLAttributes<HTMLElement>,
  "onChange"
> {
  /** Current page, 0-indexed. */
  page: number;
  /** Total number of pages (>= 1). */
  pageCount: number;
  /** Called with the next 0-indexed page. Omit for a static (server-rendered) pager. */
  onPageChange?: (page: number) => void;
  /** Accessible name for the nav landmark. Default "Pagination". */
  label?: string;
  /** Max number buttons to show around the current page. Default 5. */
  siblingCount?: number;
}

/** The 0-indexed page numbers to render as buttons, windowed around `page` with `first…last`
 *  anchors and gap sentinels (`-1`) where a gap is elided. Pure — unit-tested. */
export function paginationRange(
  page: number,
  pageCount: number,
  siblingCount = 5,
): number[] {
  if (pageCount <= 0) return [];
  const window = Math.max(1, siblingCount);
  if (pageCount <= window + 2) {
    return Array.from({ length: pageCount }, (_, i) => i);
  }
  const half = Math.floor(window / 2);
  const startRaw = Math.max(1, page - half);
  const end = Math.min(pageCount - 2, startRaw + window - 1);
  const start = Math.max(1, end - window + 1);
  const out: number[] = [0];
  if (start > 1) out.push(-1);
  for (let i = start; i <= end; i++) out.push(i);
  if (end < pageCount - 2) out.push(-1);
  out.push(pageCount - 1);
  return out;
}

/**
 * Pagination — an accessible page selector for tables and lists. Directive-free and hooks-free, so
 * it renders in a server tree AS-IS; supply `onPageChange` from a client parent for interactivity.
 * Prev/Next are disabled at the ends; the current page carries `aria-current="page"`.
 */
export const Pagination = forwardRef<HTMLElement, PaginationProps>(
  function Pagination(
    {
      page,
      pageCount,
      onPageChange,
      label = "Pagination",
      siblingCount = 5,
      className,
      ...rest
    },
    ref,
  ): ReactElement {
    const pages = paginationRange(page, pageCount, siblingCount);
    const atStart = page <= 0;
    const atEnd = page >= pageCount - 1;
    const go = (p: number) =>
      onPageChange?.(Math.min(Math.max(0, p), pageCount - 1));

    return (
      <nav
        ref={ref}
        className={className ? `cs-pager ${className}` : "cs-pager"}
        aria-label={label}
        {...rest}
      >
        <button
          type="button"
          className="cs-pager__step"
          aria-label="Previous page"
          disabled={atStart}
          onClick={() => go(page - 1)}
        >
          Prev
        </button>
        <ul className="cs-pager__list">
          {pages.map((p, i) =>
            p === -1 ? (
              <li key={`gap-${i}`} className="cs-pager__gap" aria-hidden="true">
                …
              </li>
            ) : (
              <li key={p}>
                <button
                  type="button"
                  className="cs-pager__page"
                  aria-label={`Page ${p + 1}`}
                  aria-current={p === page ? "page" : undefined}
                  onClick={() => go(p)}
                >
                  {p + 1}
                </button>
              </li>
            ),
          )}
        </ul>
        <button
          type="button"
          className="cs-pager__step"
          aria-label="Next page"
          disabled={atEnd}
          onClick={() => go(page + 1)}
        >
          Next
        </button>
      </nav>
    );
  },
);
