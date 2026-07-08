// The billing-webhook entry for services/license (ADR-0089/0017). Verifies + parses the raw Stripe
// webhook through the injected BillingProvider port (no Stripe type escapes @caisson/billing), then
// applies the domain event inside withTenant so the credit grant is RLS-scoped to the buyer's account.
// The provider is INJECTED (not constructed here) so the handler is testable without a live HMAC secret
// and the MoR driver stays swappable (ADR-0017). A bad signature throws (AuthnError) BEFORE any DB work.
import type { BillingProvider, DomainBillingEvent } from "@caisson/billing";
import { processEvent } from "@caisson/billing-orchestration";
import { InternalError } from "@caisson/kernel";
import { type Transactor, withTenant } from "@caisson/tenancy-rls";
import {
  applyBillingEvent,
  type RenewedEntitlement,
  type RevokeNotice,
} from "./apply-billing-event.ts";
import type { ChargebackAlert } from "./chargeback-notify.ts";
import type { SkuLine } from "./posthog-capture.ts";

export interface BillingWebhookResult {
  /** The mapped domain event, or null for an event type we don't act on. */
  event: DomainBillingEvent | null;
  /**
   * The purchased entitlement ids this delivery granted (`[]` for a no-op/gated/revoke event) —
   * computed by `applyBillingEvent` itself so the post-commit Discord push (ADR-0203) can never
   * drift from the grant gate's own decision.
   */
  grantedEntitlements: string[];
  /**
   * Per-line SKU attribution for this delivery's grant, threaded from
   * `applyBillingEvent` — `[]` on a re-delivery/no-op, gated identically to `grantedEntitlements`
   * so the post-commit PostHog capture never drifts from the grant either.
   */
  skuLines: SkuLine[];
  /**
   * The entitlements this delivery's renewal line(s) extended, threaded from `applyBillingEvent` —
   * `[]` on a re-delivery/no-op/non-renewal event, gated identically to `grantedEntitlements` so a
   * replayed delivery never re-fires the post-commit renewal-confirmation email.
   */
  renewedEntitlements: RenewedEntitlement[];
  /**
   * ADR-0294 chargeback/dispute alerts this delivery surfaced, threaded from `applyBillingEvent` —
   * `[]` on every non-chargeback event AND on a re-delivery (gated on the outer `processEvent`
   * claim like the fields above). A Paddle dashboard "Resend" (a FRESH `event_id` for the same
   * dispute) sails past that outer gate, so `applyBillingEvent`'s own `chargeback.detected` case
   * ALSO gates the alert internally via `withIdempotentSideEffect`, keyed on the stable disputed
   * transaction id — a redelivered OR resent chargeback notification never double-alerts the
   * operator, except the degenerate case of a chargeback delivered with no transaction id at all
   * (falls back to the per-delivery `event_id`, so a resend of THAT case can still re-alert once).
   */
  chargebackAlerts: ChargebackAlert[];
  /**
   * G27 buyer-facing revoke notices this delivery surfaced (a subscription cancel or a refund
   * that actually revoked something), threaded from `applyBillingEvent` — `[]` on every granting
   * event AND on a re-delivery (gated identically to the fields above).
   */
  revokeNotices: RevokeNotice[];
}

/**
 * Handle a raw Stripe billing webhook: verify+parse via the port, then (for an actionable event with a
 * resolvable account) run the cycle->grant mapper inside withTenant. A bad signature throws before any
 * DB work (fail-closed). An event type we don't act on (`event === null`, e.g. `customer.created`) is a
 * benign no-op success — the provider gets its 2xx and does not retry.
 *
 * A VERIFIED, actionable event whose `accountId` never resolved (`custom_data.account_id` missing on
 * the Paddle/Stripe side) is a DIFFERENT case: it is a genuinely paid purchase or cycle we cannot
 * attribute to a tenant, not a benign no-op. Returning 2xx here (the prior behavior) would silently
 * drop real money on the floor and stop the provider's retries for good — the delivery is only sent
 * once more on a schedule the provider controls. Surface it loudly instead: a stderr ALERT line
 * (operator-visible, scraped by the platform's log alerting — the same visibility pattern the route's
 * generic-failure branch already uses) plus a thrown `InternalError` so the HTTP layer returns non-2xx
 * and the provider keeps retrying until the resolver catches up or an operator intervenes.
 */
export async function handleBillingWebhook(
  pg: Transactor,
  provider: BillingProvider,
  rawBody: string,
  signatureHeader: string,
): Promise<BillingWebhookResult> {
  const event = provider.verifyAndParse(rawBody, signatureHeader);
  if (event === null)
    return {
      event,
      grantedEntitlements: [],
      skuLines: [],
      renewedEntitlements: [],
      chargebackAlerts: [],
      revokeNotices: [],
    };
  if (event.accountId === "") {
    process.stderr.write(
      `[service-license] ALERT: verified ${event.type} (sourceEventId=${event.sourceEventId}) has no resolvable account_id — purchase unattributed, NOT granted\n`,
    );
    throw new InternalError(
      "verified billing event has no resolvable account id",
    );
  }
  // Dual-layer idempotency (ADR-0229 rows 50+51). The OUTER `processEvent` claim runs inside the same
  // withTenant tx as the grant: a fresh delivery runs applyBillingEvent (whose credit ledger is the
  // idempotent INNER backstop) and captures its grantedEntitlements; a RE-DELIVERY finds the claim,
  // skips the grant, and leaves grantedEntitlements empty — so the post-commit Discord push (ADR-0203,
  // gated on grantedEntitlements.length > 0 in app.ts) is skipped too, closing the re-push gap. The
  // claim + grant commit or roll back together, so a failed grant is retried cleanly next delivery.
  const {
    grantedEntitlements,
    skuLines,
    renewedEntitlements,
    chargebackAlerts,
    revokeNotices,
  } = await withTenant(pg, event.accountId, async (tx) => {
    let granted: string[] = [];
    let lines: SkuLine[] = [];
    let renewed: RenewedEntitlement[] = [];
    let chargebacks: ChargebackAlert[] = [];
    let revokes: RevokeNotice[] = [];
    const { alreadyProcessed } = await processEvent(
      tx,
      event.sourceEventId,
      async () => {
        const effect = await applyBillingEvent(tx, event);
        granted = effect.grantedEntitlements;
        lines = effect.skuLines;
        renewed = effect.renewedEntitlements;
        chargebacks = effect.chargebackAlerts;
        revokes = effect.revokeNotices;
      },
    );
    return alreadyProcessed
      ? {
          grantedEntitlements: [],
          skuLines: [],
          renewedEntitlements: [],
          chargebackAlerts: [],
          revokeNotices: [],
        }
      : {
          grantedEntitlements: granted,
          skuLines: lines,
          renewedEntitlements: renewed,
          chargebackAlerts: chargebacks,
          revokeNotices: revokes,
        };
  });
  return {
    event,
    grantedEntitlements,
    skuLines,
    renewedEntitlements,
    chargebackAlerts,
    revokeNotices,
  };
}
