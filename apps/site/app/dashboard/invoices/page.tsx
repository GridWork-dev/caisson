// Invoices / order history (G26, ADR-0293): a plain list of every recorded transaction — no PDF
// generation, no pagination (v1). Fed entirely from `order_record`, the append-only ledger the
// license webhook writes alongside the existing credit/entitlement grants
// (services/license/src/subscription-history-store.ts). Paddle (the merchant of record) sends its
// own receipt email independently — this view is the in-app mirror a buyer can check any time.
import type { Metadata } from "next";
import {
  Card,
  EmptyState,
  MoneyCell,
  StatusPill,
  formatLedgerTimestamp,
} from "@caisson/ui/components";
import { readScoped } from "@/lib/db";
import { requireDashboardSession } from "@/lib/auth";
import { readOrderRecords } from "@/lib/dashboard-reads";

export const metadata: Metadata = { title: "Invoices" };

export default async function DashboardInvoicesPage() {
  const session = await requireDashboardSession("/dashboard/invoices");
  const orders = await readScoped(session.accountId, (tx) =>
    readOrderRecords(tx, session.accountId),
  );

  return (
    <div style={{ display: "grid", gap: "var(--cs-space-8)" }}>
      <div>
        <h1
          className="cs-card-title"
          style={{ fontSize: "var(--cs-text-2xl)" }}
        >
          Invoices
        </h1>
        <p className="cs-muted" style={{ marginTop: "var(--cs-space-2)" }}>
          Every purchase and subscription invoice on this account.
        </p>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon="file-check"
          title="No invoices yet"
          description="Purchases and subscription invoices will appear here once you buy something."
        />
      ) : (
        <div style={{ display: "grid", gap: "var(--cs-space-3)" }}>
          {orders.map((order) => (
            <Card key={`${order.sourceEventId}:${order.kind}`}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "var(--cs-space-4)",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "grid", gap: "var(--cs-space-1)" }}>
                  <span
                    className="cs-card-title"
                    style={{ textTransform: "capitalize" }}
                  >
                    {order.label.replace(/[-_]/g, " ")}
                  </span>
                  <span
                    className="cs-muted"
                    style={{ fontSize: "var(--cs-text-xs)" }}
                  >
                    {formatLedgerTimestamp(order.createdAt)} ·{" "}
                    {order.kind === "subscription"
                      ? "Subscription invoice"
                      : "One-time purchase"}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--cs-space-4)",
                  }}
                >
                  <MoneyCell value={order.amount} unit="usd-cents" />
                  <StatusPill
                    status={order.status === "paid" ? "active" : "revoked"}
                  >
                    {order.status === "paid" ? "Paid" : "Refunded"}
                  </StatusPill>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
