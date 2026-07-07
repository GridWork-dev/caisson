import { forwardRef } from "react";
import type { HTMLAttributes, ReactNode } from "react";

import { Icon } from "@caisson/ui/components";

import {
  verifyChain,
  type ChainEntry,
  type LinkStatus,
} from "../lib/audit-chain";

import "./audit-timeline.css";

export interface AuditEntry extends ChainEntry {
  /** Stable id (React key). */
  id: string;
  /** Pre-formatted timestamp (the caller owns locale/timezone formatting). */
  timestamp: ReactNode;
  /** What happened. */
  action: ReactNode;
  /** Who did it. */
  actor?: ReactNode;
  /** Expanded detail (payload summary, reason). */
  detail?: ReactNode;
}

export interface AuditTimelineProps extends Omit<
  HTMLAttributes<HTMLOListElement>,
  "children"
> {
  entries: readonly AuditEntry[];
  /** Verify each entry's `prevHash` against the previous entry's `hash` and badge the result.
   *  Default true. Set false when the chain was verified elsewhere and you only want the log. */
  verifyLinks?: boolean;
  ariaLabel?: string;
}

const BADGE: Record<
  LinkStatus,
  { icon: "shield" | "check" | "alert"; label: string }
> = {
  genesis: { icon: "check", label: "Chain root" },
  verified: { icon: "shield", label: "Link verified" },
  broken: { icon: "alert", label: "Broken link — tamper evidence" },
};

/** First 10 + last 6 hex/base64 chars, so a long digest reads at a glance without wrapping. */
export function shortHash(hash: string): string {
  return hash.length <= 20 ? hash : `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

/**
 * AuditTimeline — a hash-chain event log with per-link verification badges. Runs a presentation-side
 * link check (each entry's `prevHash` vs the previous entry's `hash`) and marks each row verified,
 * the chain root, or a broken link (tamper evidence). Takes entries entirely as props — it is
 * type-compatible with audit chain-entry shapes but has NO runtime dependency on any store, so it
 * drops into any app. Semantic `<ol>`; a broken link is announced, never colour-only.
 */
export const AuditTimeline = forwardRef<HTMLOListElement, AuditTimelineProps>(
  function AuditTimeline(
    {
      entries,
      verifyLinks = true,
      ariaLabel = "Audit timeline",
      className,
      ...rest
    },
    ref,
  ) {
    const statuses = verifyLinks ? verifyChain(entries) : null;
    return (
      <ol
        ref={ref}
        className={className ? `cs-timeline ${className}` : "cs-timeline"}
        aria-label={ariaLabel}
        {...rest}
      >
        {entries.map((entry, i) => {
          const status = statuses?.[i];
          const badge = status ? BADGE[status] : null;
          return (
            <li
              key={entry.id}
              className="cs-timeline__item"
              data-status={status}
            >
              <span className="cs-timeline__rail" aria-hidden="true">
                <span className="cs-timeline__dot" />
              </span>
              <div className="cs-timeline__body">
                <div className="cs-timeline__head">
                  <span className="cs-timeline__action">{entry.action}</span>
                  {badge ? (
                    <span
                      className="cs-timeline__badge"
                      data-status={status}
                      role="status"
                    >
                      <Icon name={badge.icon} aria-label={badge.label} />
                      <span className="cs-timeline__badge-text">
                        {status === "broken"
                          ? "Broken"
                          : status === "genesis"
                            ? "Root"
                            : "Verified"}
                      </span>
                    </span>
                  ) : null}
                </div>
                <div className="cs-timeline__meta">
                  <time className="cs-timeline__time">{entry.timestamp}</time>
                  {entry.actor ? (
                    <span className="cs-timeline__actor">{entry.actor}</span>
                  ) : null}
                  <span className="cs-timeline__hash" title={entry.hash}>
                    {shortHash(entry.hash)}
                  </span>
                </div>
                {entry.detail ? (
                  <div className="cs-timeline__detail">{entry.detail}</div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    );
  },
);
