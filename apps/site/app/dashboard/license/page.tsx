// License (ADR-0114 scope item 6c). Reads `license_grant` (raw SQL — the flagged services/license
// coupling, lib/dashboard-reads.ts) and renders a copy-token affordance + a verify hint per issued
// major. `EmptyState` when the buyer holds no issued license yet (issuance itself is a separate,
// bearer-gated `POST /issue` server-to-server call this dashboard does not make).
//
// Updates section (ADR-0255/ADR-0244): each ACTIVE entitlement's per-purchased-id updates-window
// bound is a LIVE read (`readUpdatesWindows`, `@caisson/platform-reads`) straight off
// `entitlement_grant` — not decoded off the buyer's last-issued license token, which went stale
// after a renewal extended the DB row without a re-issue (the token only reflects whatever was
// true at the last `POST /issue`). Matched against `readEntitlementGrants`' PURCHASED-id truth,
// the same source the Plan view's ownership check uses. Subscription-sourced entitlements never
// carry a window (their own license `expiry` governs) and render as included, no renew action.
import type { Metadata } from "next";
import { EmptyState } from "@caisson/ui/components";
import { readUpdatesWindows } from "@caisson/platform-reads";
import { RENEWAL_BOOK, resolveRenewal } from "@caisson/pricebook";
import { normalizeEntitlementId } from "@caisson/registry-schema";
import { renewalAmount } from "@/lib/pricing";
import { readScoped } from "@/lib/db";
import { requireDashboardSession } from "@/lib/auth";
import {
  readEntitlementGrants,
  readLicenseGrantRows,
} from "@/lib/dashboard-reads";
import { LicenseTokenCard } from "@/components/license-token-card";
import { UpdatesWindowCard } from "@/components/updates-window-card";

export const metadata: Metadata = { title: "License" };

// Reverse RENEWAL_BOOK lookup: canonical purchased-entitlement id -> the Paddle price id that
// renews it. `resolveRenewal` normalizes each row's `renewsEntitlement` through the same bundle
// alias point `expandEntitlements` uses, so a legacy-keyed row (`ai-kit`, `bundle`, …) resolves to
// the canonical id an owned grant's normalized entitlementId will match.
const RENEWAL_PRICE_BY_ENTITLEMENT: Record<string, string> = Object.fromEntries(
  Object.keys(RENEWAL_BOOK).map((priceId) => [
    resolveRenewal(priceId).renewsEntitlement,
    priceId,
  ]),
);

export default async function DashboardLicensePage() {
  const session = await requireDashboardSession("/dashboard/license");
  const { grants, entitlementGrants, updatesWindows } = await readScoped(
    session.accountId,
    async (tx) => {
      const [grants, entitlementGrants, updatesWindows] = await Promise.all([
        readLicenseGrantRows(tx, session.accountId),
        readEntitlementGrants(tx, session.accountId),
        readUpdatesWindows(tx, session.accountId),
      ]);
      return { grants, entitlementGrants, updatesWindows };
    },
  );
  const activeEntitlements = entitlementGrants.filter(
    (g) => g.status === "active",
  );

  return (
    <div style={{ display: "grid", gap: "var(--cs-space-8)" }}>
      <div>
        <h1
          className="cs-card-title"
          style={{ fontSize: "var(--cs-text-2xl)" }}
        >
          License
        </h1>
        <p className="cs-muted" style={{ marginTop: "var(--cs-space-2)" }}>
          Your offline-verifiable Ed25519 license tokens, one per major version.
        </p>
      </div>

      {grants.length === 0 ? (
        <EmptyState
          icon="key"
          title="No license issued yet"
          description="A license is issued automatically the first time you complete a purchase. Check back here once your purchase has gone through, or contact support if it's been a while."
        />
      ) : (
        <>
          {activeEntitlements.length > 0 && (
            <div>
              <h2
                className="cs-card-title"
                style={{
                  fontSize: "var(--cs-text-lg)",
                  marginBottom: "var(--cs-space-4)",
                }}
              >
                Updates
              </h2>
              <div style={{ display: "grid", gap: "var(--cs-space-3)" }}>
                {activeEntitlements.map((g) => (
                  <UpdatesWindowCard
                    key={g.entitlementId}
                    entitlementId={g.entitlementId}
                    accountId={session.accountId}
                    subscriptionSourced={g.sourceKind === "subscription"}
                    windowExpiry={updatesWindows[g.entitlementId] ?? null}
                    renewalPriceId={
                      RENEWAL_PRICE_BY_ENTITLEMENT[
                        normalizeEntitlementId(g.entitlementId)
                      ]
                    }
                    renewalUsd={renewalAmount(
                      normalizeEntitlementId(g.entitlementId),
                    )}
                  />
                ))}
              </div>
            </div>
          )}
          <div style={{ display: "grid", gap: "var(--cs-space-4)" }}>
            {grants.map((grant) => (
              <LicenseTokenCard key={grant.major} grant={grant} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
