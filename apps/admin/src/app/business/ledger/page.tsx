import type { ReactNode } from "react";

import { Button, EmptyState, MetricStat } from "@caisson/ui/components";
import { expiringSoon, type ExpiringSoon } from "@caisson/credits";
import { adminDbConfigured, readAdmin } from "@/lib/admin-db";
import {
  readAccountCreditTimeline,
  readAccountOrders,
  readAccountSubscriptions,
  type AccountCreditTimeline,
  type OrderTimelineRow,
  type SubscriptionTimelineRow,
} from "@/lib/business-reads";

// W-COMMERCE (ADR-0316) — the per-account money timeline: the raw `credit_event` ledger
// (grant/consume/claw/expiry, reusing @caisson/credits' getLedger/balance/expiringSoon) plus the
// Paddle order/subscription history (order_record/subscription_status, ADR-0293) with refund flags
// (ADR-0302) and the ADR-0315 discount_id column. Reached from /business; drilled into by account id
// (like /business/audit). Read-only through the `admin` role. Every read degrades to an EmptyState or
// a "not granted yet" hint — a missing admin-read policy on order_record/subscription_status/
// grant_consumption (see business-reads.ts's header) must never 500 the cockpit.
export const dynamic = "force-dynamic";

/** Run a read, returning `null` on any throw (a missing admin-read policy raises a permission error) —
 *  the panel then renders a "not granted to the admin read role yet" hint, never a 500. */
async function tryRead<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

function fmtWhen(iso: string): string {
  return iso.replace("T", " ").slice(0, 19);
}

/** order_record.amount is integer MINOR currency units (ADR-0007). Divide by 100 for a display-only
 *  major figure — never for a computation. */
