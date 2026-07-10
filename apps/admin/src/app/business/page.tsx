import type { ReactNode } from "react";

import {
  readAdminActionLog,
  type AdminActionLogRow,
} from "@caisson/service-license";
import { adminDbConfigured, readAdmin } from "@/lib/admin-db";
import { grantableEntitlementIds } from "@/lib/admin-mutations-runtime";
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
// Railway PG. Reads run through `readAdmin` (the read-only `admin` role); the operator mutations
// (grant · revoke · adjust · reissue · revoke-purchase · first-mint · resend-email) run through the
// GitHub-OAuth-gated (ADR-0283) `/api/admin/*` routes as the separate `admin_write` role, each
// dual-logged (WORM + the `admin_action_log` browsed below). When `CAISSON_ADMIN_DB_URL` is unset
// the view renders a clean "not configured" state.
export const dynamic = "force-dynamic";

const EMPTY = {
  tenants: { rows: [] as TenantRow[], total: 0 },
  entitlements: [] as EntitlementRow[],
  credits: [] as CreditRow[],
  licenses: [] as LicenseRow[],
  actions: [] as AdminActionLogRow[],
};

/** G29 pagination page size — kept small enough that the table + pager stay legible. */
const TENANTS_PAGE_SIZE = 25;

/** IN-02 — an unbounded `?page=` overflows the Postgres OFFSET (or blows up JS number parsing on
 *  a huge digit string) and 500s the whole page. No real pager gets anywhere near this; it only
 *  guards against a hand-crafted URL. */
const MAX_PAGE = 10_000;

/** Postgres SQLSTATE for "undefined table" — same shape on node-postgres and PGlite errors. */
const PG_UNDEFINED_TABLE = "42P01";

export function isUndefinedTableError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === PG_UNDEFINED_TABLE
  );
}

type ActionLogStatus = "ok" | "missing" | "error";

type LoadedData = typeof EMPTY & { actionLogStatus: ActionLogStatus };

async function loadData(search: string, page: number): Promise<LoadedData> {
  if (!adminDbConfigured()) return { ...EMPTY, actionLogStatus: "ok" };
  const offset = Math.max(page, 0) * TENANTS_PAGE_SIZE;
  const [tenants, entitlements, credits, licenses] = await Promise.all([
    readAdmin((tx) =>
      readTenants(tx, {
        ...(search === "" ? {} : { search }),
        limit: TENANTS_PAGE_SIZE,
        offset,
      }),
    ),
    readAdmin(readEntitlements),
    readAdmin(readCredits),
    readAdmin(readLicenses),
  ]);
  // The `admin_action_log` table ships in the ADR-0220 DEPLOY DDL. A routine fleet redeploy from
  // main BEFORE that DDL runs must not crash the whole read cockpit — degrade THIS read alone to an
  // empty log plus a provisioning hint. CAISSON-10: only a genuine undefined-table (42P01) means
  // "not provisioned yet" — any other error (a transient connection drop, a timeout) is NOT the same
  // condition and must not render the provisioning hint as if the DDL were simply missing. The other
  // reads predate 0220, so they are not guarded here.
  let actions: AdminActionLogRow[] = [];
  let actionLogStatus: ActionLogStatus = "ok";
  try {
    actions = await readAdmin((tx) => readAdminActionLog(tx, 50));
  } catch (err) {
    actionLogStatus = isUndefinedTableError(err) ? "missing" : "error";
  }
  return {
    tenants,
    entitlements,
    credits,
    licenses,
    actions,
    actionLogStatus,
  };
}

function fmtDate(iso: string | null): string {
  if (iso === null) return "—";
  return iso.slice(0, 10);
}

/** G42 — never let a missing/corrupt baked registry index (a local dev env, or a broken build)
 *  crash the whole business page; the datalist just degrades to empty (a bare text input, today's
 *  behavior) rather than 500ing every OTHER read on this page. */
function safeGrantableEntitlementIds(): string[] {
  try {
    return grantableEntitlementIds();
  } catch {
    return [];
  }
}

