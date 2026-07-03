// ADR-0225 action 5 — paid one-time purchase revoke (the fraud / chargeback-received / ToS-ban
// lever that strips REAL paid access WITHOUT a Paddle refund). CF-Access-gated, one target account,
// Zod `.strict()` body (`revokePurchaseAdmin` composes source-scoped revoke + opt-in bounded claw +
// opt-in edge deny-set truth in one `withAdminWrite` tx, dual-logged). A committed-but-WORM-failed
// result flows through `mutationResponse` (do-not-retry 200); a PRE-commit throw — including the
// CAISSON-9 `NotFoundError` on a nonexistent account — maps through `mutationErrorResponse` (404 /
// 500), never a blind 500.
import {
  RevokePurchaseBody,
  revokePurchaseAdmin,
} from "@caisson/service-license";
import {
  actorEmail,
  json,
  mutationErrorResponse,
  mutationResponse,
  parseBody,
} from "@/lib/admin-route";
import { getAdminMutationDeps } from "@/lib/admin-mutations-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const actor = actorEmail(req);
  if (actor === null) return json({ error: "unauthorized" }, 401);
  const parsed = await parseBody(req, RevokePurchaseBody);
  if (!parsed.ok) return parsed.response;
  try {
    const deps = await getAdminMutationDeps();
    const result = await revokePurchaseAdmin(deps, {
      actorEmail: actor,
      ...parsed.value,
    });
    return mutationResponse(result);
  } catch (err) {
    return mutationErrorResponse(err);
  }
}
