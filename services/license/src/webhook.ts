// The billing-webhook entry for services/license (ADR-0089/0017). Verifies + parses the raw Stripe
// webhook through the injected BillingProvider port (no Stripe type escapes @caisson/billing), then
// applies the domain event inside withTenant so the credit grant is RLS-scoped to the buyer's account.
// The provider is INJECTED (not constructed here) so the handler is testable without a live HMAC secret
// and the MoR driver stays swappable (ADR-0017). A bad signature throws (AuthnError) BEFORE any DB work.
import type { BillingProvider, DomainBillingEvent } from "@caisson/billing";
import { type Transactor, withTenant } from "@caisson/tenancy-rls";
import { applyBillingEvent } from "./apply-billing-event.ts";

export interface BillingWebhookResult {
  /** The mapped domain event, or null for an event type we don't act on. */
  event: DomainBillingEvent | null;
}

/**
 * Handle a raw Stripe billing webhook: verify+parse via the port, then (for an actionable event with a
 * resolvable account) run the cycle->grant mapper inside withTenant. A bad signature throws before any
 * DB work (fail-closed). An event we don't act on (null) or one missing an account id is a no-op
 * success — Stripe gets its 2xx and does not retry.
 */
export async function handleBillingWebhook(
  pg: Transactor,
  provider: BillingProvider,
  rawBody: string,
  signatureHeader: string,
): Promise<BillingWebhookResult> {
  const event = provider.verifyAndParse(rawBody, signatureHeader);
  if (event === null || event.accountId === "") return { event };
  await withTenant(pg, event.accountId, (tx) => applyBillingEvent(tx, event));
  return { event };
}
