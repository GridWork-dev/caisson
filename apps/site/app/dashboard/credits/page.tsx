// Credits + ledger (ADR-0114 scope item 6b). Balance via `MetricStat` + `MoneyCell` (credits
// unit), the full append-only ledger via `LedgerList` (ADR-0007 integer units throughout).
import type { Metadata } from "next";
import {
  type LedgerEntry,
  MetricStat,
  LedgerList,
  MoneyCell,
} from "@caisson/ui/components";
import { readScoped } from "@/lib/db";
import { requireDashboardSession } from "@/lib/auth";
import { readCreditsSummary } from "@/lib/dashboard-reads";

export const metadata: Metadata = { title: "Credits" };

export default async function DashboardCreditsPage() {
  const session = await requireDashboardSession("/dashboard/credits");
  const { balance, ledger, expiring } = await readScoped(
    session.accountId,
    (tx) => readCreditsSummary(tx, session.accountId),
  );

  // Reconstruct each entry's running balance from the append-only ledger (oldest-first, as
  // `getLedger` returns it) — `LedgerEntry.balance` is "the total AFTER this entry", so a forward
  // scan accumulates it; the kit then renders newest-first.
  let running = 0;
  const entries: LedgerEntry[] = ledger.map((row) => {
    running += row.amount;
    return {
      id: row.id,
      timestamp: row.created_at,
      reason: row.feature
        ? `${row.event_type} (${row.feature})`
        : row.event_type,
      delta: row.amount,
      balance: running,
    };
  });
  entries.reverse(); // newest first for display

  return (
    <div style={{ display: "grid", gap: "var(--cs-space-8)" }}>
      <div>
        <h1
          className="cs-card-title"
          style={{ fontSize: "var(--cs-text-2xl)" }}
        >
          Credits
        </h1>
        <p className="cs-muted" style={{ marginTop: "var(--cs-space-2)" }}>
          Your codegen / AI-feature credit balance and transaction history.
        </p>
      </div>

      <MetricStat
        label="Current balance"
        value={<MoneyCell value={balance} unit="credits" />}
        icon="wallet"
        tone={balance > 0 ? "positive" : "default"}
      />

      {expiring.credits > 0 && expiring.soonestExpiresAt !== null ? (
        // Expiring-soon badge (ADR-0245/0252 Decision 6a): unexpired remaining credits whose
        // grant expires within 30 days. FIFO means they burn first automatically — the copy says
        // so instead of alarming.
        <MetricStat
          label="Expiring within 30 days"
          value={<MoneyCell value={expiring.credits} unit="credits" />}
          icon="alert"
          tone="warning"
          hint={`Expire ${expiring.soonestExpiresAt.slice(0, 10)} — they burn first automatically; top up or use them.`}
        />
      ) : null}

      <div>
        <h2
          className="cs-card-title"
          style={{
            fontSize: "var(--cs-text-lg)",
            marginBottom: "var(--cs-space-4)",
          }}
        >
          Ledger
        </h2>
        <LedgerList entries={entries} unit="credits" />
      </div>
    </div>
  );
}
