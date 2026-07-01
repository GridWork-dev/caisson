import type { HTMLAttributes, ReactNode } from "react";

import "./faq.css";

export interface FaqItem {
  question: string;
  answer: ReactNode;
}

export interface FaqProps extends HTMLAttributes<HTMLDivElement> {
  items: readonly FaqItem[];
  /** Open the first item by default (e.g. a lead FAQ). Off by default. */
  defaultOpenFirst?: boolean;
  className?: string;
}

/**
 * Faq — a native `<details>`/`<summary>` disclosure list (recipe per ADR-0099). Replaces the two
 * divergent hand-rolled FAQ renders (a `Card`-grid on some pages, a bare flex-`div` on others) with
 * ONE accessible primitive: keyboard focus, screen-reader semantics, and a no-JS toggle come free
 * from `<details>`. Server-safe (no hooks/handlers). BEM block `cs-faq`; co-located CSS reads only
 * `var(--cs-*)`. Visible-FAQ rendering only — a page's `faqPage` JSON-LD stays where it is.
 */
export function Faq({
  items,
  defaultOpenFirst = false,
  className,
  ...rest
}: FaqProps) {
  return (
    <div className={className ? `cs-faq ${className}` : "cs-faq"} {...rest}>
      {items.map((item, i) => (
        <details
          key={item.question}
          className="cs-faq-item"
          open={defaultOpenFirst && i === 0 ? true : undefined}
        >
          <summary className="cs-faq-q">{item.question}</summary>
          <div className="cs-faq-a cs-muted">{item.answer}</div>
        </details>
      ))}
    </div>
  );
}
