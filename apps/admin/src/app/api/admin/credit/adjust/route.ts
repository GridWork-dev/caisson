// ADR-0220 action 3 — credit adjust (± integer, billing-error correction). CF-Access-gated, one
// target account, Zod `.strict()` body, integer credits (never a float, never a negative wallet),
// dual-logged.
import {
  AdjustCreditsBody,
  adjustCreditsAdmin,
} from "@caisson/service-license";
import { actorEmail, json, parseBody } from "@/lib/admin-route";
import { getAdminMutationDeps } from "@/lib/admin-mutations-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const actor = actorEmail(req);
  if (actor === null) return json({ error: "unauthorized" }, 401);
  const parsed = await parseBody(req, AdjustCreditsBody);
  if (!parsed.ok) return parsed.response;
  try {
    const deps = await getAdminMutationDeps();
    const result = await adjustCreditsAdmin(deps, {
      actorEmail: actor,
      ...parsed.value,
    });
    return json(result);
  } catch {
    return json({ error: "mutation failed" }, 500);
  }
}
