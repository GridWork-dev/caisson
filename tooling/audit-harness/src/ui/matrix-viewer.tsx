// @caisson-sh/audit-harness/ui — the audit matrix viewer (ADR-0250 G2c/G2d). A headless-data-in
// surface: it renders the reconciled `Finding` ledger + the `CoverageRow` grid the harness produced
// (no run, no filesystem). Pivots coverage into a domain × dimension matrix (latest round wins),
// then lists the findings. `@caisson-sh/audit-harness` is private tooling — this surface ships only
// with the admin/tooling app. Composes the `@caisson-sh/ui` floor; presentational + SSR-safe.
import type { CSSProperties } from "react";
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
  StatusChipTone,
} from "@caisson-sh/ui/components";
import { DIMENSIONS } from "../dimensions.ts";
import type { Finding, FindingSeverity, FindingStatus } from "../findings.ts";
import type { CoverageRow } from "../coverage.ts";

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

const SEVERITY_TONE: Record<FindingSeverity, StatusChipTone> = {
  high: "accent",
  warn: "muted",
  info: "muted",
};
const STATUS_TONE: Record<FindingStatus, StatusChipTone> = {
  open: "accent",
  fixed: "success",
  accepted: "muted",
};

/** One pivoted cell: whether the (domain × dimension) shard ran, and how many findings it holds. */
export interface MatrixCell {
  executed: boolean;
  findings: number;
}
/** One matrix row: a domain and its cell per canonical dimension id. */
export interface MatrixRow {
  domain: string;
  cells: Record<string, MatrixCell>;
}

/** Pivot coverage rows into a domain × dimension grid, keeping the LATEST round per cell. Pure. */
export function buildMatrix(coverage: readonly CoverageRow[]): MatrixRow[] {
  const domains = new Map<string, Map<string, CoverageRow>>();
  for (const r of coverage) {
    const byDim = domains.get(r.domain) ?? new Map<string, CoverageRow>();
    const prev = byDim.get(r.dimension);
    if (!prev || r.round >= prev.round) byDim.set(r.dimension, r);
    domains.set(r.domain, byDim);
  }
  return [...domains.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([domain, byDim]) => {
      const cells: Record<string, MatrixCell> = {};
      for (const [dim, r] of byDim) {
        cells[dim] = { executed: r.executed, findings: r.findings };
      }
      return { domain, cells };
    });
}

export interface MatrixViewerProps {
  /** The reconciled findings ledger. */
  findings: readonly Finding[];
  /** The per-cell coverage rows (all rounds) — omit to hide the matrix and show findings only. */
  coverage?: readonly CoverageRow[];
  loading?: boolean;
  /** Host-controlled findings filter (pair with `onFilterChange`). */
  filter?: string;
  onFilterChange?: (value: string) => void;
  className?: string;
}

/**
 * MatrixViewer — the coverage grid (which domain × dimension shards ran) atop the findings ledger,
 * with an open / high-severity headline. Severity + status map to the kit's chip tones; the literal
 * level is always the chip label so the coarse tone palette never hides the value.
 */
export function MatrixViewer({
  findings,
  coverage,
  loading,
  filter,
  onFilterChange,
  className,
}: MatrixViewerProps) {
  const open = findings.filter((f) => f.status === "open").length;
  const high = findings.filter((f) => f.severity === "high").length;
  const matrix = coverage ? buildMatrix(coverage) : [];
  const dimensionIds = DIMENSIONS.map((d) => d.id);

  const matrixColumns: readonly DataTableColumn<MatrixRow>[] = [
    {
      key: "domain",
      header: "Domain",
      sortable: true,
      sortValue: (r) => r.domain,
      render: (r) => r.domain,
    },
    ...dimensionIds.map<DataTableColumn<MatrixRow>>((dim) => ({
      key: dim,
      header: dim,
      numeric: true,
      render: (r) => {
        const cell = r.cells[dim];
        if (!cell) return "·";
        const mark = cell.executed ? "✓" : "·";
        return cell.findings > 0 ? `${mark} ${cell.findings}` : mark;
      },
    })),
  ];

  const findingColumns: readonly DataTableColumn<Finding>[] = [
    {
      key: "domain",
      header: "Domain",
      sortable: true,
      sortValue: (f) => f.domain,
      render: (f) => f.domain,
    },
    {
      key: "dimension",
      header: "Dim",
      sortable: true,
      sortValue: (f) => f.dimension,
      render: (f) => f.dimension,
    },
    {
      key: "subject",
      header: "Subject",
      render: (f) => f.subject,
    },
    {
      key: "title",
      header: "Finding",
      render: (f) => f.title,
    },
    {
      key: "severity",
      header: "Severity",
      sortable: true,
      sortValue: (f) => f.severity,
      render: (f) => (
        <StatusChip tone={SEVERITY_TONE[f.severity]} label={f.severity} dot />
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      sortValue: (f) => f.status,
      render: (f) => (
        <StatusChip tone={STATUS_TONE[f.status]} label={f.status} />
      ),
    },
  ];

  const controls: Partial<DataTableProps<Finding>> = {};
  if (loading !== undefined) controls.loading = loading;
  if (onFilterChange) {
    controls.filterable = true;
    controls.filter = filter ?? "";
    controls.onFilterChange = onFilterChange;
    controls.filterPlaceholder = "Filter findings…";
    controls.searchText = (f) => `${f.domain} ${f.subject} ${f.title}`;
  }

  return (
    <div className={className}>
      <Section eyebrow="Audit harness" title="Coverage & findings">
        <div style={STACK}>
          <div style={ROW}>
            <MetricStat label="Findings" value={findings.length} />
            <MetricStat
              label="Open"
              value={open}
              tone={open > 0 ? "warning" : "positive"}
            />
            <MetricStat
              label="High severity"
              value={high}
              tone={high > 0 ? "critical" : "positive"}
            />
          </div>
          {coverage ? (
            <DataTable
              columns={matrixColumns}
              rows={matrix}
              rowKey={(r) => r.domain}
              dense
              empty={
                <EmptyState
                  title="No coverage recorded"
                  description="The domain × dimension matrix fills in as the harness runs."
                />
              }
            />
          ) : null}
          <DataTable
            columns={findingColumns}
            rows={findings}
            rowKey={(f) => f.id}
            dense
            empty={
              <EmptyState
                title="No findings"
                description="A clean ledger — no open or historical findings to show."
              />
            }
            {...controls}
          />
        </div>
      </Section>
    </div>
  );
}
