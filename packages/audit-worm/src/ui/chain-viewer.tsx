// @caisson/audit-worm/ui — the audit-chain viewer (ADR-0250 G2c/G2d). An embeddable,
// headless-data-in surface: it renders the chain entries + the kernel's verification verdict it is
// HANDED (no DB connection, no fetch). Composes the `@caisson/ui` floor (Section · MetricStat ·
// DataTable · StatusChip · EmptyState) — brand + a11y come from the kit, this file only maps the
// audit-worm domain shape onto it. Presentational + SSR-safe: no `useState`, no browser globals at
// module load or render — the consuming app owns the client boundary.
import type { CSSProperties } from "react";
import type {
  AuditChainEntry,
  ChainVerification,
  JsonValue,
} from "@caisson/kernel";
import {
  DataTable,
  EmptyState,
  MetricStat,
  Section,
  StatusChip,
} from "@caisson/ui/components";
import type { DataTableColumn, DataTableProps } from "@caisson/ui/components";

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
 * ChainViewer — the headline hash-chain integrity verdict + the entry ledger. `verification.valid`
 * drives the stat tone (positive / critical); a broken chain flags the offending `seq` inline.
 */
export function ChainViewer({
  entries,
  verification,
  loading,
  pageSize,
  page,
  onPageChange,
  className,
}: ChainViewerProps) {
  const { valid, brokenAt } = verification;

  const columns: readonly DataTableColumn<AuditChainEntry>[] = [
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
  ];

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
        </div>
      </Section>
    </div>
  );
}
