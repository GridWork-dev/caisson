// The billing-webhook entry for services/license (ADR-0089/0017). Verifies + parses the raw Stripe
// webhook through the injected BillingProvider port (no Stripe type escapes @caisson/billing), then
// applies the domain event inside withTenant so the credit grant is RLS-scoped to the buyer's account.
// The provider is INJECTED (not constructed here) so the handler is testable without a live HMAC secret
// and the MoR driver stays swappable (ADR-0017). A bad signature throws (AuthnError) BEFORE any DB work.
import type { BillingProvider, DomainBillingEvent } from "@caisson/billing";
import { InternalError } from "@caisson/kernel";
import { type Transactor, withTenant } from "@caisson/tenancy-rls";
import { applyBillingEvent } from "./apply-billing-event.ts";

export interface BillingWebhookResult {
  /** The mapped domain event, or null for an event type we don't act on. */
  event: DomainBillingEvent | null;
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
  if (event === null) return { event };
  if (event.accountId === "") {
    process.stderr.write(
      `[service-license] ALERT: verified ${event.type} (sourceEventId=${event.sourceEventId}) has no resolvable account_id — purchase unattributed, NOT granted\n`,
    );
    throw new InternalError(
      "verified billing event has no resolvable account id",
    );
  }
  await withTenant(pg, event.accountId, (tx) => applyBillingEvent(tx, event));
  return { event };
}
