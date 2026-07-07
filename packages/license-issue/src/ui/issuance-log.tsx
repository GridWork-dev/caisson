// @caisson/license-issue/ui — the admin-side issuance log (ADR-0250 G2c/G2d wave-1). A
// headless-data-in surface: it renders the issued-license records the admin issuer service HANDS
// it (no signing key, no DB, no fetch — this is the read side, never the issue side). Composes the
// `@caisson/ui` floor; presentational + SSR-safe. `@caisson/license-issue` is private/unpublished —
// this surface ships only with the issuer/admin app.
import type { CSSProperties } from "react";
import type { LicenseClaims } from "@caisson/license-verify";
import {
  DataTable,
  EmptyState,
  formatLedgerTimestamp,
  MetricStat,
  Section,
  StatusChip,
  StatusPill,
} from "@caisson/ui/components";
import type {
  DataTableColumn,
  DataTableProps,
  EntitlementStatus,
} from "@caisson/ui/components";

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

/** One issued-license record: the signed claims plus the issuance instant the log records. */
export type IssuedLicenseRecord = LicenseClaims & { issuedAt?: string };

/** Perpetual (`expiry: null`) reads as active; a dated license flips to `expired` once past. */
export function licenseStatus(
  record: IssuedLicenseRecord,
  now: number = Date.now(),
): EntitlementStatus {
  if (record.expiry === null) return "active";
  const at = Date.parse(record.expiry);
  // Fail CLOSED, mirroring @caisson/license-verify: an unparseable or elapsed expiry reads expired,
  // never active — a malformed date must never present as a live license.
  return !Number.isNaN(at) && at > now ? "active" : "expired";
}

function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

export interface IssuanceLogProps {
  /** The issued-license records, newest first (the issuer service hands them back ordered). */
  records: readonly IssuedLicenseRecord[];
  loading?: boolean;
  /** Host-controlled name/id filter (pair with `onFilterChange`). */
  filter?: string;
  onFilterChange?: (value: string) => void;
  pageSize?: number;
  page?: number;
  onPageChange?: (page: number) => void;
  className?: string;
}

/**
 * IssuanceLog — the issued-license ledger: tier, live/expired status, entitlement count, coverage
 * (major + expiry). The headline stat is the active vs. total split so a revoked/expired tail is
 * visible at a glance.
 */
export function IssuanceLog({
  records,
  loading,
  filter,
  onFilterChange,
  pageSize,
  page,
  onPageChange,
  className,
}: IssuanceLogProps) {
  const active = records.filter((r) => licenseStatus(r) === "active").length;

  const columns: readonly DataTableColumn<IssuedLicenseRecord>[] = [
    {
      key: "issuedAt",
      header: "Issued",
      sortable: true,
      sortValue: (r) => r.issuedAt ?? "",
      render: (r) => (r.issuedAt ? formatLedgerTimestamp(r.issuedAt) : "—"),
    },
    {
      key: "licenseId",
      header: "License",
      render: (r) => (
        <code style={MONO} title={r.licenseId}>
          {shortId(r.licenseId)}
        </code>
      ),
    },
    {
      key: "tier",
      header: "Tier",
      render: (r) => <StatusChip tone="accent" label={r.tier} />,
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusPill status={licenseStatus(r)} />,
    },
    {
      key: "entitlements",
      header: "Entitlements",
      numeric: true,
      sortable: true,
      sortValue: (r) => r.entitlements.length,
      render: (r) => (
        <span title={r.entitlements.join(", ")}>{r.entitlements.length}</span>
      ),
    },
    {
      key: "major",
      header: "Major",
      numeric: true,
      sortable: true,
      sortValue: (r) => r.major,
      render: (r) => `v${r.major}`,
    },
    {
      key: "expiry",
      header: "Expiry",
      render: (r) => (r.expiry ? formatLedgerTimestamp(r.expiry) : "Perpetual"),
    },
  ];

  const controls: Partial<DataTableProps<IssuedLicenseRecord>> = {};
  if (loading !== undefined) controls.loading = loading;
  if (onFilterChange) {
    controls.filterable = true;
    controls.filter = filter ?? "";
    controls.onFilterChange = onFilterChange;
    controls.filterPlaceholder = "Filter by license id or tier…";
    controls.searchText = (r) => `${r.licenseId} ${r.tier}`;
  }
  if (pageSize !== undefined) controls.pageSize = pageSize;
  if (page !== undefined) controls.page = page;
  if (onPageChange) controls.onPageChange = onPageChange;

  return (
    <div className={className}>
      <Section eyebrow="Licensing" title="Issuance log">
        <div style={STACK}>
          <div style={ROW}>
            <MetricStat label="Licenses issued" value={records.length} />
            <MetricStat
              label="Active"
              value={active}
              tone={active === records.length ? "positive" : "default"}
              hint={`${records.length - active} lapsed`}
            />
          </div>
          <DataTable
            columns={columns}
            rows={records}
            rowKey={(r) => r.licenseId}
            dense
            empty={
              <EmptyState
                title="No licenses issued"
                description="Issued licenses will appear here as the issuer signs them."
              />
            }
            {...controls}
          />
        </div>
      </Section>
    </div>
  );
}