export default async function BusinessPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const search = params.q?.trim() ?? "";
  const page = Math.min(
    Math.max(Number.parseInt(params.page ?? "0", 10) || 0, 0),
    MAX_PAGE,
  );
  const configured = adminDbConfigured();
  const { tenants, entitlements, credits, licenses, actions, actionLogStatus } =
    await loadData(search, page);

  const pageStart = page * TENANTS_PAGE_SIZE;
  const pageEnd = Math.min(pageStart + tenants.rows.length, tenants.total);
  const hasPrev = page > 0;
  const hasNext = pageStart + tenants.rows.length < tenants.total;
  const qParam = search === "" ? "" : `q=${encodeURIComponent(search)}&`;

  return (
    <div className="shell stack" style={{ gap: "var(--cs-space-10)" }}>
      <section>
        <p className="eyebrow">caisson · admin</p>
        <h1 className="page-title">Business admin</h1>
        <p className="lede">
          A cross-tenant view of tenants, purchases, entitlements, and credits
          over the Railway Postgres. Reads run as the read-only{" "}
          <span className="mono">admin</span> role (ADR-0141); the operator
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

      <Section
        title={
          tenants.total > 0
            ? `Tenants (${String(pageStart + 1)}–${String(pageEnd)} of ${String(tenants.total)})`
            : "Tenants (0)"
        }
      >
        <form
          method="GET"
          className="row"
          style={{
            gap: "var(--cs-space-2)",
            marginBottom: "var(--cs-space-3)",
          }}
        >
          <input
            type="text"
            name="q"
            defaultValue={search}
            placeholder="Search account id or email…"
            className="mono"
            style={{ padding: 6, minWidth: 260 }}
          />
          <button type="submit" style={{ padding: "6px 12px" }}>
            Search
          </button>
          {search !== "" ? (
            <a
              href="/business"
              className="muted"
              style={{ alignSelf: "center", fontSize: "0.85em" }}
            >
              Clear
            </a>
          ) : null}
        </form>
        <Table
          head={["Account", "Email", "Credits", "Entitlements", "Licenses"]}
          empty={configured ? "No tenants match." : "—"}
          rows={tenants.rows.map((t) => [
            t.accountId,
            t.email ?? "—",
            String(t.creditBalance),
            String(t.entitlementCount),
            String(t.licenseCount),
          ])}
        />
        <div
          className="row"
          style={{
            gap: "var(--cs-space-3)",
            marginTop: "var(--cs-space-3)",
            fontSize: "0.85em",
          }}
        >
          {hasPrev ? (
            <a href={`/business?${qParam}page=${String(page - 1)}`}>
              &larr; Prev
            </a>
          ) : (
            <span className="muted">&larr; Prev</span>
          )}
          {hasNext ? (
            <a href={`/business?${qParam}page=${String(page + 1)}`}>
              Next &rarr;
            </a>
          ) : (
            <span className="muted">Next &rarr;</span>
          )}
        </div>
        <p
          className="muted"
          style={{ fontSize: "0.85em", marginTop: "var(--cs-space-2)" }}
        >
          Drill into one account&apos;s money timeline — credit ledger + Paddle
          orders &amp; subscriptions →{" "}
          <a href="/business/ledger">open the ledger</a>
        </p>
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
          Each action is gated by GitHub sign-in restricted to the operator
          numeric-id allowlist (ADR-0283), bounded to one target account,
          dual-logged (WORM + the action log below), and behind a
          type-to-confirm gate. No raw SQL against production.
        </p>
        <AdminMutations
          grantableEntitlementIds={safeGrantableEntitlementIds()}
        />
      </section>

      <Section title={`Action log (${actions.length})`}>
        {actionLogStatus === "missing" ? (
          <p className="muted">
            The <span className="mono">admin_action_log</span> table is not
            provisioned yet — run the ADR-0220 DEPLOY DDL (the action-log schema
            plus <span className="mono">ADMIN_MUTATION_PROVISION_SQL</span>).
            Operator actions are still recorded in the per-tenant WORM chain.
          </p>
        ) : actionLogStatus === "error" ? (
          <p className="muted">
            The action log could not be read right now — a transient database
            error, not a missing table. Operator actions are still recorded in
            the per-tenant WORM chain; reload to retry.
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
        <p
          className="muted"
          style={{ fontSize: "0.85em", marginTop: "var(--cs-space-3)" }}
        >
          Every action above appends to the target account&apos;s tamper-evident
          WORM chain too — <a href="/business/audit">verify a chain →</a>
        </p>
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
