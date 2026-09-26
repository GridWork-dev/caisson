"use client";

// @caisson-sh/audit-worm/ui — the audit-chain viewer (ADR-0250 G2c/G2d, extended for per-row verification
// T-U2). Still an embeddable, headless-data-in surface — no DB connection: it renders the chain
// entries + the verdict it is HANDED, plus (when given) a PER-ROW six-state chip computed by the caller
// from real anchors, and an expandable proof panel that fetches the row's proof on open (fork f). When
// the per-row props are absent it degrades to the original chain-level-only view (backward compatible).
// Composes the `@caisson-sh/ui` floor (Section · MetricStat · DataTable · StatusChip · EmptyState).
import { useState, type CSSProperties } from "react";
import type {
  AuditChainEntry,
  ChainVerification,
  JsonValue,
} from "@caisson-sh/kernel";
import type {
  PinnedAnchorKey,
  RowState,
} from "@caisson-sh/kernel/audit-verify";
import {
  DataTable,
  EmptyState,
  MetricStat,
  Section,
  StatusChip,
} from "@caisson-sh/ui/components";
import type {
  DataTableColumn,
  DataTableProps,
} from "@caisson-sh/ui/components";
import { RowStateChip } from "./row-state-chip.tsx";
import { ProofPanel, type ProofBundleResponse } from "./proof-panel.tsx";

const MONO: CSSProperties = { fontFamily: "var(--cs-font-mono)" };
const STACK: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--cs-space-6)",
};

/** First 8 + last 6 chars of a hash, with the full value on hover. Genesis (`null`) reads plain. */
function shortHash(hash: string | null): string {
  if (hash === null) return "genesis";
  return hash.length > 18 ? `${hash.slice(0, 8)}…${hash.slice(-6)}` : hash;
}

/** A one-line JSON preview of an entry payload, bounded so a large object never blows out a cell. */
export function previewPayload(payload: JsonValue, max = 72): string {
  const json = JSON.stringify(payload) ?? "null";
  return json.length > max ? `${json.slice(0, max - 1)}…` : json;
}

export interface ChainViewerProps {
  /** The append-only chain entries, in `seq` order (the store hands them back sorted). */
  entries: readonly AuditChainEntry[];
  /** The kernel `verifyChain` verdict for `entries` (optionally against a trusted WORM anchor). */
  verification: ChainVerification;
  /** Per-row six-state statuses, indexed by entry `seq` — the caller computes them from real anchors
   *  (client recompute, M3). When given, each row shows its six-state chip; absent -> no status column. */
  rowStatuses?: readonly RowState[];
  /** Marks table statuses that were computed on the server, distinct from the expanded panel's
   *  browser recomputation. Omit only when the caller genuinely computed the table states locally. */
  rowStatusProvenance?: "server-asserted";
  /** Anchor provenance for the header line ("chain anchored at length N in write-once storage …"). */
  anchorProvenance?: { length: number; retainUntil?: string };
  /** Fetch a single row's proof bundle (calls the proof endpoint). When given, rows expand to a
   *  ProofPanel that fetches on open (fork f); absent -> rows are not expandable. */
  fetchProof?: (seq: number) => Promise<ProofBundleResponse>;
  /** The pinned anchor-signing public key, threaded to the expanded ProofPanel so its
   *  signature leg can run against a key delivered OUT-OF-BAND (app config), never the proof response. */
  pinnedAnchorKey?: PinnedAnchorKey;
  /** Tenant-scoped WORM account bound into signed-anchor envelope v2. */
  expectedAnchorAccountId?: string;
  /** Render the table's loading skeleton in place of rows. */
  loading?: boolean;
  /** Host-controlled page size — omit to render every entry. */
  pageSize?: number;
  /** Host-controlled 0-indexed page (pair with `onPageChange` for live paging). */
  page?: number;
  onPageChange?: (page: number) => void;
  className?: string;
}

/**
 * ChainViewer — the headline hash-chain integrity verdict + the entry ledger, now with optional
 * per-row verification. A mid-chain break does NOT poison earlier rows: rows carry their OWN
 * per-length status (the caller's `rowStatuses`), so an early row stays verified even past a later
 * `brokenAt`.
 */
