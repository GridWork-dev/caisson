// ADR-0220 action 4 — license reissue (re-serve a lost key). CF-Access-gated, one target account,
// Zod `.strict()` body. v1 re-serves the buyer's EXISTING token for (account, major) via the
// server-side `/issue` proxy under the DISTINCT admin credential; a (account, major) with no stored
// grant 404s (true key rotation is a deferred follow-up). Dual-logged.
import {
  ReissueLicenseBody,
  reissueLicenseAdmin,
} from "@caisson/service-license";
import {
  actorEmail,
  json,
  mutationResponse,
  parseBody,
} from "@/lib/admin-route";
import {
  getAdminMutationDeps,
  readLicenseForReissue,
} from "@/lib/admin-mutations-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const actor = actorEmail(req);
  if (actor === null) return json({ error: "unauthorized" }, 401);
  const parsed = await parseBody(req, ReissueLicenseBody);
  if (!parsed.ok) return parsed.response;
  const { targetAccountId, major } = parsed.value;
  try {
    const existing = await readLicenseForReissue(targetAccountId, major);
    if (existing === null) {
      return json(
        {
          error:
            "no license grant for that account and major — v1 reissue re-serves an existing token only",
        },
        404,
      );
    }
    const deps = await getAdminMutationDeps();
    const result = await reissueLicenseAdmin(deps, {
      actorEmail: actor,
      targetAccountId,
      major,
      tier: existing.tier,
      expiry: existing.expiry,
    });
    return mutationResponse(result);
  } catch {
    return json({ error: "reissue failed" }, 500);
  }
}
