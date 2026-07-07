import { forwardRef } from "react";
import type { HTMLAttributes, ReactNode } from "react";

import "./detail-list.css";

export interface DetailItem {
  /** The row label (term). */
  term: ReactNode;
  /** The row value (description). Ignored when `href` is set with no explicit value. */
  description: ReactNode;
  /** Render the value as a link. */
  href?: string;
  /** Mono value (ids, hashes, amounts). */
  mono?: boolean;
}

export interface DetailListProps extends HTMLAttributes<HTMLDListElement> {
  items: readonly DetailItem[];
  /** Stack term-over-value (default) or lay them out in two columns. */
  layout?: "stacked" | "columns";
}

/**
 * DetailList — a semantic `<dl>` of term/value rows, the shared shape for the key-value and link-row
 * detail panels hand-rolled across dashboards. A row with `href` renders its value as a link. Use
 * `columns` for a label-left / value-right record, `stacked` for a scannable read.
 */
export const DetailList = forwardRef<HTMLDListElement, DetailListProps>(
  function DetailList({ items, layout = "stacked", className, ...rest }, ref) {
    return (
      <dl
        ref={ref}
        className={className ? `cs-detail ${className}` : "cs-detail"}
        data-layout={layout}
        {...rest}
      >
        {items.map((item, i) => (
          <div className="cs-detail__row" key={i}>
            <dt className="cs-detail__term">{item.term}</dt>
            <dd
              className="cs-detail__value"
              data-mono={item.mono ? "" : undefined}
            >
              {item.href ? (
                <a className="cs-detail__link" href={item.href}>
                  {item.description}
                </a>
              ) : (
                item.description
              )}
            </dd>
          </div>
        ))}
      </dl>
    );
  },
);
