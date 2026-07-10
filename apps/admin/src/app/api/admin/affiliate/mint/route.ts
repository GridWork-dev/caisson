// ADR-0315/0319 — mint an affiliate discount code. GitHub-OAuth-gated (ADR-0283), Zod `.strict()`
// body, dual-logged. The orchestrator (mintAffiliateCodeAdmin) calls the injected mint proxy (which
// holds PADDLE_API_KEY on the license service — never here) then registers the affiliate_code row +
// audit log as admin_write.
import {
  MintAffiliateCodeBody,
  mintAffiliateCodeAdmin,
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
  const parsed = await parseBody(req, MintAffiliateCodeBody);
  if (!parsed.ok) return parsed.response;
  try {
    const deps = await getAdminMutationDeps();
    const result = await mintAffiliateCodeAdmin(deps, {
      actorEmail: actor,
      ...parsed.value,
    });
    return mutationResponse(result);
  } catch (err) {
    return mutationErrorResponse(err);
  }
}
