// Plan (ADR-0114 scope item 6e + 8): current plan/entitlements + upgrade/purchase options from
// the pricebook, each with a Paddle checkout button (lib/paddle-checkout.ts). The grant itself is
// server-side via the existing webhook -> services/license -> pricebook path
// (apply-billing-event.ts) once a billing-webhook HTTP route is mounted (a pre-existing gap,
// surfaced — not created — while wiring this view: `handleBillingWebhook` is exported by
// `@caisson/service-license` but no service mounts it on a route yet, see the session notes); this
// page only opens checkout and reads the resulting entitlement/credit state once granted.
import type { Metadata } from "next";
import { headers } from "next/headers";
import { PLAN_BOOK, PURCHASE_BOOK } from "@caisson/pricebook";
import { StatusPill } from "@caisson/ui/components";
import { readScoped } from "@/lib/db";
import { requireDashboardSession } from "@/lib/auth";
import { configuredProviderIds } from "@/lib/auth-config";
import { getAuth } from "@/lib/auth-server";
import { readEntitlementGrants } from "@/lib/dashboard-reads";
import { DiscordConnect } from "@/components/discord-connect";
import { PlanPurchaseRow } from "@/components/plan-purchase-row";

export const metadata: Metadata = { title: "Plan" };

// Only the REAL (non-PLACEHOLDER) price ids — the live Paddle SKUs a buyer can actually purchase.
// The legacy `_PLACEHOLDER` rows in PLAN_BOOK/PURCHASE_BOOK exist only as test fixtures.
function realEntries<T extends { entitlements: readonly string[] }>(
  book: Record<string, T>,
): Array<[string, T]> {
  return Object.entries(book).filter(([id]) => !id.includes("PLACEHOLDER"));
}

export default async function DashboardPlanPage() {
  const session = await requireDashboardSession("/dashboard/plan");
  const grants = await readScoped(session.accountId, (tx) =>
    readEntitlementGrants(tx, session.accountId),
  );
  const activeIds = new Set(
    grants.filter((g) => g.status === "active").map((g) => g.entitlementId),
  );

  // Discord seam (ADR-0203): rendered only when the provider is env-configured. Linked status
  // comes from better-auth's own account list for the SIGNED-IN user (never a request param).
  const discordConfigured = configuredProviderIds(process.env).includes(
    "discord",
  );
  let discordLinked = false;
  if (discordConfigured) {
    try {
      const auth = getAuth();
      const accounts =
        auth === null
          ? []
          : ((await auth.api.listUserAccounts({
              headers: await headers(),
            })) as Array<{ providerId: string }>);
      discordLinked = accounts.some((a) => a.providerId === "discord");
    } catch {
      discordLinked = false;
    }
  }

  const purchases = realEntries(PURCHASE_BOOK);
  const plans = realEntries(PLAN_BOOK);

  return (
    <div style={{ display: "grid", gap: "var(--cs-space-8)" }}>
      <div>
        <h1
          className="cs-card-title"
          style={{ fontSize: "var(--cs-text-2xl)" }}
        >
          Plan
        </h1>
        <p className="cs-muted" style={{ marginTop: "var(--cs-space-2)" }}>
          Your current entitlements and available upgrades.
        </p>
      </div>

      <div>
        <h2
          className="cs-card-title"
          style={{
            fontSize: "var(--cs-text-lg)",
            marginBottom: "var(--cs-space-4)",
          }}
        >
          Editions &amp; bundle
        </h2>
        <div style={{ display: "grid", gap: "var(--cs-space-3)" }}>
          {purchases.map(([priceId, entry]) => {
            const owned = entry.entitlements.every((id) => activeIds.has(id));
            return (
              <PlanPurchaseRow
                key={priceId}
                priceId={priceId}
                accountId={session.accountId}
                label={"purchaseTag" in entry ? entry.purchaseTag : priceId}
                owned={owned}
              />
            );
          })}
        </div>
      </div>

      <div>
        <h2
          className="cs-card-title"
          style={{
            fontSize: "var(--cs-text-lg)",
            marginBottom: "var(--cs-space-4)",
          }}
        >
          Subscriptions
        </h2>
        <div style={{ display: "grid", gap: "var(--cs-space-3)" }}>
          {plans.map(([priceId, entry]) => (
            <PlanPurchaseRow
              key={priceId}
              priceId={priceId}
              accountId={session.accountId}
              label={"planTag" in entry ? entry.planTag : priceId}
              owned={false}
            />
          ))}
        </div>
      </div>

      {activeIds.size > 0 && (
        <div>
          <h2
            className="cs-card-title"
            style={{
              fontSize: "var(--cs-text-lg)",
              marginBottom: "var(--cs-space-3)",
            }}
          >
            Currently entitled
          </h2>
          <div
            style={{
              display: "flex",
              gap: "var(--cs-space-2)",
              flexWrap: "wrap",
            }}
          >
            {[...activeIds].sort().map((id) => (
              <StatusPill key={id} status="active">
                {id}
              </StatusPill>
            ))}
          </div>
        </div>
      )}

      {discordConfigured && (
        <div>
          <h2
            className="cs-card-title"
            style={{
              fontSize: "var(--cs-text-lg)",
              marginBottom: "var(--cs-space-3)",
            }}
          >
            Community
          </h2>
          <p className="cs-muted" style={{ marginBottom: "var(--cs-space-3)" }}>
            {discordLinked
              ? "Discord is connected — purchases grant your edition roles automatically."
              : "Connect Discord to receive your edition roles in the Caisson server."}
          </p>
          <DiscordConnect linked={discordLinked} />
        </div>
      )}
    </div>
  );
}
