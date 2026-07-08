// ADR-0292 action 6 — the admin first-mint lever (buyer-lifecycle audit G1's operational rescue
// path). GitHub-OAuth-gated (ADR-0283), one target account, Zod `.strict()` body. Guards run BEFORE
// the mutation: a (account, major) that already HAS a license grant is the wrong lever (reissue is)
// so this 409s; an account with no active entitlements is nothing to license, so this 400s. Neither
// guard is a security boundary by itself — `firstMintLicenseAdmin`'s own `/issue` call is the real
// authority — they exist to keep the operator from minting a stray token or a redundant one.
import {
  FirstMintLicenseBody,
  firstMintLicenseAdmin,
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
  readLicenseForReissue,
} from "@/lib/admin-mutations-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const actor = await requireAdmin(req);
  if (actor === null) return json({ error: "unauthorized" }, 401);
  const parsed = await parseBody(req, FirstMintLicenseBody);
  if (!parsed.ok) return parsed.response;
  const { targetAccountId, major } = parsed.value;
  try {
    const existing = await readLicenseForReissue(targetAccountId, major);
    if (existing !== null) {
      return json(
        {
          error:
            "a license grant already exists for that account and major — use reissue, not first-mint",
        },
        409,
      );
    }
    const entitlementIds = await readActiveEntitlementIds(targetAccountId);
    if (entitlementIds.length === 0) {
      return json(
        { error: "account holds no active entitlements — nothing to license" },
        400,
      );
    }
    const deps = await getAdminMutationDeps();
    const result = await firstMintLicenseAdmin(deps, {
      actorEmail: actor,
      targetAccountId,
      major,
    });
    return mutationResponse(result);
  } catch (err) {
    return mutationErrorResponse(err);
  }
}
