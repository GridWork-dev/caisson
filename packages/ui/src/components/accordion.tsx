import type { HTMLAttributes, ReactNode } from "react";

import "./accordion.css";

export interface AccordionItem {
  id: string;
  trigger: ReactNode;
  content: ReactNode;
  defaultOpen?: boolean;
}

interface AccordionBaseProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
> {
  items: readonly AccordionItem[];
}

export type AccordionProps =
  | (AccordionBaseProps & {
      /** Multiple items may be open at once (default) — no cross-item coordination needed. */
      type?: "multiple";
      name?: never;
    })
  | (AccordionBaseProps & {
      /** Only one item open at a time, via the native `<details name>` exclusive-group — free,
       * no JS. `name` must be unique per Accordion instance on the page (it is a document-wide
       * grouping key), so it is required rather than defaulted. */
      type: "single";
      name: string;
    });

/**
 * Accordion — a native `<details>`/`<summary>` disclosure list, generalizing `Faq`'s pattern to
 * any trigger/content pair. `type="single"` gets mutual-exclusivity for free from the native
 * `<details name>` group (broadly supported); no JS, no state, fully server-safe. Zero
 * dependencies (ADR-0291).
 *
 * Recipe-compliant (ADR-0099): co-located CSS reading only `var(--cs-*)`; BEM block
 * `cs-accordion`. The expand/collapse chevron is drawn in CSS off `[open]`, not a JS icon toggle.
 */
export function Accordion({
  items,
  type = "multiple",
  name,
  className,
  ...rest
}: AccordionProps) {
  return (
    <div
      className={className ? `cs-accordion ${className}` : "cs-accordion"}
      {...rest}
    >
      {items.map((item) => (
        <details
          key={item.id}
          className="cs-accordion-item"
          name={type === "single" ? name : undefined}
          open={item.defaultOpen ? true : undefined}
        >
          <summary className="cs-accordion-trigger">{item.trigger}</summary>
          <div className="cs-accordion-content">{item.content}</div>
        </details>
      ))}
    </div>
  );
}
