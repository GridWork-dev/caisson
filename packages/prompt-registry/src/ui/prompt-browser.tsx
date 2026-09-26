// @caisson-sh/prompt-registry/ui — the prompt browser (ADR-0250 G2c/G2d). A headless-data-in
// surface: it renders the `PromptVersion` rows the host resolved via `listVersions`/`getVersion` (no
// tenant executor, no DB). Composes the `@caisson-sh/ui` floor; presentational + SSR-safe.
import type { CSSProperties } from "react";
import {
  DataTable,
  EmptyState,
  formatLedgerTimestamp,
  MetricStat,
  Section,
  StatusChip,
} from "@caisson-sh/ui/components";
import type {
  DataTableColumn,
  DataTableProps,
} from "@caisson-sh/ui/components";
import type { PromptVersion } from "../registry.ts";

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

/** The first message's content, bounded, as a one-line preview of what the version renders. */
export function firstMessagePreview(version: PromptVersion, max = 80): string {
  const first = version.messages[0];
  if (!first) return "—";
  const content = first.content.replace(/\s+/g, " ").trim();
  return content.length > max ? `${content.slice(0, max - 1)}…` : content;
}

export interface PromptBrowserProps {
  /** The prompt versions to browse (across names). `listVersions` output, or a merged set. */
  versions: readonly PromptVersion[];
  loading?: boolean;
  /** Host-controlled name filter (pair with `onFilterChange`). */
  filter?: string;
  onFilterChange?: (value: string) => void;
  pageSize?: number;
  page?: number;
  onPageChange?: (page: number) => void;
  className?: string;
}

/**
 * PromptBrowser — the append-only prompt catalog: one row per `name@version`, with its role shape,
 * variable count, and a preview. The headline splits distinct prompt names from total versions so
 * the append-only version fan-out is legible.
 */
export function PromptBrowser({
  versions,
  loading,
  filter,
  onFilterChange,
  pageSize,
  page,
  onPageChange,
  className,
}: PromptBrowserProps) {
  const names = new Set(versions.map((v) => v.name));

  const columns: readonly DataTableColumn<PromptVersion>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      sortValue: (v) => v.name,
      render: (v) => <code style={MONO}>{v.name}</code>,
    },
    {
      key: "version",
      header: "Version",
      numeric: true,
      sortable: true,
      sortValue: (v) => v.version,
      render: (v) => `v${v.version}`,
    },
    {
      key: "roles",
      header: "Roles",
      render: (v) => (
        <>
          {[...new Set(v.messages.map((m) => m.role))].map((role) => (
            <StatusChip key={role} tone="muted" label={role} />
          ))}
        </>
      ),
    },
    {
      key: "vars",
      header: "Vars",
      numeric: true,
      sortable: true,
      sortValue: (v) => Object.keys(v.varSpec).length,
      render: (v) => Object.keys(v.varSpec).length,
    },
    {
      key: "created",
      header: "Created",
      sortable: true,
      sortValue: (v) => v.createdAt,
      render: (v) => formatLedgerTimestamp(v.createdAt),
    },
    {
      key: "preview",
      header: "Preview",
      render: (v) => firstMessagePreview(v),
    },
  ];

  const controls: Partial<DataTableProps<PromptVersion>> = {};
  if (loading !== undefined) controls.loading = loading;
  if (onFilterChange) {
    controls.filterable = true;
    controls.filter = filter ?? "";
    controls.onFilterChange = onFilterChange;
    controls.filterPlaceholder = "Filter by name…";
    controls.searchText = (v) => v.name;
  }
  if (pageSize !== undefined) controls.pageSize = pageSize;
  if (page !== undefined) controls.page = page;
  if (onPageChange) controls.onPageChange = onPageChange;

  return (
    <div className={className}>
      <Section eyebrow="Prompts" title="Prompt registry">
        <div style={STACK}>
          <div style={ROW}>
            <MetricStat label="Prompts" value={names.size} />
            <MetricStat label="Versions" value={versions.length} />
          </div>
          <DataTable
            columns={columns}
            rows={versions}
            rowKey={(v) => v.id}
            dense
            empty={
              <EmptyState
                title="No prompts registered"
                description="Registered prompt versions will appear here."
              />
            }
            {...controls}
          />
        </div>
      </Section>
    </div>
  );
}
