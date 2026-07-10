// The operator read-only lever. GET reads the current system write-mode; POST flips it (a
// maintenance/incident switch ONLY — never derived from billing/dunning state). Session-gated like
// every mutation route, Zod `.strict()` body, dual-logged by the service (the mode's persisted
// source IS the latest `system_mode` action-log row). Flipping back to `active` is deliberately
// possible while the system is read-only — the lever is the un-brick path.
import {
  SetSystemModeBody,
  readSystemMode,
  setSystemModeAdmin,
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

export async function GET(req: Request): Promise<Response> {
  const actor = await requireAdmin(req);
  if (actor === null) return json({ error: "unauthorized" }, 401);
  try {
    const deps = await getAdminMutationDeps();
    return json({ mode: await readSystemMode(deps.db) });
  } catch (err) {
    return mutationErrorResponse(err);
  }
}

export async function POST(req: Request): Promise<Response> {
  const actor = await requireAdmin(req);
  if (actor === null) return json({ error: "unauthorized" }, 401);
  const parsed = await parseBody(req, SetSystemModeBody);
  if (!parsed.ok) return parsed.response;
  try {
    const deps = await getAdminMutationDeps();
    const result = await setSystemModeAdmin(deps, {
      actorEmail: actor,
      mode: parsed.value.mode,
    });
    return mutationResponse(result);
  } catch (err) {
    return mutationErrorResponse(err);
  }
}
