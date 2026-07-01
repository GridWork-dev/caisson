// Activity / Generations (ADR-0114 scope item 6e — usage history). Prefers `@caisson/ai-meter`'s
// `usage_event` (metered AI calls — model, tokens, credits) when the table is provisioned in this
// environment; falls back to the credit-ledger DEBIT events (`DEBIT_EVENT_TYPES`) when it is not,
// so the view still shows real spend history rather than an empty table on an environment with no
// metering migration applied. `DataTable` owns the loading/empty states; this is a Server
// Component, so "loading" never applies here (the data is ready before render) — only `empty`.
import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  type DataTableColumn,
  DataTable,
  EmptyState,
  MoneyCell,
} from "@caisson/ui/components";
import { readScoped } from "@/lib/db";
import { requireDashboardSession } from "@/lib/auth";
import {
  readCreditsSummary,
  readUsageEvents,
  type UsageEventRow,
} from "@/lib/dashboard-reads";

export const metadata: Metadata = { title: "Activity" };

interface DebitRow {
  id: string;
  eventType: string;
  feature: string | null;
  amount: number;
}

const METERED_COLUMNS: readonly DataTableColumn<UsageEventRow>[] = [
  {
    key: "createdAt",
    header: "When",
    render: (r) => new Date(r.createdAt).toLocaleString("en-US"),
  },
  { key: "model", header: "Model", render: (r) => `${r.provider}/${r.model}` },
  { key: "lane", header: "Lane", render: (r) => r.lane },
  {
    key: "tokens",
    header: "Tokens",
    numeric: true,
    render: (r) =>
      `${r.inputTokens.toLocaleString("en-US")} in / ${r.outputTokens.toLocaleString("en-US")} out`,
  },
  {
    key: "credits",
    header: "Credits",
    numeric: true,
    render: (r) => <MoneyCell value={-r.credits} unit="credits" signTone />,
  },
];

const DEBIT_COLUMNS: readonly DataTableColumn<DebitRow>[] = [
  { key: "eventType", header: "Event", render: (r) => r.eventType },
  { key: "feature", header: "Feature", render: (r) => r.feature ?? "—" },
  {
    key: "amount",
    header: "Credits",
    numeric: true,
    render: (r) => <MoneyCell value={r.amount} unit="credits" sign signTone />,
  },
];

export default async function DashboardActivityPage() {
  const session = await requireDashboardSession("/dashboard/activity");

  const metered = await readScoped(session.accountId, (tx) =>
    readUsageEvents(tx, session.accountId),
  );

  if (metered !== null) {
    return (
      <ActivityShell>
        {metered.length === 0 ? (
          <EmptyState
            icon="gauge"
            title="No metered activity yet"
            description="Metered AI calls will show up here once you start using a metered feature."
          />
        ) : (
          <DataTable
            columns={METERED_COLUMNS}
            rows={metered}
            rowKey={(r) => r.id}
          />
        )}
      </ActivityShell>
    );
  }

  // Fallback: no `usage_event` table in this environment — build activity from the credit
  // ledger's DEBIT entries instead (real spend, just without the per-call model/token detail).
  const { ledger } = await readScoped(session.accountId, (tx) =>
    readCreditsSummary(tx, session.accountId),
  );
  const debits: DebitRow[] = ledger
    .filter((e) => e.amount < 0)
    .map((e) => ({
      id: e.id,
      eventType: e.event_type,
      feature: e.feature,
      amount: e.amount,
    }))
    .reverse();

  return (
    <ActivityShell>
      {debits.length === 0 ? (
        <EmptyState
          icon="gauge"
          title="No activity yet"
          description="Credit-debiting activity will show up here once you start using a metered feature."
        />
      ) : (
        <DataTable columns={DEBIT_COLUMNS} rows={debits} rowKey={(r) => r.id} />
      )}
    </ActivityShell>
  );
}

function ActivityShell({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "grid", gap: "var(--cs-space-8)" }}>
      <div>
        <h1
          className="cs-card-title"
          style={{ fontSize: "var(--cs-text-2xl)" }}
        >
          Activity
        </h1>
        <p className="cs-muted" style={{ marginTop: "var(--cs-space-2)" }}>
          Recent metered usage and credit-debiting activity on your account.
        </p>
      </div>
      {children}
    </div>
  );
}
