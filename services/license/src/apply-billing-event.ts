// The subscription cycle -> credit grant mapper (ADR-0089), the locked home for billing orchestration
// (ADR-0017 P1<->P6 split: @caisson/billing only verifies+parses; the event->grant logic lives here).
// Runs inside withTenant (the caller scopes RLS to the buyer's account). The recurring grant fires on
// `invoice.paid` with billing_reason in {subscription_create, subscription_cycle} and NEVER on a
// `subscription.*` lifecycle event — granting on subscription.created grants once at signup and never
// renews, which is the X-2 bug. Idempotent on the Stripe INVOICE id (one invoice = one cycle = one
// allotment), absorbed by credit_event_source_uniq (ADR-0024). Fail-closed: an unknown plan throws
// (resolvePlan) so the webhook returns non-2xx and Stripe retries — never a guessed grant.
import type { DomainBillingEvent } from "@caisson/billing";
import { grant } from "@caisson/credits";
import { ConfigError } from "@caisson/kernel";
import { resolvePlan } from "@caisson/pricebook";
import type { TenantExecutor } from "@caisson/tenancy-rls";
import { grantEntitlements } from "./entitlement-store.ts";

// Only these two billing reasons grant: the first charge and each renewal. `subscription_update`
// (proration on upgrade) grants nothing by default (ADR-0089 §6, SD-1) — the next cycle invoice grants
// the new plan's full allotment, avoiding a double-grant. Any other reason (manual, etc.) grants nothing.
const GRANTING_REASONS = new Set(["subscription_create", "subscription_cycle"]);

/**
 * Apply a verified domain billing event. A gated `invoice.paid` does TWO things atomically (one
 * transaction): grants the cycle credit allotment AND grants the plan's entitlements (ADR-0071 — the
 * purchased ids the plan covers, expanded to member slugs at gate time). The credit grant is
 * idempotent on the Stripe invoice id; the entitlement grant is idempotent on
 * (account_id, entitlement_id) — so both a webhook retry and a renewal re-grant are no-ops. Every
 * other event is a deliberate no-op here. Credits are append-only / no-clawback; entitlements are
 * mutable state but
 * REVOKE-on-cancel is a follow-on slice (needs subscription→entitlement provenance not on the current
 * cancel event), so a cancel here still negates nothing.
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
      // Grant the plan's edition/bundle/module entitlements (ADR-0071). Idempotent on
      // (account, entitlement_id), so each renewal cycle re-confirms the same access as a no-op. A
      // credits-only plan carries `entitlements: []` → this is a no-op. The store holds the PURCHASED
      // IDS; the index expands them to member slugs at the gate (resolveAccountEntitlements / Worker).
      await grantEntitlements(tx, {
        accountId: ev.accountId,
        entitlementIds: plan.entitlements,
        sourceEventId: ev.invoiceId,
      });
      return;
    }
    // Lifecycle + one-time signals: no recurring grant here.
    case "purchase.completed": // one-time edition/bundle entitlement -> needs line-item enrichment (follow-on)
    case "subscription.created": // signup only — granting here would never renew (the X-2 trap)
    case "subscription.updated": // plan change recorded; proration grant is the deferred SD-1
    case "subscription.canceled": // access-revoke is a follow-on (needs sub→entitlement provenance)
      return;
    default: {
      // Exhaustiveness guard: a future DomainBillingEvent member forces an explicit decision here
      // rather than silently no-op'ing (the silent-miss class this mapper exists to prevent).
      const _exhaustive: never = ev;
      return _exhaustive;
    }
  }
}
