// POST /api/checkout/started — the abandoned-checkout capture point (SPEC
// outputs/specs/deferred-respec/SPEC-abandoned-checkout-email.md §(a), operator-locked
// 2026-07-10). Called from `cart-checkout-panel.tsx`'s `pay()` right before `openCartCheckout` —
// the SAME authenticated request context `requireDashboardSession` already established for the
// page, so `accountId` needs no re-derivation and is never trusted from the request body. Fire-
// and-forget on the client; a DB failure here just means no nudge email, never a blocked checkout.
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { recordCheckoutAbandonment } from "@caisson/service-license";
import { getSession } from "@/lib/auth";
import { readScoped } from "@/lib/db";

// Authed + tenant-scoped write — never statically cached.
export const dynamic = "force-dynamic";

const CheckoutStartedBody = z
  .object({
    items: z
      .array(
        z
          .object({
            id: z.string().trim().min(1).max(128),
            label: z.string().trim().min(1).max(200),
          })
          .strict(),
      )
      .min(1)
      .max(50),
  })
  .strict();

export async function POST(request: Request): Promise<NextResponse> {
  const session = await getSession();
  if (session === null) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const parsed = CheckoutStartedBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  await readScoped(session.accountId, (tx) =>
    recordCheckoutAbandonment(tx, {
      id: randomUUID(),
      accountId: session.accountId,
      items: parsed.data.items,
    }),
  );

  return NextResponse.json({ ok: true });
}
