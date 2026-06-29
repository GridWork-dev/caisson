import { forwardRef } from "react";
import type { AnchorHTMLAttributes, ReactNode } from "react";

import { Icon, type IconName } from "./icon";

import "./edition-card.css";

export interface EditionCardProps extends Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "title"
> {
  /** Destination — EditionCard is ALWAYS a link, so it renders a plain `<a href>` (no framework). */
  href: string;
  /** Edition display name (rendered beside the glyph in the head). */
  name: string;
  /** Domain glyph (Lucide / bespoke) via the one `<Icon>` surface — rendered at `size="lg"`. */
  icon: IconName;
  /** A `<StatusChip>`/badge node shown at the right of the head. */
  status: ReactNode;
  /** One-line description under the head. */
  line: string;
  /** Featured-lead hierarchy (V12): spans the full grid row + accent border/tint. */
  lead?: boolean;
  /** One-line mono proof artifact (V8) — e.g. a CLI/CI line. */
  proof?: string;
}

/**
 * EditionCard — a featured-lead edition link (V12), ported from the inline-style `apps/site`
 * primitive to the recipe (ADR-0097): co-located CSS reading only `var(--cs-*)`, the `lead`
 * variant expressed as the `data-lead` attribute, and a self-contained `.cs-edition` surface that
 * replicates the interactive-card tonal hover + lift (no dependency on the sibling `card`).
 *
 *   - Framework-agnostic: ALWAYS navigates, so it renders a plain `<a href>` (no `next/link`); a
 *     Next consumer can still wrap/route normally since it's a real anchor.
 *   - `forwardRef` onto the single `<a>` DOM root, BEM block `cs-edition`.
 *   - `.cs-editions` (exported below) is the grid wrapper the page wraps cards in.
 */
export const EditionCard = forwardRef<HTMLAnchorElement, EditionCardProps>(
  function EditionCard(
    { href, name, icon, status, line, lead = false, proof, className, ...rest },
    ref,
  ) {
    return (
      <a
        ref={ref}
        href={href}
        className={className ? `cs-edition ${className}` : "cs-edition"}
        {...(lead ? { "data-lead": "" } : {})}
        {...rest}
      >
        <div className="cs-edition__head">
          <span className="cs-edition__title">
            <Icon name={icon} size="lg" />
            {name}
          </span>
          {status}
        </div>
        <p className="cs-edition__line">{line}</p>
        {proof ? <code className="cs-edition__proof mono">{proof}</code> : null}
      </a>
    );
  },
);
