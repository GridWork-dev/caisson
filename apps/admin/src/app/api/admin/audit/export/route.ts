import { withAdminWrite } from "@caisson/org-controls";
import type { RateDecision } from "@caisson/rate-limit";
import {
  insertAdminActionLog,
  wormAnchorAccount,
} from "@caisson/service-license";
import { z, ZodError } from "zod";
import { json, requireAdmin } from "@/lib/admin-route";
import { getAdminMutationDeps } from "@/lib/admin-mutations-runtime";
import { buildAdminAuditWindow } from "@/lib/audit-window";
import { adminAuditAnchorTrustFromEnv } from "@/lib/audit-anchor-trust";
import { checkAdminAuditWindowRateLimit } from "@/lib/admin-audit-window-rate-limit";
import { AuditProofAccount } from "@/lib/audit-proof";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const exportQuerySchema = z
  .object({
    account: AuditProofAccount,
  })
  .strict();

function respond(body: unknown, status = 200): Response {
  const response = json(body, status);
  response.headers.set("Vary", "Cookie");
  return response;
}

export interface AdminAuditExportRouteDependencies {
  readonly authenticate: (request: Request) => Promise<string | null>;
  readonly checkRateLimit: (
    actor: string,
    accountId: string,
  ) => RateDecision | Promise<RateDecision>;
}

const productionDependencies: AdminAuditExportRouteDependencies = {
  authenticate: requireAdmin,
  checkRateLimit: checkAdminAuditWindowRateLimit,
};

export function createAdminAuditExportRoute(
  routeDependencies: AdminAuditExportRouteDependencies,
): (request: Request) => Promise<Response> {
  return async (req) => {
    const actor = await routeDependencies.authenticate(req);
    if (actor === null) {
      return respond({ error: "unauthorized" }, 401);
    }

    let account: string;
    try {
      account = exportQuerySchema.parse(
        Object.fromEntries(new URL(req.url).searchParams),
      ).account;
    } catch (error) {
      return respond(
        {
          error: "invalid request",
          issues: error instanceof ZodError ? error.issues : undefined,
        },
        400,
      );
    }

    const rate = await routeDependencies.checkRateLimit(actor, account);
    if (!rate.allowed) {
      const response = respond({ error: "rate limited" }, 429);
      response.headers.set("Retry-After", String(rate.retryAfterSec));
      return response;
    }

    const deps = await getAdminMutationDeps();
    const anchorTrust = adminAuditAnchorTrustFromEnv();
    const window = await buildAdminAuditWindow({
      source: deps.worm,
      accountId: wormAnchorAccount(account),
      tenantId: account,
      now: new Date(),
      ...(anchorTrust === null ? {} : { anchorAuth: anchorTrust.pinnedKey }),
    });

    try {
      await withAdminWrite(deps.db, (tx) =>
        insertAdminActionLog(tx, {
          actorEmail: actor,
          targetAccountId: account,
          action: "audit_proof_read",
          before: null,
          after: {
            source: "export",
            range: "full",
            chainLength: window.entries.length,
          },
        }),
      );
    } catch {
      /* Access logging is best-effort for a read-only verdict. */
    }

    if (window.entries.length === 0) {
      return respond({ error: "not found" }, 404);
    }
    if (window.evidencePack === null) {
      return respond({ error: "evidence pack unavailable" }, 503);
    }
    return respond(window.evidencePack);
  };
}

export const GET = createAdminAuditExportRoute(productionDependencies);
