// Billing webhook Route Handler — a STUB wired against the open `BillingProvider` PORT
// (@caisson-sh/billing, ADR-0017): `verifyAndParse` turns a raw provider payload into the
// provider-agnostic `DomainBillingEvent`. The port's concrete driver factories (Stripe/Paddle/
// LemonSqueezy/Polar) are the commercial `@caisson-sh/billing-orchestration` package — swap
// `getBillingProvider()` for one of those (or your own port implementation, using the open raw
// verifiers `verifyStripeWebhook`/`verifyPaddleWebhook`/… also exported from `@caisson-sh/billing`).
import type { NextRequest } from "next/server";
import type { BillingProvider } from "@caisson-sh/billing";
import { toErrorResponse } from "@caisson-sh/kernel";

function getBillingProvider(): BillingProvider {
  throw new Error(
    "wire a BillingProvider driver here — e.g. @caisson-sh/billing-orchestration's createStripeBilling()",
  );
}

export async function POST(request: NextRequest): Promise<Response> {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";

  try {
    const event = getBillingProvider().verifyAndParse(rawBody, signature);
    if (event === null) {
      // An event type this provider maps to `null` on purpose — ack, no-op.
      return new Response(null, { status: 200 });
    }

    switch (event.type) {
      case "purchase.completed":
      case "subscription.created":
        // Wire your entitlement/credit grant here (see @caisson-sh/credits for the ledger primitive).
        break;
      case "subscription.updated":
      case "subscription.canceled":
      case "refund.completed":
      case "invoice.paid":
        // Wire the matching downstream effect for this event.
        break;
    }

    return new Response(null, { status: 200 });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return Response.json(body, { status });
  }
}
