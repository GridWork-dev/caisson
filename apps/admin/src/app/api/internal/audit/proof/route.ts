import { createHmac, timingSafeEqual } from "node:crypto";
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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const accountHeaderSchema = z
  .object({
    accountId: z
      .string()
      .trim()
      .min(1)
      .max(256)
      .refine(
        // eslint-disable-next-line no-control-regex -- reject C0/C1 controls and whitespace in the server-derived account id.
        (value) => !/[\u0000-\u001f\u007f-\u009f\s]/.test(value),
        "account id has whitespace or control characters",
      ),
  })
  .strict();

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

const proxySecretSchema = z.string().trim().min(32).max(4096);
const BEARER = /^Bearer ([0-9a-f]{64})$/;

function respond(body: unknown, status = 200): Response {
  const response = json(body, status);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Vary", "Authorization, X-Caisson-Account-Id");
  return response;
}

function expectedCredential(accountId: string, secret: string): Buffer {
  return Buffer.from(
    createHmac("sha256", secret).update(accountId).digest("hex"),
    "utf8",
  );
}

function hasValidCredential(
  authorization: string | null,
  accountId: string,
  secret: string,
): boolean {
  const match = authorization?.match(BEARER);
  if (match === undefined || match === null) return false;
  const supplied = Buffer.from(match[1] ?? "", "utf8");
  const expected = expectedCredential(accountId, secret);
  return (
    supplied.length === expected.length && timingSafeEqual(supplied, expected)
  );
}

type InternalProofMutationDeps = Pick<
  Awaited<ReturnType<typeof getAdminMutationDeps>>,
  "worm"
>;

export interface InternalProofRouteDependencies {
  readonly proxySecret: () => string | undefined;
  readonly getMutationDeps: () => Promise<InternalProofMutationDeps>;
  readonly readLatestEvidencePack: typeof readLatestEvidencePack;
}

export function createInternalProofRoute(
  dependencies: InternalProofRouteDependencies,
): (req: Request) => Promise<Response> {
  return async (req) => {
    const secretResult = proxySecretSchema.safeParse(
      dependencies.proxySecret(),
    );
    if (!secretResult.success) {
      return respond({ error: "proof proxy unavailable" }, 503);
    }

    let accountId: string;
    try {
      accountId = accountHeaderSchema.parse({
        accountId: req.headers.get("x-caisson-account-id"),
      }).accountId;
    } catch {
      return respond({ error: "invalid request" }, 400);
    }

    if (
      !hasValidCredential(
        req.headers.get("authorization"),
        accountId,
        secretResult.data,
      )
    ) {
      return respond({ error: "unauthorized" }, 401);
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
  getMutationDeps: getAdminMutationDeps,
  readLatestEvidencePack,
});
