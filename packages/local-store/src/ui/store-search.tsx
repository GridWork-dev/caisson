// @caisson-sh/local-store/ui — the local-store search surface (ADR-0250 G2c/G2d). Headless +
// controlled: the HOST owns the query state and runs `LocalStore.hybridSearch` (or `.list`), then
// hands the ranked hits here. This surface opens no tenant DB and calls no embedder — it only
// renders the query box + the results it is given. Composes the `@caisson-sh/ui` floor; SSR-safe.
import type { CSSProperties } from "react";
import {
  DataTable,
  EmptyState,
  FormField,
  MetricStat,
  Section,
} from "@caisson-sh/ui/components";
import type { DataTableColumn } from "@caisson-sh/ui/components";

const MONO: CSSProperties = { fontFamily: "var(--cs-font-mono)" };
const STACK: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--cs-space-6)",
};
const ROW: CSSProperties = {
  display: "grid",
  gap: "var(--cs-space-4)",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
};

/** A fused hit ready to render: the store's `SearchHit` (`{ id, score }`) joined with the doc text
 * the host resolved (`ListedDoc.text`). `score` is omitted for a plain `list()` enumeration. */
export interface StoreSearchResult {
  id: string;
  text?: string;
  score?: number;
}

export interface StoreSearchProps {
  /** Controlled query text (the host runs the actual retrieval). */
  query: string;
  onQueryChange: (query: string) => void;
  /** The ranked results the host retrieved for `query`. */
  results: readonly StoreSearchResult[];
  /** Total docs in the tenant store, shown as context alongside the hit count. */
  total?: number;
  loading?: boolean;
  className?: string;
}

/**
 * StoreSearch — a controlled query box over the tenant hybrid store + a ranked results table
 * (RRF score descending as the host supplies it). The empty state distinguishes "type to search"
 * from "no matches" so a blank query never reads as a dead store.
 */
export function StoreSearch({
  query,
  onQueryChange,
  results,
  total,
  loading,
  className,
}: StoreSearchProps) {
  const columns: readonly DataTableColumn<StoreSearchResult>[] = [
    {
      key: "id",
      header: "Document",
      render: (r) => (
        <code style={MONO} title={r.id}>
          {r.id}
        </code>
      ),
    },
    {
      key: "text",
      header: "Preview",
      render: (r) => r.text ?? "—",
    },
    {
      key: "score",
      header: "Score",
      numeric: true,
      sortable: true,
      sortValue: (r) => r.score ?? 0,
      render: (r) => (r.score === undefined ? "—" : r.score.toFixed(4)),
    },
  ];

  const trimmed = query.trim();
  const empty =
    trimmed === "" ? (
      <EmptyState
        title="Type to search"
        description="Enter a query to retrieve documents from the local store."
      />
    ) : (
      <EmptyState
        title="No matches"
        description={`Nothing in the store matched “${trimmed}”.`}
      />
    );

  return (
    <div className={className}>
      <Section eyebrow="Local store" title="Search">
        <div style={STACK}>
          <FormField label="Query">
            <input
              type="search"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search the local store…"
              autoComplete="off"
            />
          </FormField>
          <div style={ROW}>
            <MetricStat label="Results" value={results.length} />
            {total !== undefined ? (
              <MetricStat label="Documents in store" value={total} />
            ) : null}
          </div>
          <DataTable
            columns={columns}
            rows={results}
            rowKey={(r) => r.id}
            dense
            loading={loading === true}
            empty={empty}
          />
        </div>
      </Section>
    </div>
  );
}
