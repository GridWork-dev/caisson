// ADR-0316 F5 — mark an intel finding dismissed. GitHub-OAuth-gated (ADR-0283), Zod `.strict()`
// body, dual-logged (admin_action_log + WORM) exactly like every other operator mutation.
import {
  json,
  mutationErrorResponse,
  mutationResponse,
  parseBody,
  requireAdmin,
} from "@/lib/admin-route";
import { getAdminMutationDeps } from "@/lib/admin-mutations-runtime";
import { TriageFindingBody, dismissFindingAdmin } from "@/lib/intel-triage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const actor = await requireAdmin(req);
  if (actor === null) return json({ error: "unauthorized" }, 401);
  const parsed = await parseBody(req, TriageFindingBody);
  if (!parsed.ok) return parsed.response;
  try {
    const deps = await getAdminMutationDeps();
    const result = await dismissFindingAdmin(deps, {
      actorEmail: actor,
      ...parsed.value,
    });
    return mutationResponse(result);
  } catch (err) {
    return mutationErrorResponse(err);
  }
}
