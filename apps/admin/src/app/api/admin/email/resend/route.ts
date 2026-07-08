// G40 — resend a purchase-confirmation-style email to an account's own resolved address.
// GitHub-OAuth-gated (ADR-0283), one target account, Zod `.strict()` body. The account's CURRENT
// active entitlements are resolved here (the ADR-0141 admin read role) and passed into the
// orchestration function, mirroring how reissue's tier/expiry are route-resolved inputs, not body
// fields.
import {
  ResendPurchaseEmailBody,
  resendPurchaseEmailAdmin,
} from "@caisson/service-license";
import {
  json,
  mutationErrorResponse,
  mutationResponse,
  parseBody,
  requireAdmin,
} from "@/lib/admin-route";
import {
  getAdminMutationDeps,
  readActiveEntitlementIds,
} from "@/lib/admin-mutations-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// IN-01 — per-account resend throttle: at most one resend per account per minute, so a mis-click
// (or a scripted loop) can't spam an account's inbox. ponytail: a bare module-level Map, single
// process/single Railway instance only (no shared store) — fine for this operator-only,
// single-replica admin app; swap for the account-store package's Postgres-backed limiter if this
// app ever runs more than one instance.
const RESEND_THROTTLE_MS = 60_000;
const lastResendAt = new Map<string, number>();

function isThrottled(targetAccountId: string): boolean {
  const now = Date.now();
  const last = lastResendAt.get(targetAccountId);
  if (last !== undefined && now - last < RESEND_THROTTLE_MS) return true;
  lastResendAt.set(targetAccountId, now);
  return false;
}

export async function POST(req: Request): Promise<Response> {
  const actor = await requireAdmin(req);
  if (actor === null) return json({ error: "unauthorized" }, 401);
  const parsed = await parseBody(req, ResendPurchaseEmailBody);
  if (!parsed.ok) return parsed.response;
  const { targetAccountId, orderId } = parsed.value;
  if (isThrottled(targetAccountId)) {
    return json(
      { error: "resend throttled: at most one resend per account per minute" },
      429,
    );
  }
  try {
    const entitlementIds = await readActiveEntitlementIds(targetAccountId);
    const deps = await getAdminMutationDeps();
    const result = await resendPurchaseEmailAdmin(deps, {
      actorEmail: actor,
      targetAccountId,
      ...(orderId === undefined ? {} : { orderId }),
      entitlementIds,
    });
    return mutationResponse(result);
  } catch (err) {
    return mutationErrorResponse(err);
  }
}
