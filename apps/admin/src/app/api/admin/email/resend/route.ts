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

export async function POST(req: Request): Promise<Response> {
  const actor = await requireAdmin(req);
  if (actor === null) return json({ error: "unauthorized" }, 401);
  const parsed = await parseBody(req, ResendPurchaseEmailBody);
  if (!parsed.ok) return parsed.response;
  const { targetAccountId, orderId } = parsed.value;
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
