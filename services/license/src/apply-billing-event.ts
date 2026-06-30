// The billing-event -> grant/revoke mapper (ADR-0089/0071/0109), the locked home for billing
// orchestration (ADR-0017 P1<->P6 split: @caisson/billing only verifies+parses; the event->effect
// logic lives here). Runs inside withTenant (the caller scopes RLS to the buyer's account, one
// transaction). It does FOUR things by event type:
//   - invoice.paid (gated)      -> grant the cycle credits + the plan's SUBSCRIPTION entitlement grants
//   - purchase.completed        -> grant a ONE-TIME purchase's credits + its one_time entitlement grants
//   - subscription.canceled     -> IMMEDIATELY soft-revoke that subscription's entitlement grants
//   - refund.completed          -> soft-revoke the purchase's grants + claw back ONLY unspent credits
// Fail-closed throughout: an unknown plan/purchase price throws (the webhook returns non-2xx, Stripe
// retries) — never a guessed grant. Idempotent: the credit ledger keys on the source id; entitlement
// grants key per-source; the refund latches on the active->revoked transition so a re-delivery is inert.
import type { DomainBillingEvent } from "@caisson/billing";
import { clawback, creditsGrantedBySource, grant } from "@caisson/credits";
import { ConfigError } from "@caisson/kernel";
import { resolvePlan, resolvePurchase } from "@caisson/pricebook";
import type { TenantExecutor } from "@caisson/tenancy-rls";
import {
  grantEntitlements,
  revokePurchaseGrants,
  revokeSubscriptionGrants,
} from "./entitlement-store.ts";

// Only these two billing reasons grant: the first charge and each renewal. `subscription_update`
// (proration on upgrade) grants nothing by default (ADR-0089 §6, SD-1) — the next cycle invoice grants
// the new plan's full allotment, avoiding a double-grant. Any other reason (manual, etc.) grants nothing.
const GRANTING_REASONS = new Set(["subscription_create", "subscription_cycle"]);

/**
 * Apply a verified domain billing event (ADR-0089/0071/0109). See the file header for the per-type
 * effect map. Every effect runs inside the caller's `withTenant` transaction, so the credit move and
 * the entitlement grant/revoke commit or roll back together, RLS-scoped to the buyer.
 */
export async function applyBillingEvent(
  tx: TenantExecutor,
  ev: DomainBillingEvent,
): Promise<void> {
  switch (ev.type) {
    case "invoice.paid": {
      if (!GRANTING_REASONS.has(ev.billingReason)) return;
      if (ev.invoiceId === "") {
        // The invoice id IS the idempotency anchor (ADR-0089 §4); an empty one would let two cycles
        // collide on ("", "sub_allotment") and silently under-grant. Fail closed — never grant on a
        // degenerate anchor (the webhook returns non-2xx, Stripe retries).
        throw new ConfigError("invoice.paid is missing an invoice id");
      }
      const plan = resolvePlan(ev.priceId); // fail-closed on an unknown price id
      await grant(tx, {
        eventType: "sub_allotment",
        accountId: ev.accountId,
        amount: plan.creditsPerCycle, // exact table integer — no conversion (ADR-0089 §5)
        sourceEventId: ev.invoiceId, // cycle-stable idempotency anchor (ADR-0089 §4)
      });
      // Grant the plan's edition/bundle/module entitlements as SUBSCRIPTION grants (ADR-0071/0109),
      // keyed on the subscription id so a later subscription.canceled revokes exactly these. Idempotent
      // per (account, entitlement, subscription) — each renewal re-confirms the same access as a no-op.
      // A credits-only plan carries `entitlements: []` → no-op.
      await grantEntitlements(tx, {
        accountId: ev.accountId,
        entitlementIds: plan.entitlements,
        sourceEventId: ev.invoiceId,
        source: { kind: "subscription", subscriptionId: ev.subscriptionId },
      });
      return;
    }
    case "purchase.completed": {
      // A one-time (non-subscription) edition/module/credit-pack buy (ADR-0109). The PaymentIntent id
      // anchors BOTH the credit grant and the entitlement grant so a later charge.refunded can find +
      // reverse them. Fail closed without it — a one-time grant we cannot later revoke must not land.
      if (ev.paymentId === "") {
        throw new ConfigError("purchase.completed is missing a payment id");
      }
      const purchase = resolvePurchase(ev.priceId); // fail-closed on an unknown price id
      if (purchase.credits > 0) {
        await grant(tx, {
          eventType: "purchase",
          accountId: ev.accountId,
          amount: purchase.credits,
          sourceEventId: ev.paymentId, // the refund clawback looks the granted amount up by this id
        });
      }
      await grantEntitlements(tx, {
        accountId: ev.accountId,
        entitlementIds: purchase.entitlements,
        sourceEventId: ev.paymentId,
        source: { kind: "one_time", purchaseId: ev.paymentId },
      });
      return;
    }
    case "subscription.canceled":
      // IMMEDIATE revoke (ADR-0109): soft-revoke every grant backed by this subscription. An entitlement
      // also held via an active one-time grant survives (refcount). Idempotent (only active grants flip).
      await revokeSubscriptionGrants(tx, {
        accountId: ev.accountId,
        subscriptionId: ev.subscriptionId,
      });
      return;
    case "refund.completed": {
      // Refund of a one-time purchase (ADR-0109, operator-locked money policy). (a) Soft-revoke the
      // purchase's entitlement grants; the count is the IDEMPOTENCY LATCH — a re-delivered refund finds
      // nothing active to revoke and stops, so the clawback runs at most once. (b) Claw back ONLY the
      // UNSPENT credits this purchase granted, bounded to the current balance (never negative).
      const revoked = await revokePurchaseGrants(tx, {
        accountId: ev.accountId,
        purchaseId: ev.paymentId,
      });
      if (revoked === 0) return; // already processed (or nothing to revoke) — do not re-claw
      const granted = await creditsGrantedBySource(
        tx,
        ev.accountId,
        ev.paymentId,
      );
      if (granted > 0) {
        await clawback(tx, {
          accountId: ev.accountId,
          amount: granted,
          sourceEventId: ev.paymentId, // defense-in-depth idempotency on the compensating debit
        });
      }
      return;
    }
    case "subscription.created": // signup only — granting here would never renew (the X-2 trap)
    case "subscription.updated": // plan change recorded; proration grant is the deferred SD-1
      return;
    default: {
      // Exhaustiveness guard: a future DomainBillingEvent member forces an explicit decision here
      // rather than silently no-op'ing (the silent-miss class this mapper exists to prevent).
      const _exhaustive: never = ev;
      return _exhaustive;
    }
  }
}
