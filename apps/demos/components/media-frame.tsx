// A deliberate mirror of apps/site/components/media-frame.tsx (ADR-0400). The two apps share no
// runtime code and neither should acquire a dependency on the other, so the ONE chrome both draw
// exists twice rather than in a package invented for two small presentational files — the same
// call media-frame.module.css already documents for mirroring `.cs-terminal` instead of reusing
// the packages/ui BEM classes. If a third consumer ever appears, that is the moment to promote
// this into @caisson-sh/ui, not before.
import type { ReactNode } from "react";

import styles from "./media-frame.module.css";

export interface MediaFrameProps {
  /** Visible chrome-bar text (mono, truncates on overflow). */
  label: string;
  /** Accessible name when `decorative` — defaults to `label`. Use this for a richer description
   *  than the short bar text carries (matches the prior per-diagram <title> precedent). */
  ariaLabel?: string;
  /** A `<StatusChip/>`-style chip or text rendered at the right of the bar. */
  status?: ReactNode;
  children: ReactNode;
  /** True for an authored diagram or composed artifact: the whole frame becomes one `role="img"`
   *  with `ariaLabel` as its accessible name, and the bar/body are hidden from the a11y tree so
   *  their internals aren't double-announced (the <MediaCarousel> caption already narrates the
   *  slide). False (default) for a real rendered component (e.g. DataTablePro) whose own semantics
   *  — a real table, a real timeline — should stay reachable as themselves. */
  decorative?: boolean;
}

/**
 * MediaFrame — the ONE standardized slide chrome (ADR-0290): a chrome bar + body every diagram and
 * component slide renders inside, so the whole marketplace media set reads as one uniform artifact
 * template (mirrors the homepage-terminal aesthetic `<CodeBlock frame>` already carries for
 * code-artifact slides). Purely presentational — no hooks, server-safe.
 */
export function MediaFrame({
  label,
  ariaLabel,
  status,
  children,
  decorative,
}: MediaFrameProps) {
  return (
    <div
      className={styles.frame}
      {...(decorative
        ? { role: "img" as const, "aria-label": ariaLabel ?? label }
        : {})}
    >
      <div
        className={styles.bar}
        {...(decorative ? { "aria-hidden": true } : {})}
      >
        <span className={styles.barLabel}>{label}</span>
        {status}
      </div>
      <div
        className={styles.body}
        {...(decorative ? { "aria-hidden": true } : {})}
      >
        {children}
      </div>
    </div>
  );
}
