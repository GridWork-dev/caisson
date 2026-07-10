// ADR-0316 W-FLEET — the /architecture live-overlay read. GitHub-OAuth-gated (ADR-0283) like every
// admin route (requireAdmin re-verifies the session; the proxy header is never trusted). READ-ONLY:
// returns per-service Railway deploy status + the registry Worker's CF request/error counts, both
// env-gated inert + cached 60s in lib/fleet-reads. `no-store` (from json()) so a browser never
// caches a stale overlay on top of the module TTL.
import { json, requireAdmin } from "@/lib/admin-route";
import { fetchFleetSnapshot } from "@/lib/fleet-reads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const actor = await requireAdmin(req);
  if (actor === null) return json({ error: "unauthorized" }, 401);
  const snapshot = await fetchFleetSnapshot();
  return json(snapshot);
}
