// License rotation v2 — TRUE key rotation, the compromised-key lever reissue v1 (a re-serve)
// cannot cover: the stored grant's OLD licenseId enters the edge deny-set (revoke committed FIRST),
// then a FRESH key is minted through the server-side `/issue` proxy with `rotate: true` under the
// DISTINCT admin credential. Session-gated, one target account, Zod `.strict()` body. A (account,
// major) with no stored grant 404s — there is no key to rotate; first-mint is that lever.
// Dual-logged; the deny-set is republished to the edge post-commit, best-effort.
import {
  RotateLicenseBody,
  rotateLicenseAdmin,
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
  readLicenseForReissue,
} from "@/lib/admin-mutations-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const actor = await requireAdmin(req);
  if (actor === null) return json({ error: "unauthorized" }, 401);
  const parsed = await parseBody(req, RotateLicenseBody);
  if (!parsed.ok) return parsed.response;
  const { targetAccountId, major, reason } = parsed.value;
  try {
    const existing = await readLicenseForReissue(targetAccountId, major);
    if (existing === null) {
      return json(
        {
          error:
            "no license grant for that account and major — rotation replaces an existing key only (use first-mint when none exists)",
        },
        404,
      );
    }
    const deps = await getAdminMutationDeps();
    const result = await rotateLicenseAdmin(deps, {
      actorEmail: actor,
      targetAccountId,
      major,
      ...(reason !== undefined ? { reason } : {}),
      tier: existing.tier,
      expiry: existing.expiry,
      oldLicenseId: existing.licenseId,
    });
    return mutationResponse(result);
  } catch (err) {
    return mutationErrorResponse(err);
  }
}
