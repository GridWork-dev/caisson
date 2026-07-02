import type { ReactNode } from "react";

import {
  readAdminActionLog,
  type AdminActionLogRow,
} from "@caisson/service-license";
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
import { AdminMutations } from "./mutations";

// Business admin (ADR-0141 read cockpit + ADR-0220 mutation surface): a cross-tenant view over the
// Railway PG. Reads run through `readAdmin` (the read-only `admin` role); the four operator mutations
// (grant · revoke · adjust · reissue) run through the CF-Access-gated `/api/admin/*` routes as the
// separate `admin_write` role, each dual-logged (WORM + the `admin_action_log` browsed below). When
// `CAISSON_ADMIN_DB_URL` is unset the view renders a clean "not configured" state.
export const dynamic = "force-dynamic";

const EMPTY = {
  tenants: [] as TenantRow[],
  entitlements: [] as EntitlementRow[],
  credits: [] as CreditRow[],
  licenses: [] as LicenseRow[],
  actions: [] as AdminActionLogRow[],
};

type LoadedData = typeof EMPTY & { actionLogMissing: boolean };

async function loadData(): Promise<LoadedData> {
  if (!adminDbConfigured()) return { ...EMPTY, actionLogMissing: false };
  const [tenants, entitlements, credits, licenses] = await Promise.all([
    readAdmin(readTenants),
    readAdmin(readEntitlements),
    readAdmin(readCredits),
    readAdmin(readLicenses),
  ]);
  // The `admin_action_log` table ships in the ADR-0220 DEPLOY DDL. A routine fleet redeploy from
  // main BEFORE that DDL runs must not crash the whole read cockpit — degrade THIS read alone to an
  // empty log plus a provisioning hint. The other reads predate 0220, so they are not guarded here.
  let actions: AdminActionLogRow[] = [];
  let actionLogMissing = false;
  try {
    actions = await readAdmin((tx) => readAdminActionLog(tx, 50));
  } catch {
    actionLogMissing = true;
  }
  return {
    tenants,
    entitlements,
    credits,
    licenses,
    actions,
    actionLogMissing,
  };
}

function fmtDate(iso: string | null): string {
  if (iso === null) return "—";
  return iso.slice(0, 10);
}

export default async function BusinessPage() {
  const configured = adminDbConfigured();
  const {
    tenants,
    entitlements,
    credits,
    licenses,
    actions,
    actionLogMissing,
  } = await loadData();

  return (
    <div className="shell stack" style={{ gap: "var(--cs-space-10)" }}>
      <section>
        <p className="eyebrow">caisson · admin</p>
        <h1 className="page-title">Business admin</h1>
        <p className="lede">
          A cross-tenant view of tenants, purchases, entitlements, and credits
          over the Railway Postgres. Reads run as the read-only{" "}
          <span className="mono">admin</span> role (ADR-0141); the four operator
          mutations run as the separate{" "}
          <span className="mono">admin_write</span> role, dual-logged
          (ADR-0220).
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

      <section className="stack" style={{ gap: "var(--cs-space-3)" }}>
        <h2 className="section-title">Operator mutations (ADR-0220)</h2>
        <p className="muted" style={{ fontSize: "0.85em" }}>
          Each action is CF-Access-gated, bounded to one target account,
          dual-logged (WORM + the action log below), and behind a
          type-to-confirm gate. No raw SQL against production.
        </p>
        <AdminMutations />
      </section>

      <Section title={`Action log (${actions.length})`}>
        {actionLogMissing ? (
          <p className="muted">
            The <span className="mono">admin_action_log</span> table is not
            provisioned yet — run the ADR-0220 DEPLOY DDL (the action-log schema
            plus <span className="mono">ADMIN_MUTATION_PROVISION_SQL</span>).
            Operator actions are still recorded in the per-tenant WORM chain.
          </p>
        ) : (
          <Table
            head={["When", "Actor", "Action", "Account"]}
            empty={configured ? "No operator actions yet." : "—"}
            rows={actions.map((a) => [
              a.createdAt.replace("T", " ").slice(0, 19),
              a.actorEmail,
              a.action,
              a.targetAccountId,
            ])}
          />
        )}
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
