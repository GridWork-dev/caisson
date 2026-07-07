// ADR-0220 action 2 — entitlement revoke (undo an operator comp). GitHub-OAuth-gated (ADR-0283),
// one target account, Zod `.strict()` body, dual-logged.
import {
  RevokeEntitlementBody,
  revokeEntitlementAdmin,
} from "@caisson/service-license";
import {
  json,
  mutationErrorResponse,
  mutationResponse,
  parseBody,
  requireAdmin,
} from "@/lib/admin-route";
import { getAdminMutationDeps } from "@/lib/admin-mutations-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const actor = await requireAdmin(req);
  if (actor === null) return json({ error: "unauthorized" }, 401);
  const parsed = await parseBody(req, RevokeEntitlementBody);
  if (!parsed.ok) return parsed.response;
  try {
    const deps = await getAdminMutationDeps();
    const result = await revokeEntitlementAdmin(deps, {
      actorEmail: actor,
      ...parsed.value,
    });
    return mutationResponse(result);
  } catch (err) {
    return mutationErrorResponse(err);
  }
}
