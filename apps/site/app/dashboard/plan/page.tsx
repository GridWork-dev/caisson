// Plan (ADR-0114 scope item 6e + 8): current plan/entitlements + upgrade/purchase options from
// the pricebook, each with a Paddle checkout button (lib/paddle-checkout.ts). The grant itself is
// server-side via the Paddle webhook mounted at POST /webhook on `services/license`
// (`handleBillingWebhook`, ADR-0108/0116/0200) -> `apply-billing-event.ts` -> pricebook, one
// tenant-scoped transaction per event; this page only opens checkout and reads the resulting
// entitlement/credit state once granted.
import type { Metadata } from "next";
import { headers } from "next/headers";
import { PLAN_BOOK, PURCHASE_BOOK } from "@caisson/pricebook";
import { StatusPill } from "@caisson/ui/components";
import { readScoped } from "@/lib/db";
import { requireDashboardSession } from "@/lib/auth";
import { configuredProviderIds } from "@/lib/auth-config";
import { getAuth } from "@/lib/auth-server";
import { LIVE_PRICE_IDS } from "@/lib/catalog";
import {
  readEntitlementGrants,
  readSubscriptionStatuses,
} from "@/lib/dashboard-reads";
import { discordInviteUrl } from "@/lib/discord-grant";
import { computeOwned } from "@/lib/plan-owned";
import { DiscordConnect } from "@/components/discord-connect";
import { PlanPurchaseRow } from "@/components/plan-purchase-row";
import { SubscriptionCancelControl } from "@/components/subscription-cancel";

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
  const { grants, subscriptionStatuses } = await readScoped(
    session.accountId,
    async (tx) => ({
      grants: await readEntitlementGrants(tx, session.accountId),
      subscriptionStatuses: await readSubscriptionStatuses(
        tx,
        session.accountId,
      ),
    }),
  );
  const activeIds = new Set(
    grants.filter((g) => g.status === "active").map((g) => g.entitlementId),
  );
  // ADR-0293 G13/G14: active subscriptions by price id (the zero-entitlement "owned" signal) plus
  // the Paddle subscription id backing each — the G14 cancel control's target.
  const activeSubscriptions = subscriptionStatuses.filter(
    (s) => s.status === "active",
  );
  const activeSubscriptionPriceIds = new Set(
    activeSubscriptions.map((s) => s.priceId),
  );
  // `activeSubscriptions` is newest-updated-first; keep only the FIRST (most recent) subscription id
  // seen per price id, in the rare case a buyer holds two active subscription rows on the same price
  // (e.g. a resubscribe that raced a cancel) — the cancel control should always target the current one.
  const subscriptionIdByPriceId = new Map<string, string>();
  for (const s of activeSubscriptions) {
    if (!subscriptionIdByPriceId.has(s.priceId)) {
      subscriptionIdByPriceId.set(s.priceId, s.subscriptionId);
    }
  }

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
  // G12: joining the Discord server a purchase grants a role in is independent of the OAuth
  // account-link above — undefined (renders nothing) until the operator sets
  // NEXT_PUBLIC_DISCORD_INVITE_URL.
  const inviteUrl = discordInviteUrl();

  // G4 (ADR-0293): `realEntries` only drops the `_PLACEHOLDER` test fixtures — it does NOT know
  // ADR-0270 repointed 5 archived edition-era rows onto the canonical bundle ids, so they were
  // rendering as full live Buy cards next to the real W7 rows. `catalog.ts`'s `LIVE_PRICE_IDS`
  // (the cart/checkout allowlist) is the one place that already tracks "which price ids are
  // actually sellable today" — reuse it rather than hand-maintaining a second list here.
  const purchases = realEntries(PURCHASE_BOOK).filter(([priceId]) =>
    LIVE_PRICE_IDS.has(priceId),
  );
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
          {plans.map(([priceId, entry]) => {
            // G13: an entitlement-bearing plan (e.g. Compliance Updates) is owned via the SAME
            // active-entitlement check the Purchases section above uses; a zero-entitlement plan
            // (Developer, ADR-0269) has no such row, so ownership comes from the ADR-0293
            // subscription-status signal instead. See lib/plan-owned.ts for why this can't just be
            // `entry.entitlements.every(...)` unconditionally (vacuously true on `[]`).
            const owned = computeOwned(
              entry.entitlements,
              activeIds,
              activeSubscriptionPriceIds,
              priceId,
            );
            const subscriptionId = subscriptionIdByPriceId.get(priceId);
            return (
              <PlanPurchaseRow
                key={priceId}
                priceId={priceId}
                accountId={session.accountId}
                label={"planTag" in entry ? entry.planTag : priceId}
                owned={owned}
                ownedExtra={
                  owned && subscriptionId !== undefined ? (
                    <SubscriptionCancelControl
                      subscriptionId={subscriptionId}
                    />
                  ) : undefined
                }
              />
            );
          })}
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

      {(discordConfigured || inviteUrl) && (
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
          {inviteUrl && (
            <p
              className="cs-muted"
              style={{ marginBottom: "var(--cs-space-3)" }}
            >
              <a href={inviteUrl} target="_blank" rel="noopener noreferrer">
                Join the Caisson Discord
              </a>
              {discordConfigured
                ? " — connect below to receive your bundle roles automatically."
                : "."}
            </p>
          )}
          {discordConfigured && (
            <>
              <p
                className="cs-muted"
                style={{ marginBottom: "var(--cs-space-3)" }}
              >
                {discordLinked
                  ? "Discord is connected — purchases grant your bundle roles automatically."
                  : "Connect Discord to receive your bundle roles in the Caisson server."}
              </p>
              <DiscordConnect linked={discordLinked} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
