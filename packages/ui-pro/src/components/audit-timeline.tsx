import { forwardRef } from "react";
import type { HTMLAttributes, ReactNode } from "react";

import { Icon } from "@caisson-sh/ui/components";
import type { RowState } from "@caisson-sh/kernel/audit-verify";

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
  /** Anchor-derived per-row six-state statuses, index-aligned to `entries` (the caller computes them
   *  from real WORM anchors — this component does NOT). When given, each row badges from them, closing
   *  the anchor-blindness gap (truncation/wholesale-rewrite show as `tampered`/`unverifiable`, not
   *  "verified"). No new runtime dependency — statuses are passed in, keeping the component portable. */
  statuses?: readonly RowState[];
  /** Run the presentation-side link check when no anchor `statuses` are given, and badge the result.
   *  Default true. Its "verified" badge is honestly relabelled "Link only" — a link check proves
   *  neighbour consistency, NOT the anchor commitment (it is blind to truncation + wholesale rewrite).
   *  Set false to render just the log. Ignored when `statuses` is provided. */
  verifyLinks?: boolean;
  ariaLabel?: string;
}

type BadgeIcon = "shield" | "check" | "alert" | "lock";

/** The honest blind-path badges (link check only). "verified" reads "Link only", never a bare pass. */
const LINK_BADGE: Record<
  LinkStatus,
  { icon: BadgeIcon; label: string; text: string }
> = {
  genesis: { icon: "check", label: "Chain root", text: "Root" },
  verified: {
    icon: "shield",
    label: "Link consistent (link check only)",
    text: "Link only",
  },
  broken: {
    icon: "alert",
    label: "Broken link — tamper evidence",
    text: "Broken",
  },
};

/** The anchor-aware six-state badges (only when the caller supplies real per-row `statuses`). */
const ROW_BADGE: Record<
  RowState,
  { icon: BadgeIcon; label: string; text: string }
> = {
  verified: {
    // The SPEC's sanctioned Level-2 copy — never "impossible to tamper" (SPEC copy law). This generic
    // component badges from a caller-supplied `RowState` and runs NO signature check itself, so it must
    // NOT claim "(signature-checked)": that strong wording is emitted only where a signature leg
    // actually verified an anchor against a pinned key (the ProofPanel / evidence-pack README).
    icon: "shield",
    label: "Verified against write-once anchor",
    text: "Verified",
  },
  "anchor-confirmed-original-not-disclosed": {
    icon: "lock",
    label: "Anchor confirmed — original not disclosed",
    text: "Anchor confirmed",
  },
  tampered: { icon: "alert", label: "Tampered", text: "Tampered" },
  unverifiable: { icon: "alert", label: "Unverifiable", text: "Unverifiable" },
  pending: { icon: "check", label: "Checking", text: "Checking" },
  genesis: { icon: "check", label: "Chain root", text: "Root" },
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
      statuses,
      verifyLinks = true,
      ariaLabel = "Audit timeline",
      className,
      ...rest
    },
    ref,
  ) {
    // Anchor-aware when the caller supplies real per-row statuses; else the honest blind link check.
    const linkStatuses =
      statuses === undefined && verifyLinks ? verifyChain(entries) : null;
    return (
      <ol
        ref={ref}
        className={className ? `cs-timeline ${className}` : "cs-timeline"}
        aria-label={ariaLabel}
        {...rest}
      >
        {entries.map((entry, i) => {
          const rowStatus = statuses?.[i];
          const linkStatus = linkStatuses?.[i];
          const badge =
            rowStatus !== undefined
              ? ROW_BADGE[rowStatus]
              : linkStatus !== undefined
                ? LINK_BADGE[linkStatus]
                : null;
          const dataStatus = rowStatus ?? linkStatus;
          return (
            <li
              key={entry.id}
              className="cs-timeline__item"
              data-status={dataStatus}
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
                      data-status={dataStatus}
                      role="status"
                    >
                      <Icon name={badge.icon} aria-label={badge.label} />
                      <span className="cs-timeline__badge-text">
                        {badge.text}
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
