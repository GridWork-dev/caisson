// The billing-event -> grant/revoke mapper (ADR-0089/0071/0109), the locked home for billing
// orchestration (ADR-0017 P1<->P6 split: @caisson/billing only verifies+parses; the event->effect
// logic lives here). Runs inside withTenant (the caller scopes RLS to the buyer's account, one
// transaction). It does FOUR things by event type:
//   - invoice.paid (gated)      -> grant the cycle credits + the plan's SUBSCRIPTION entitlement grants
//   - purchase.completed        -> grant a ONE-TIME purchase's credits + its one_time entitlement grants
//   - subscription.canceled     -> IMMEDIATELY soft-revoke that subscription's entitlement grants
//   - refund.completed          -> soft-revoke the purchase's grants + claw back ONLY unspent credits
// Fail-closed throughout: an unknown plan/purchase price throws (the webhook returns non-2xx, the
// provider retries) — never a guessed grant. Idempotent: the credit ledger keys on the source id; entitlement
// grants key per-source; the refund latches on the active->revoked transition so a re-delivery is inert.
import type { DomainBillingEvent } from "@caisson/billing";
import { clawback, creditsGrantedBySource, grant } from "@caisson/credits";
import { ConfigError, asCredits } from "@caisson/kernel";
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

export interface AppliedBillingEffect {
  /**
   * The purchased entitlement ids THIS event application granted (`[]` when nothing granted —
   * a gated/no-op event, a revoke, or a refund). Feeds the post-commit Discord role push
   * (ADR-0203); computed HERE so the push can never drift from the grant gate's own decision.
   */
  grantedEntitlements: string[];
}

const NO_EFFECT: AppliedBillingEffect = { grantedEntitlements: [] };

/**
 * Apply a verified domain billing event (ADR-0089/0071/0109). See the file header for the per-type
 * effect map. Every effect runs inside the caller's `withTenant` transaction, so the credit move and
 * the entitlement grant/revoke commit or roll back together, RLS-scoped to the buyer.
 */
export async function applyBillingEvent(
  tx: TenantExecutor,
  ev: DomainBillingEvent,
): Promise<AppliedBillingEffect> {
  switch (ev.type) {
    case "invoice.paid": {
      if (!GRANTING_REASONS.has(ev.billingReason)) return NO_EFFECT;
      if (ev.invoiceId === "") {
        // The invoice id IS the idempotency anchor (ADR-0089 §4); an empty one would let two cycles
        // collide on ("", "sub_allotment") and silently under-grant. Fail closed — never grant on a
        // degenerate anchor (the webhook returns non-2xx, the provider retries).
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
      return { grantedEntitlements: [...plan.entitlements] };
    }
    case "purchase.completed": {
      // A one-time (non-subscription) edition/module/credit-pack buy (ADR-0113). The PaymentIntent id
      // anchors BOTH the credit grant and the entitlement grant so a later charge.refunded can find +
      // reverse them. Fail closed without it — a one-time grant we cannot later revoke must not land.
      if (ev.paymentId === "") {
        throw new ConfigError("purchase.completed is missing a payment id");
      }
      // Fulfill EVERY paid line (Strix vuln-0005: a multi-item cart is ONE transaction with N lines —
      // fulfilling only the first under-grants a cart the buyer paid for in full). resolvePurchase is
      // fail-closed per line: an unknown price id throws and rolls back the whole withTenant tx, so a
      // partial grant across items is impossible. Credits sum across lines and scale with quantity;
      // entitlements union (an entitlement is binary — owning it twice is still owning it once).
      let totalCredits = 0;
      const entitlements = new Set<string>();
      for (const line of ev.lineItems) {
        const purchase = resolvePurchase(line.priceId); // fail-closed on an unknown price id
        totalCredits += purchase.credits * line.quantity;
        for (const e of purchase.entitlements) entitlements.add(e);
      }
      const entitlementIds = [...entitlements];
      if (totalCredits > 0) {
        await grant(tx, {
          eventType: "purchase",
          accountId: ev.accountId,
          // Mint at the boundary (ADR-0212): the per-line sum is a plain number; the grant is the
          // exact table-integer total, NULL rounding provenance (ADR-0089 s5 - no rounding site here).
          amount: asCredits(totalCredits),
          sourceEventId: ev.paymentId, // the refund clawback looks the granted amount up by this id
        });
      }
      // ONE entitlement grant keyed on the payment id (unchanged) — the refund path revokes by
      // purchase_id alone, so merging N lines' entitlements under one purchaseId keeps refund correct.
      await grantEntitlements(tx, {
        accountId: ev.accountId,
        entitlementIds,
        sourceEventId: ev.paymentId,
        source: { kind: "one_time", purchaseId: ev.paymentId },
      });
      return { grantedEntitlements: entitlementIds };
    }
    case "subscription.canceled":
      // IMMEDIATE revoke (ADR-0113): soft-revoke every grant backed by this subscription. An entitlement
      // also held via an active one-time grant survives (refcount). Idempotent (only active grants flip).
      await revokeSubscriptionGrants(tx, {
        accountId: ev.accountId,
        subscriptionId: ev.subscriptionId,
      });
      return NO_EFFECT;
    case "refund.completed": {
      // Refund of a one-time purchase (ADR-0113, operator-locked money policy). Act ONLY on a FULL
      // refund — a partial `charge.refunded` must not revoke all access or claw the whole grant.
      if (!ev.fullyRefunded) return NO_EFFECT;
      // (a) Soft-revoke the purchase's entitlement grants (idempotent — only active rows flip; a
      // re-delivery finds none). A credits-only purchase has zero grants — that is fine.
      await revokePurchaseGrants(tx, {
        accountId: ev.accountId,
        purchaseId: ev.paymentId,
      });
      // (b) Claw back ONLY the UNSPENT credits this purchase granted, bounded to the current balance
      // (never negative). This runs whether or not an entitlement was revoked, so a credits-only pack
      // refund still reclaims credits (the entitlement-revoke count is NOT the latch). Idempotency is
      // the compensating debit's own (paymentId, refund_clawback) unique key — a re-delivered refund
      // writes no second debit (ADR-0113).
      const granted = await creditsGrantedBySource(
        tx,
        ev.accountId,
        ev.paymentId,
      );
      if (granted > 0) {
        await clawback(tx, {
          accountId: ev.accountId,
          amount: granted,
          sourceEventId: ev.paymentId,
        });
      }
      return NO_EFFECT;
    }
    case "subscription.created": // signup only — granting here would never renew (the X-2 trap)
    case "subscription.updated": // plan change recorded; proration grant is the deferred SD-1
      return NO_EFFECT;
    default: {
      // Exhaustiveness guard: a future DomainBillingEvent member forces an explicit decision here
      // rather than silently no-op'ing (the silent-miss class this mapper exists to prevent).
      const _exhaustive: never = ev;
      return _exhaustive;
    }
  }
}
