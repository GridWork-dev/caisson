"use client";

// Live @caisson/ui-pro demo for the ui-pro module pop-out's media slot — two real premium components
// (the advanced data grid + the hash-chain audit timeline) driven by small sample data, so the buyer
// sees the actual product, not a placeholder. Loaded via next/dynamic (ssr: false) from
// module-preview-dialog.tsx so this commercial-tier tree never lands in the shared client bundle.
// Default export = the shape next/dynamic imports.

import {
  AuditTimeline,
  type AuditEntry,
  DataTablePro,
  type DataTableProColumn,
} from "@caisson/ui-pro/components";

interface UsageRow {
  tenant: string;
  calls: number;
  spend: number;
}

const COLUMNS: readonly DataTableProColumn<UsageRow>[] = [
  {
    key: "tenant",
    header: "Tenant",
    render: (r) => r.tenant,
    sortable: true,
    filterable: true,
  },
  {
    key: "calls",
    header: "Calls",
    numeric: true,
    render: (r) => r.calls.toLocaleString("en-US"),
    value: (r) => r.calls,
    sortable: true,
  },
  {
    key: "spend",
    header: "Spend",
    numeric: true,
    render: (r) => `$${r.spend}`,
    value: (r) => r.spend,
    sortable: true,
  },
];

const ROWS: readonly UsageRow[] = [
  { tenant: "acme-co", calls: 18240, spend: 214 },
  { tenant: "globex", calls: 9310, spend: 88 },
  { tenant: "initech", calls: 33110, spend: 402 },
  { tenant: "umbrella", calls: 5120, spend: 61 },
];

const AUDIT: readonly AuditEntry[] = [
  {
    id: "1",
    timestamp: "2026-07-07 09:14",
    action: "License issued",
    actor: "system",
    hash: "a1b2c3",
  },
  {
    id: "2",
    timestamp: "2026-07-07 10:02",
    action: "Entitlement granted",
    actor: "admin",
    hash: "d4e5f6",
    prevHash: "a1b2c3",
  },
  {
    id: "3",
    timestamp: "2026-07-07 11:20",
    action: "Registry pull",
    actor: "acme-co",
    hash: "97a0bb",
    prevHash: "d4e5f6",
  },
];

export default function UiProDemo() {
  return (
    <div style={{ display: "grid", gap: "var(--cs-space-4)" }}>
      <DataTablePro
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(r) => r.tenant}
        dense
        viewportHeight={180}
        exportFileName="usage.csv"
      />
      <AuditTimeline
        entries={AUDIT}
        verifyLinks
        ariaLabel="Sample hash-chained audit timeline"
      />
    </div>
  );
}