function fmtMoney(minor: number, currency: string): string {
  const major = (minor / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${major} ${currency.toUpperCase()}`;
}

const SIGN: Record<string, string> = {
  grant: "+",
  consume: "−",
  claw: "−",
  expiry: "−",
};

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string }>;
}) {
  const params = await searchParams;
  const account = params.account?.trim() ?? "";
  const configured = adminDbConfigured();
  const active = configured && account !== "";

  const credits: AccountCreditTimeline | null = active
    ? await tryRead(() =>
        readAdmin((tx) => readAccountCreditTimeline(tx, account)),
      )
    : null;
  const expiring: ExpiringSoon | null = active
    ? await tryRead(() => readAdmin((tx) => expiringSoon(tx, account)))
    : null;
  const orders: OrderTimelineRow[] | null = active
    ? await tryRead(() => readAdmin((tx) => readAccountOrders(tx, account)))
    : null;
  const subs: SubscriptionTimelineRow[] | null = active
    ? await tryRead(() =>
        readAdmin((tx) => readAccountSubscriptions(tx, account)),
      )
    : null;

  return (
    <div className="shell stack" style={{ gap: "var(--cs-space-10)" }}>
      <section>
        <p className="eyebrow">caisson · admin / business</p>
        <h1 className="page-title">Money timeline</h1>
        <p className="lede">
          One account&apos;s credit ledger (grant · consume · claw · expiry) and
          its Paddle order + subscription history, newest first. Read-only,
          through the same <span className="mono">admin</span> role as every
          other business-admin view.
        </p>
      </section>

      {!configured ? (
        <div className="panel">
          <p className="section-title">Not configured</p>
          <p className="muted">
            Set <span className="mono">CAISSON_ADMIN_DB_URL</span> to read a
            live money timeline.
          </p>
        </div>
      ) : null}

      <form method="GET" className="row" style={{ gap: "var(--cs-space-2)" }}>
        <input
          type="text"
          name="account"
          defaultValue={account}
          placeholder="Account id"
          className="mono text-input"
          style={{ minWidth: 320 }}
        />
        <Button type="submit" variant="primary" size="sm">
          Load timeline
        </Button>
      </form>

      {!active ? (
        <p className="muted">
          {configured
            ? "Enter an account id to load its credit ledger and Paddle history."
            : null}
        </p>
      ) : (
        <>
          <section
            className="row"
            style={{ gap: "var(--cs-space-4)", flexWrap: "wrap" }}
          >
            <MetricStat
              label="Wallet balance"
              value={(credits?.balance ?? 0).toLocaleString()}
              hint="credit units"
              icon="wallet"
            />
            <MetricStat
              label="Expiring soon"
              value={
                expiring === null ? "—" : expiring.credits.toLocaleString()
              }
              hint={
                expiring === null
                  ? "grant_consumption not granted"
                  : expiring.soonestExpiresAt === null
                    ? "nothing within 30d"
                    : `soonest ${expiring.soonestExpiresAt.slice(0, 10)}`
              }
              icon="gauge"
              tone={
                expiring !== null && expiring.credits > 0
                  ? "warning"
                  : "default"
              }
            />
          </section>

          <Section title="Credit ledger">
            {credits === null ? (
              <UnavailableHint tables="credit_event / credit_wallet" />
            ) : credits.rows.length === 0 ? (
              <EmptyState
                icon="inbox"
                title="No credit events yet"
                description="This account has no credit ledger entries. Purchases, grants, and spends will populate this timeline."
              />
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Kind</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {credits.rows.map((r, i) => (
                    <tr key={i}>
                      <td className="mono">{fmtWhen(r.createdAt)}</td>
                      <td>{r.kind}</td>
                      <td className="mono">
                        {r.eventType}
                        {r.feature !== null ? ` · ${r.feature}` : ""}
                      </td>
                      <td className="mono">
                        {SIGN[r.kind] ?? ""}
                        {Math.abs(r.amount).toLocaleString()}
                      </td>
                      <td className="mono">{r.sourceEventId ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          <Section title="Paddle orders">
            {orders === null ? (
              <UnavailableHint tables="order_record" />
            ) : orders.length === 0 ? (
              <EmptyState
                icon="inbox"
                title="No orders yet"
                description="No Paddle order/invoice rows for this account. Purchases and subscription invoices land here at webhook time."
              />
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Kind</th>
                    <th>Label</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Discount</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={`${o.sourceEventId}-${o.kind}`}>
                      <td className="mono">{fmtWhen(o.createdAt)}</td>
                      <td>{o.kind}</td>
                      <td>{o.label}</td>
                      <td className="mono">{fmtMoney(o.amount, o.currency)}</td>
                      <td className="mono">
                        {o.status === "refunded" ? "⚑ refunded" : o.status}
                      </td>
                      <td className="mono">{o.discountId ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          <Section title="Subscriptions">
            {subs === null ? (
              <UnavailableHint tables="subscription_status" />
            ) : subs.length === 0 ? (
              <EmptyState
                icon="inbox"
                title="No subscriptions"
                description="No subscription-lifecycle rows for this account."
              />
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Subscription</th>
                    <th>Plan</th>
                    <th>Price</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {subs.map((s) => (
                    <tr key={s.subscriptionId}>
                      <td className="mono">{fmtWhen(s.updatedAt)}</td>
                      <td className="mono">{s.subscriptionId}</td>
                      <td>{s.planTag}</td>
                      <td className="mono">{s.priceId}</td>
                      <td>{s.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          <p className="muted" style={{ fontSize: "0.85em" }}>
            Chargebacks are alert-only (ADR-0294) — surfaced through alerting,
            not tracked as a row here. A refund shows as an{" "}
            <span className="mono">⚑ refunded</span> order plus a{" "}
            <span className="mono">claw</span> ledger entry (ADR-0302).
          </p>
        </>
      )}
    </div>
  );
}

function UnavailableHint({ tables }: { tables: string }) {
  return (
    <p className="muted">
      Couldn&apos;t read <span className="mono">{tables}</span> — the read-only{" "}
      <span className="mono">admin</span> role may not be granted it yet. Add it
      to <span className="mono">ADMIN_READ_TABLES</span> (admin-db.ts) and
      provision the policy on the Railway PG (ADR-0141), or reload if this was
      transient.
    </p>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="stack" style={{ gap: "var(--cs-space-3)" }}>
      <h2 className="section-title">{title}</h2>
      <div className="panel">{children}</div>
    </section>
  );
}
