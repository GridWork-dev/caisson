// Overview / Entitlements (ADR-0114 scope item 6a). Reads `entitlement_grant` for the buyer's
// account (raw SQL, the flagged services/license coupling — lib/dashboard-reads.ts) and renders
// each grant as a `StatusPill` row plus `MetricStat` tiles for the headline counts. Real data —
// no mocks: an unconfigured DB / unauthenticated request never reaches this far (the layout
// gates auth; lib/db.ts's PGlite dev double backs an empty-but-real read in local dev).
import type { Metadata } from "next";
import Link from "next/link";
import { MetricStat, StatusPill } from "@caisson/ui/components";
import { readScoped } from "@/lib/db";
import { requireDashboardSession } from "@/lib/auth";
import { readEntitlementGrants } from "@/lib/dashboard-reads";

export const metadata: Metadata = { title: "Overview" };

export default async function DashboardOverviewPage() {
  const session = await requireDashboardSession("/dashboard");
  const grants = await readScoped(session.accountId, (tx) =>
    readEntitlementGrants(tx, session.accountId),
  );

  const activeCount = grants.filter((g) => g.status === "active").length;
  const distinctActive = new Set(
    grants.filter((g) => g.status === "active").map((g) => g.entitlementId),
  ).size;

  return (
    <div style={{ display: "grid", gap: "var(--cs-space-8)" }}>
      <div>
        <h1
          className="cs-card-title"
          style={{ fontSize: "var(--cs-text-2xl)" }}
        >
          Overview
        </h1>
        <p className="cs-muted" style={{ marginTop: "var(--cs-space-2)" }}>
          Your account&rsquo;s entitlements and grant history.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(10rem, 1fr))",
          gap: "var(--cs-space-4)",
        }}
      >
        <MetricStat
          label="Active entitlements"
          value={distinctActive}
          icon="boxes"
        />
        <MetricStat
          label="Total grants"
          value={grants.length}
          icon="dashboard"
        />
        <MetricStat
          label="Active grants"
          value={activeCount}
          icon="check"
          tone={activeCount > 0 ? "positive" : "default"}
        />
      </div>

      <div>
        <h2
          className="cs-card-title"
          style={{
            fontSize: "var(--cs-text-lg)",
            marginBottom: "var(--cs-space-4)",
          }}
        >
          Entitlement grants
        </h2>
        {grants.length === 0 ? (
          <p className="cs-muted">
            No entitlements yet — purchase an edition from the{" "}
            <Link href="/dashboard/plan">Plan</Link> view to get started.
          </p>
        ) : (
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "grid",
              gap: "var(--cs-space-3)",
            }}
          >
            {grants.map((grant, i) => (
              <li
                key={`${grant.entitlementId}-${grant.sourceKind}-${i}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "var(--cs-space-4)",
                  padding: "var(--cs-space-3) 0",
                  borderBottom: "1px solid var(--cs-border)",
                }}
              >
                <span
                  className="cs-num"
                  style={{ fontFamily: "var(--cs-font-mono)" }}
                >
                  {grant.entitlementId}
                </span>
                <span
                  className="cs-muted"
                  style={{ fontSize: "var(--cs-text-xs)" }}
                >
                  {grant.sourceKind === "subscription"
                    ? "Subscription"
                    : "One-time"}
                </span>
                <StatusPill status={grant.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
