import type { ReactNode } from "react";

import { adminDbConfigured, readAdmin } from "@/lib/admin-db";
import {
  readCredits,
  readEntitlements,
  readLicenses,
  readTenants,
  type CreditRow,
  type EntitlementRow,
  type LicenseRow,
  type TenantRow,
} from "@/lib/business-reads";

// Business admin (ADR-0141): a READ-ONLY cross-tenant cockpit over the Railway PG. Reads run through
// `readAdmin` (the read-only `admin` role); there are no mutations (deferred to a later ADR). When
// `CAISSON_ADMIN_DB_URL` is unset the view renders a clean "not configured" state — the DB + the
// `admin` role are provisioned at DEPLOY, never here.
export const dynamic = "force-dynamic";

const EMPTY = {
  tenants: [] as TenantRow[],
  entitlements: [] as EntitlementRow[],
  credits: [] as CreditRow[],
  licenses: [] as LicenseRow[],
};

async function loadData(): Promise<typeof EMPTY> {
  if (!adminDbConfigured()) return EMPTY;
  const [tenants, entitlements, credits, licenses] = await Promise.all([
    readAdmin(readTenants),
    readAdmin(readEntitlements),
    readAdmin(readCredits),
    readAdmin(readLicenses),
  ]);
  return { tenants, entitlements, credits, licenses };
}

function fmtDate(iso: string | null): string {
  if (iso === null) return "—";
  return iso.slice(0, 10);
}

export default async function BusinessPage() {
  const configured = adminDbConfigured();
  const { tenants, entitlements, credits, licenses } = await loadData();

  return (
    <div className="shell stack" style={{ gap: "var(--cs-space-10)" }}>
      <section>
        <p className="eyebrow">caisson · admin</p>
        <h1 className="page-title">Business admin</h1>
        <p className="lede">
          A read-only cross-tenant view of tenants, purchases, entitlements, and
          credits over the Railway Postgres. Reads run as the dedicated
          read-only <span className="mono">admin</span> role (ADR-0141);
          mutation is a later decision.
        </p>
      </section>

      {!configured ? (
        <div className="panel">
          <p className="section-title">Not configured</p>
          <p className="muted">
            Set <span className="mono">CAISSON_ADMIN_DB_URL</span> (the
            read-only <span className="mono">admin</span> role DSN) to read live
            tenant state. The database, the role, and its policies are
            provisioned on the Railway Postgres at deploy (ADR-0141).
          </p>
        </div>
      ) : null}

      <Section title={`Tenants (${tenants.length})`}>
        <Table
          head={["Account", "Credits", "Entitlements", "Licenses"]}
          empty={configured ? "No tenants yet." : "—"}
          rows={tenants.map((t) => [
            t.accountId,
            String(t.creditBalance),
            String(t.entitlementCount),
            String(t.licenseCount),
          ])}
        />
      </Section>

      <Section title={`Entitlements & purchases (${entitlements.length})`}>
        <Table
          head={["Account", "Entitlement", "Source", "Status", "Granted"]}
          empty={configured ? "No entitlement grants yet." : "—"}
          rows={entitlements.map((e) => [
            e.accountId,
            e.entitlementId,
            e.sourceKind,
            e.status,
            fmtDate(e.grantedAt),
          ])}
        />
      </Section>

      <Section title={`Credits (${credits.length})`}>
        <Table
          head={["Account", "Balance"]}
          empty={configured ? "No credit wallets yet." : "—"}
          rows={credits.map((c) => [c.accountId, String(c.balance)])}
        />
      </Section>

      <Section title={`Licenses (${licenses.length})`}>
        <Table
          head={["Account", "Major", "Tier", "Expiry", "Issued"]}
          empty={configured ? "No license grants yet." : "—"}
          rows={licenses.map((l) => [
            l.accountId,
            String(l.major),
            l.tier,
            fmtDate(l.expiry),
            fmtDate(l.issuedAt),
          ])}
        />
      </Section>
    </div>
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

function Table({
  head,
  rows,
  empty,
}: {
  head: string[];
  rows: string[][];
  empty: string;
}) {
  if (rows.length === 0) {
    return <p className="muted">{empty}</p>;
  }
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
              <td key={j} className={j === 0 ? "mono" : undefined}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
