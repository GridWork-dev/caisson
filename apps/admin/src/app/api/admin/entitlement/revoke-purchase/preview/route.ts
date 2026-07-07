// ADR-0225 R-6 — the paid-revoke IMPACT PREVIEW read. A cross-tenant `admin`-role read (never a
// mutation) the UI card MUST load before the confirm arms: the account's active one-time purchases
// (the picker), and per source the entitlements dropping vs surviving (refcount) + the exact credit
// claw the revoke would run + the held-license set the edge deny-set would carry. GitHub-OAuth-gated
// (ADR-0283) and actor-required exactly like the mutation routes — the operator cockpit is
// operator-only.
import { z } from "zod";
import {
  json,
  mutationErrorResponse,
  parseBody,
  requireAdmin,
} from "@/lib/admin-route";
import { readAdmin } from "@/lib/admin-db";
import { previewAccountPurchaseRevokes } from "@/lib/business-reads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PreviewBody = z
  .object({ targetAccountId: z.string().trim().min(1).max(256) })
  .strict();

export async function POST(req: Request): Promise<Response> {
  const actor = await requireAdmin(req);
  if (actor === null) return json({ error: "unauthorized" }, 401);
  const parsed = await parseBody(req, PreviewBody);
  if (!parsed.ok) return parsed.response;
  try {
    const preview = await readAdmin((tx) =>
      previewAccountPurchaseRevokes(tx, parsed.value.targetAccountId),
    );
    return json(preview);
  } catch (err) {
    return mutationErrorResponse(err);
  }
}
