import { NotFoundError, ValidationError } from "@caisson/kernel";
import { wormAnchorAccount } from "@caisson/service-license";
import { z, ZodError } from "zod";
import { json } from "@/lib/admin-route";
import { getAdminMutationDeps } from "@/lib/admin-mutations-runtime";
import {
  latestEvidencePackResponseSchema,
  readLatestEvidencePack,
} from "@/lib/evidence-pack-pointer";
import {
  assembleProofSuccess,
  ProofSuccessSchema,
  ProofUnverifiableSchema,
} from "@/lib/audit-proof";
import {
  authenticateInternalProofRequest,
  parseInternalProofAuthConfig,
} from "@/lib/internal-proof-auth";
import { checkInternalProofRateLimit } from "@/lib/internal-proof-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const rowProofRequestSchema = z
  .object({
    seq: z.number().int().nonnegative(),
  })
  .strict();
const latestEvidencePackRequestSchema = z
  .object({
    kind: z.literal("latest-evidence-pack"),
  })
  .strict();
const requestSchema = z.union([
  rowProofRequestSchema,
  latestEvidencePackRequestSchema,
]);

function respond(body: unknown, status = 200): Response {
  const response = json(body, status);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Vary", "Authorization, X-Caisson-Account-Id");
  return response;
}

type InternalProofMutationDeps = Pick<
  Awaited<ReturnType<typeof getAdminMutationDeps>>,
  "worm"
>;

export interface InternalProofRouteDependencies {
  readonly proxySecret: () => string | undefined;
  readonly internalHost: () => string | undefined;
  readonly checkRateLimit: (
    accountId: string,
  ) => Promise<{ readonly allowed: boolean; readonly retryAfterSec: number }>;
  readonly getMutationDeps: () => Promise<InternalProofMutationDeps>;
  readonly readLatestEvidencePack: typeof readLatestEvidencePack;
}

export function createInternalProofRoute(
  dependencies: InternalProofRouteDependencies,
): (req: Request) => Promise<Response> {
  return async (req) => {
    const authConfig = parseInternalProofAuthConfig({
      secret: dependencies.proxySecret(),
      internalHost: dependencies.internalHost(),
    });
    if (authConfig === null) {
      return respond({ error: "proof proxy unavailable" }, 503);
    }

    const authenticated = authenticateInternalProofRequest(req, authConfig);
    if (authenticated === null) {
      return respond({ error: "unauthorized" }, 401);
    }
    const { accountId } = authenticated;

    const rate = await dependencies.checkRateLimit(accountId);
    if (!rate.allowed) {
      const response = respond({ error: "rate limited" }, 429);
      response.headers.set("Retry-After", String(rate.retryAfterSec));
      return response;
    }

    let input: z.infer<typeof requestSchema>;
    try {
      input = requestSchema.parse(await req.json());
    } catch (error) {
      const issues = error instanceof ZodError ? error.issues : undefined;
      return respond({ error: "invalid request", issues }, 400);
    }

    try {
      if ("kind" in input) {
        return respond(
          latestEvidencePackResponseSchema.parse(
            await dependencies.readLatestEvidencePack(accountId),
          ),
        );
      }
      const deps = await dependencies.getMutationDeps();
      const anchorAccountId = wormAnchorAccount(accountId);
      const entries = await deps.worm.load(anchorAccountId);
      if (entries.length === 0) {
        throw new NotFoundError("audit chain not found");
      }
      const proof = await deps.worm.getRowProof(anchorAccountId, input.seq);
      if ("unverifiable" in proof) {
        return respond(
          ProofUnverifiableSchema.parse({
            state: "unverifiable",
            reason: proof.reason,
          }),
        );
      }
      return respond(
        ProofSuccessSchema.parse(await assembleProofSuccess(proof, new Date())),
      );
    } catch (error) {
      if (error instanceof NotFoundError) {
        return respond({ error: "not found" }, 404);
      }
      if (error instanceof ValidationError || error instanceof ZodError) {
        return respond({ error: "invalid request" }, 400);
      }
      return respond({ error: "proof unavailable" }, 503);
    }
  };
}

export const POST = createInternalProofRoute({
  proxySecret: () => process.env.CAISSON_PROOF_PROXY_SECRET,
  internalHost: () => process.env.CAISSON_PROOF_PROXY_INTERNAL_HOST,
  checkRateLimit: async (accountId) => checkInternalProofRateLimit(accountId),
  getMutationDeps: getAdminMutationDeps,
  readLatestEvidencePack,
});
