import type { ReactNode } from "react";

import {
  readAffiliateReport,
  type AffiliateReport,
  type AffiliateReportEntry,
  type AffiliateReportOrder,
} from "@caisson/service-license";

import { adminDbConfigured, readAdmin } from "@/lib/admin-db";

// ADR-0315/0320 — the affiliate commission report. Read-only, cross-tenant through the same
// read-only `admin` role every business-admin view uses (ADR-0141): it joins every tenant's
// attributed `order_record` (discount_id set) to its `affiliate_code`, groups per affiliate, and
// computes payable commission + a refund clawback ALERT (never moves money — ADR-0294/0302 posture).
// Integer-cent math throughout (ADR-0007); the store computes commission at each row's STAMPED
// commission_bps so a future rate change never rewrites history.
export const dynamic = "force-dynamic";

const EMPTY_REPORT: AffiliateReport = { affiliates: [], unattributed: [] };

/**
 * Read the report through the ADR-0141 admin role. A load failure (the expected case is a
 * permission-denied on `order_record` until it is added to admin-db.ts's `ADMIN_READ_TABLES` — its
 * cross-tenant admin SELECT policy is a DEPLOY-provisioning concern; a not-provisioned
 * `affiliate_code` degrades the same way) degrades to EMPTY rather than 500ing the cockpit, but the
 * caller carries `ok: false` — a money surface must never render a failed read identically to a
 * genuinely-empty report (same honesty rule as /support and /intel).
 */
async function loadReport(): Promise<{ report: AffiliateReport; ok: boolean }> {
  try {
    return { report: await readAdmin(readAffiliateReport), ok: true };
  } catch {
    return { report: EMPTY_REPORT, ok: false };
  }
}

/** Minor units → a $ string. Amounts are already integer cents (ADR-0007); never a float upstream. */
function usd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function fmtDate(iso: string): string {
  return iso.replace("T", " ").slice(0, 19);
}

export default async function AffiliatesPage() {
  const configured = adminDbConfigured();
  const { report, ok } = configured
    ? await loadReport()
    : { report: EMPTY_REPORT, ok: true };

  const totalCommission = report.affiliates.reduce(
    (n, a) => n + a.commissionCents,
    0,
  );
  const totalClawback = report.affiliates.reduce(
    (n, a) => n + a.clawbackCents,
    0,
  );

  return (
    <div className="shell stack" style={{ gap: "var(--cs-space-10)" }}>
      <section>
        <p className="eyebrow">caisson · admin / business</p>
        <h1 className="page-title">Affiliate commissions</h1>
        <p className="lede">
          Every attributed order (a redeemed affiliate code, joined by{" "}
          <span className="mono">discount_id</span>), the commission payable at
          each code&rsquo;s stamped rate, and refund clawback alerts. Read-only:
          the report flags a clawback, it never moves money (ADR-0294/0302).
        </p>
      </section>

      {!configured ? (
        <div className="panel">
          <p className="section-title">Not configured</p>
          <p className="muted">
            Set <span className="mono">CAISSON_ADMIN_DB_URL</span> to read live
            commissions.
          </p>
        </div>
      ) : null}

      {configured && !ok ? (
        <div className="panel">
          <p className="section-title">Could not load</p>
          <p className="muted">
            The affiliate report could not be read right now — a database error,
            not zero attributed orders. Reload to retry.
          </p>
        </div>
      ) : null}

      <p className="muted" style={{ fontSize: "0.82em", maxWidth: "80ch" }}>
        Orders placed before the affiliate-attribution column shipped
        (2026-07-10) carry no <span className="mono">discount_id</span> and are
        not attributed here. This report covers attributed orders only.
        Commission is <strong>{usd(totalCommission)}</strong> payable across all
        affiliates; <strong>{usd(totalClawback)}</strong> is a refund clawback
        alert to net manually against a prior payout.
      </p>

      <Section title={`Affiliates (${report.affiliates.length})`}>
        <Table
          head={[
            "Code",
            "Affiliate",
            "Rate",
            "Orders",
            "Gross (paid)",
            "Commission",
            "Clawback alert",
          ]}
          empty="No attributed orders yet."
          rows={report.affiliates.map((a: AffiliateReportEntry) => [
            a.code,
            a.affiliateName,
            `${(a.commissionBps / 100).toFixed(0)}%`,
            String(a.orders.length),
            usd(a.grossCents),
            usd(a.commissionCents),
            a.clawbackCents > 0 ? usd(a.clawbackCents) : "—",
          ])}
          plainColumns={[1]}
        />
      </Section>

      {report.affiliates.map((a) => (
        <Section
          key={a.discountId}
          title={`${a.affiliateName} — orders (${a.orders.length})`}
        >
          <OrdersTable orders={a.orders} />
        </Section>
      ))}

      {report.unattributed.length > 0 ? (
        <Section
          title={`Unattributed discounts (${report.unattributed.length})`}
        >
          <p className="muted" style={{ fontSize: "0.82em" }}>
            Orders that redeemed a discount code matching NO registered
            affiliate (a manually-created Paddle discount, or a code removed
            from the registry) — shown honestly, never silently dropped.
          </p>
          <OrdersTable orders={report.unattributed} />
        </Section>
      ) : null}
    </div>
  );
}

function OrdersTable({ orders }: { orders: AffiliateReportOrder[] }) {
  return (
    <Table
      head={["Order", "Account", "Amount", "Status", "When"]}
      empty="No orders."
      rows={orders.map((o) => [
        o.orderId,
        o.accountId,
        `${usd(o.amountCents)} ${o.currency.toUpperCase()}`,
        // partialRefund (SHIP-audit): still-'paid' but a line grant was revoked (per-line refund /
        // admin revoke) — commission stays in the payable sum; review the order before paying out.
        o.clawback
          ? "refunded (clawback)"
          : o.partialRefund
            ? "paid (partial refund — review)"
            : o.status,
        fmtDate(o.createdAt),
      ])}
    />
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="stack" style={{ gap: "var(--cs-space-3)" }}>
      <h2 className="section-title">{title}</h2>
      <div className="panel stack" style={{ gap: "var(--cs-space-3)" }}>
        {children}
      </div>
    </section>
  );
}

function Table({
  head,
  rows,
  empty,
  plainColumns,
}: {
  head: string[];
  rows: string[][];
  empty: string;
  /** Column indices rendered plain (not mono) — e.g. an affiliate's display name. */
  plainColumns?: number[];
}) {
  if (rows.length === 0) {
    return <p className="muted">{empty}</p>;
  }
  const plain = new Set(plainColumns ?? []);
  return (
    <table className="admin-table">
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j} className={plain.has(j) ? undefined : "mono"}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
