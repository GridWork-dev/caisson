// POST /api/subscription/cancel — G14 (ADR-0293): self-serve subscription cancel. Calls Paddle's
// server-side cancel endpoint directly (fetchWithTimeout, no client-side Paddle credentials) to
// schedule cancellation at the end of the current billing period. This route NEVER revokes the
// entitlement/subscription-status row locally — cancellation truth still arrives via the
// `subscription.canceled` webhook (ADR-0293 binding, apply-billing-event.ts); it only asks Paddle to
// schedule the cancel and reports Paddle's own scheduled-change instant back to the UI.
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession, isOwner } from "@/lib/auth";
import { readScoped } from "@/lib/db";
import { readSubscriptionStatuses } from "@/lib/dashboard-reads";
import { cancelPaddleSubscription } from "@/lib/paddle-cancel";
import { cancelSubscriptionForAccount } from "@/lib/subscription-cancel";

// Authed + tenant-scoped + calls an external API — never statically cached.
export const dynamic = "force-dynamic";

const CancelBody = z
  .object({ subscriptionId: z.string().trim().min(1).max(128) })
  .strict();

export async function POST(request: Request): Promise<NextResponse> {
  const session = await getSession();
  if (session === null) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  // Owner-only: canceling a subscription is a billing-sensitive org mutation, same gate BYOK
  // rotation and compliance-attestation writes use (a seat member must not cut off the org's paid
  // access).
  if (!isOwner(session)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const parsed = CancelBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const outcome = await cancelSubscriptionForAccount(
    session.accountId,
    parsed.data.subscriptionId,
    {
      readStatuses: (accountId) =>
        readScoped(accountId, (tx) => readSubscriptionStatuses(tx, accountId)),
      cancelPaddle: cancelPaddleSubscription,
    },
  );
  if (!outcome.ok) {
    return NextResponse.json(
      { error: outcome.reason },
      { status: outcome.httpStatus },
    );
  }
  return NextResponse.json({
    status: outcome.status,
    effectiveAt: outcome.effectiveAt,
  });
}