export function ChainViewer({
  entries,
  verification,
  rowStatuses,
  rowStatusProvenance,
  anchorProvenance,
  fetchProof,
  pinnedAnchorKey,
  expectedAnchorAccountId,
  loading,
  pageSize,
  page,
  onPageChange,
  className,
}: ChainViewerProps) {
  const { valid, brokenAt } = verification;
  const [expandedSeq, setExpandedSeq] = useState<number | null>(null);

  const columns: DataTableColumn<AuditChainEntry>[] = [];

  if (rowStatuses !== undefined) {
    columns.push({
      key: "status",
      header: "Status",
      render: (e) => {
        const s = rowStatuses[e.seq];
        return s !== undefined ? (
          <RowStateChip
            state={s}
            {...(rowStatusProvenance === undefined
              ? {}
              : { provenance: rowStatusProvenance })}
          />
        ) : null;
      },
    });
  }

  columns.push(
    {
      key: "seq",
      header: "#",
      numeric: true,
      sortable: true,
      sortValue: (e) => e.seq,
      render: (e) =>
        e.seq === brokenAt ? (
          <StatusChip tone="accent" label={String(e.seq)} dot />
        ) : (
          e.seq
        ),
    },
    {
      key: "hash",
      header: "Entry hash",
      render: (e) => (
        <code style={MONO} title={e.hash}>
          {shortHash(e.hash)}
        </code>
      ),
    },
    {
      key: "prevHash",
      header: "Prev hash",
      render: (e) => (
        <code style={MONO} title={e.prevHash ?? "genesis"}>
          {shortHash(e.prevHash)}
        </code>
      ),
    },
    {
      key: "payload",
      header: "Payload",
      render: (e) => (
        <code style={MONO} title={JSON.stringify(e.payload)}>
          {previewPayload(e.payload)}
        </code>
      ),
    },
  );

  if (fetchProof !== undefined) {
    columns.push({
      key: "proof",
      header: "Proof",
      render: (e) => (
        <button
          type="button"
          onClick={() =>
            setExpandedSeq((cur) => (cur === e.seq ? null : e.seq))
          }
          aria-expanded={expandedSeq === e.seq}
        >
          {expandedSeq === e.seq ? "Hide" : "View"}
        </button>
      ),
    });
  }

  const controls: Partial<DataTableProps<AuditChainEntry>> = {};
  if (loading !== undefined) controls.loading = loading;
  if (pageSize !== undefined) controls.pageSize = pageSize;
  if (page !== undefined) controls.page = page;
  if (onPageChange) controls.onPageChange = onPageChange;

  return (
    <div className={className}>
      <Section eyebrow="Audit chain" title="Hash-chain integrity">
        <div style={STACK}>
          <MetricStat
            label="Chain status"
            value={valid ? "Verified" : `Broken at #${brokenAt ?? "?"}`}
            hint={`${entries.length} ${entries.length === 1 ? "entry" : "entries"}`}
            tone={valid ? "positive" : "critical"}
          />
          {anchorProvenance !== undefined ? (
            <p style={{ color: "var(--cs-fg-muted)", margin: 0 }}>
              Chain anchored at length {anchorProvenance.length} in write-once
              storage
              {anchorProvenance.retainUntil !== undefined
                ? ` · retained until ${anchorProvenance.retainUntil}`
                : ""}
            </p>
          ) : null}
          <DataTable
            columns={columns}
            rows={entries}
            rowKey={(e) => String(e.seq)}
            dense
            empty={
              <EmptyState
                title="No chain entries"
                description="This tenant's audit chain has no committed entries yet."
              />
            }
            {...controls}
          />
          {fetchProof !== undefined && expandedSeq !== null ? (
            <ProofPanel
              key={expandedSeq}
              seq={expandedSeq}
              fetchProof={fetchProof}
              chainStatus={verification}
              {...(pinnedAnchorKey !== undefined ? { pinnedAnchorKey } : {})}
              {...(expectedAnchorAccountId !== undefined
                ? { expectedAnchorAccountId }
                : {})}
            />
          ) : null}
        </div>
      </Section>
    </div>
  );
}
