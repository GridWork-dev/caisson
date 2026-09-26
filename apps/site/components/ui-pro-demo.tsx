"use client";

// The ui-pro module's `component` media slide (ADR-0290) — two real premium @caisson-sh/ui-pro
// components (the advanced data grid + the hash-chain audit timeline) rendered live with static
// sample data, so the buyer sees the actual product, not a placeholder. No sort/filter/export props
// are wired: a slide never pulls interactive state, it's a still frame of a real component. Loaded
// via next/dynamic (ssr: false) from the media carousel so this commercial-tier tree never lands in
// the shared client bundle. Default export = the shape next/dynamic imports.

import {
  AuditTimeline,
  type AuditEntry,
  DataTablePro,
  type DataTableProColumn,
} from "@caisson-sh/ui-pro/components";

import { MediaFrame } from "./media-frame";

interface UsageRow {
  tenant: string;
  calls: number;
  spend: number;
}

const COLUMNS: readonly DataTableProColumn<UsageRow>[] = [
  { key: "tenant", header: "Tenant", render: (r) => r.tenant },
  {
    key: "calls",
    header: "Calls",
    numeric: true,
    render: (r) => r.calls.toLocaleString("en-US"),
  },
  {
    key: "spend",
    header: "Spend",
    numeric: true,
    render: (r) => `$${r.spend}`,
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
    <MediaFrame label="ui-pro · live components">
      <div
        style={{
          display: "grid",
          gap: "var(--cs-space-4)",
          padding: "var(--cs-space-6)",
        }}
      >
        <DataTablePro
          columns={COLUMNS}
          rows={ROWS}
          rowKey={(r) => r.tenant}
          dense
          viewportHeight={180}
        />
        <AuditTimeline
          entries={AUDIT}
          verifyLinks
          ariaLabel="Sample hash-chained audit timeline"
        />
      </div>
    </MediaFrame>
  );
}
