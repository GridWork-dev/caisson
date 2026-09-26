"use client";

// The credits module's `component` media slide (ADR-0308 full-depth) — the real buyer-dashboard
// credits surface: `@caisson-sh/ui` <MetricStat>/<MoneyCell> balance tile + the append-only <LedgerList>
// (integer credit units, ADR-0007). credits ships no /ui component of its own; this mirrors exactly
// what the buyer's dashboard renders — source: apps/site/app/dashboard/credits/page.tsx. A
// still-frame with static, internally-consistent ledger data. Loaded via next/dynamic (ssr: false)
// from the media carousel, consistent with the other component slides.
import {
  type LedgerEntry,
  LedgerList,
  MetricStat,
  MoneyCell,
} from "@caisson-sh/ui/components";

import { MediaFrame } from "./media-frame";

// Newest-first, as <LedgerList> renders it; balance is the running total AFTER each entry, so the
// sequence is internally consistent: +5000 grant, then two metered spends.
const ENTRIES: readonly LedgerEntry[] = [
  {
    id: "le_3",
    timestamp: "2026-07-07T11:20:00Z",
    reason: "inference (gpt-5)",
    delta: -402,
    balance: 4502,
  },
  {
    id: "le_2",
    timestamp: "2026-07-06T16:02:00Z",
    reason: "inference (claude-opus-4)",
    delta: -96,
    balance: 4904,
  },
  {
    id: "le_1",
    timestamp: "2026-07-05T09:14:00Z",
    reason: "credit_pack purchase",
    delta: 5000,
    balance: 5000,
  },
];

export default function CreditsDemo() {
  return (
    <MediaFrame label="Credit ledger">
      <div
        style={{
          display: "grid",
          gap: "var(--cs-space-4)",
          padding: "var(--cs-space-6)",
        }}
      >
        <MetricStat
          label="Credit balance"
          value={<MoneyCell value={4502} unit="credits" />}
        />
        <LedgerList entries={ENTRIES} unit="credits" />
      </div>
    </MediaFrame>
  );
}
