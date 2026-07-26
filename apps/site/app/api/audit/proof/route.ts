import { z } from "zod";
import { getSession } from "@/lib/auth";
import {
  TenantEvidenceProxyError,
  type TenantProofResponse,
} from "@/lib/tenant-evidence";
import {
  assertTenantEvidenceScope,
  tenantEvidenceProxyFromEnv,
} from "@/lib/tenant-evidence-runtime";
import { checkTenantEvidenceRateLimit } from "@/lib/tenant-evidence-rate-limit";

export const dynamic = "force-dynamic";

const querySchema = z
  .object({
    seq: z
      .string()
      .regex(/^(0|[1-9][0-9]*)$/)
      .transform(Number)
      .pipe(z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)),
  })
  .strict();

export interface TenantProofRouteDependencies {
  readonly getSession: typeof getSession;
  readonly assertTenantScope: (accountId: string) => Promise<void>;
  readonly checkRateLimit: (
    accountId: string,
  ) => Promise<{ readonly allowed: boolean; readonly retryAfterSec: number }>;
  readonly getProof: (
    accountId: string,
    seq: number,
  ) => Promise<TenantProofResponse>;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "strict-transport-security": "max-age=31536000; includeSubDomains",
    },
  });
}

export function createTenantProofRoute(
  dependencies: TenantProofRouteDependencies,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const url = new URL(request.url);
    const entries = [...url.searchParams.entries()];
    if (entries.length !== 1) {
      return json({ error: "invalid request" }, 400);
    }
    const parsed = querySchema.safeParse(Object.fromEntries(entries));
    if (!parsed.success) {
      return json({ error: "invalid request" }, 400);
    }

    const session = await dependencies.getSession();
    if (session === null) {
      return json({ error: "unauthenticated" }, 401);
    }

    const rate = await dependencies.checkRateLimit(session.accountId);
    if (!rate.allowed) {
      const response = json({ error: "rate limited" }, 429);
      response.headers.set("Retry-After", String(rate.retryAfterSec));
      return response;
    }

    try {
      await dependencies.assertTenantScope(session.accountId);
    } catch {
      return json({ error: "forbidden" }, 403);
    }

    try {
      return json(
        await dependencies.getProof(session.accountId, parsed.data.seq),
        200,
      );
    } catch (error) {
      if (
        error instanceof TenantEvidenceProxyError &&
        error.kind === "not-found"
      ) {
        return json({ error: "not found" }, 404);
      }
      return json({ error: "proof unavailable" }, 503);
    }
  };
}

export const GET = createTenantProofRoute({
  getSession,
  assertTenantScope: assertTenantEvidenceScope,
  checkRateLimit: async (accountId) => checkTenantEvidenceRateLimit(accountId),
  getProof: (accountId, seq) =>
    tenantEvidenceProxyFromEnv().getProof(accountId, seq),
});
