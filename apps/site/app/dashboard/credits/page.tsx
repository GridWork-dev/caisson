// Credits + ledger (ADR-0114 scope item 6b). Balance via `MetricStat` + `MoneyCell` (credits
// unit), the full append-only ledger via `LedgerList` (ADR-0007 integer units throughout).
import type { Metadata } from "next";
import { PURCHASE_BOOK } from "@caisson/pricebook";
import {
  type LedgerEntry,
  MetricStat,
  LedgerList,
  MoneyCell,
} from "@caisson/ui/components";
import { readScoped } from "@/lib/db";
import { requireDashboardSession } from "@/lib/auth";
import { readCreditsSummary } from "@/lib/dashboard-reads";
import { PlanPurchaseRow } from "@/components/plan-purchase-row";

export const metadata: Metadata = { title: "Credits" };

/**
 * The $49/5,000-credit one-off top-up's live Paddle price id (G9 — previously no buyer-facing
 * purchase entry anywhere, despite the row existing purely for the webhook to resolve a direct
 * purchase). Looked up by `purchaseTag` rather than hardcoded so a future price-id rotation in
 * `@caisson/pricebook` doesn't silently desync this page. `undefined` only if the pricebook ever
 * drops the row entirely — the CTA just doesn't render rather than pointing at a dead id.
 */
const CREDIT_PACK_PRICE_ID = Object.entries(PURCHASE_BOOK).find(
  ([id, entry]) =>
    entry.purchaseTag === "credit_pack" && !id.includes("PLACEHOLDER"),
)?.[0];

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

      {CREDIT_PACK_PRICE_ID !== undefined && (
        // G9: the $49/5,000-credit top-up previously had no buyer-facing purchase entry anywhere
        // — self-serve, wired through the same single-item Paddle checkout the plan page uses.
        <PlanPurchaseRow
          priceId={CREDIT_PACK_PRICE_ID}
          accountId={session.accountId}
          label="5,000 credits — $49"
          owned={false}
        />
      )}

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
