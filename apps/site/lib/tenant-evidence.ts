import { createHmac } from "node:crypto";
import {
  evidencePackManifestSchema,
  parseEvidencePackManifest,
  type CrosswalkRollupCell,
  type EvidencePackManifest,
} from "@caisson/compliance-core";
import { fetchWithTimeout, parseStrict, strictObject } from "@caisson/kernel";
import { z } from "zod";

const proxyUrl = z
  .string()
  .url()
  .max(2048)
  .refine((value) => {
    const url = new URL(value);
    return (
      url.username === "" &&
      url.password === "" &&
      url.search === "" &&
      url.hash === ""
    );
  }, "must not contain credentials, query, or fragment");
const privateProxyHost = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(253)
  .regex(/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/u)
  .refine(
    (value) => value.endsWith(".railway.internal"),
    "must use Railway private DNS",
  );

const proxyConfigSchema = strictObject({
  url: proxyUrl,
  internalHost: privateProxyHost,
  secret: z.string().trim().min(32).max(4096),
}).superRefine((config, ctx) => {
  const url = new URL(config.url);
  if (
    url.protocol !== "http:" ||
    url.hostname.toLowerCase() !== config.internalHost ||
    url.pathname !== "/api/internal/audit/proof"
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["url"],
      message:
        "proof proxy URL must use Railway private-network HTTP at the configured host and exact internal proof path",
    });
  }
});

export type TenantEvidenceProxyConfig = z.infer<typeof proxyConfigSchema>;

const accountIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(256)
  .refine(
    // eslint-disable-next-line no-control-regex -- reject C0/C1 controls and whitespace in a server-derived id.
    (value) => !/[\u0000-\u001f\u007f-\u009f\s]/.test(value),
    "account id has whitespace or control characters",
  );

const rowReceiptSchema = strictObject({
  v: z.literal(1),
  seq: z.number().int().nonnegative(),
  hash: z.string().min(1),
  prevHash: z.string().min(1).nullable(),
  anchor: strictObject({
    length: z.number().int().nonnegative(),
    tipHash: z.string().min(1),
    genesisHash: z.string().min(1).optional(),
    sig: z.string().min(1).optional(),
    keyId: z.string().min(1).optional(),
    sigV: z.literal(2).optional(),
    sigAccountId: z.string().uuid().optional(),
  }),
  raw: strictObject({
    prevHash: z.string().min(1).nullable(),
    payload: z.unknown(),
  }),
  redacted: z.boolean(),
  checks: strictObject({
    linkRecompute: z.enum(["pass", "fail", "na"]),
    anchorEquality: z.enum(["pass", "fail"]),
    signature: z.enum(["pass", "fail", "na"]).optional(),
  }),
  verifiedAt: z.string().datetime(),
});

export const TenantProofSuccessSchema = strictObject({
  receipt: rowReceiptSchema,
  redacted: z.boolean(),
  redactedPaths: z.array(z.string()).optional(),
  chainLength: z.number().int().nonnegative(),
});

export const TenantProofUnverifiableSchema = strictObject({
  state: z.literal("unverifiable"),
  reason: z.string().min(1),
});

export const TenantProofResponseSchema = z.union([
  TenantProofSuccessSchema,
  TenantProofUnverifiableSchema,
]);
export type TenantProofResponse = z.infer<typeof TenantProofResponseSchema>;

export const LatestEvidencePackResponseSchema = strictObject({
  kind: z.literal("latest-evidence-pack"),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  manifestSha256: z.string().regex(/^[0-9a-f]{64}$/),
  generatedAt: z.string().datetime(),
  manifest: evidencePackManifestSchema,
});
export type LatestEvidencePackResponse = z.infer<
  typeof LatestEvidencePackResponseSchema
>;

export interface BuyerCrosswalk {
  readonly mapsTo: readonly CrosswalkRollupCell[];
  readonly implements: readonly CrosswalkRollupCell[];
}

export class TenantEvidenceProxyError extends Error {
  readonly kind: "not-found" | "unavailable";

  constructor(kind: "not-found" | "unavailable") {
    super(`tenant evidence proxy ${kind}`);
    this.name = "TenantEvidenceProxyError";
    this.kind = kind;
  }
}

export function parseTenantEvidenceProxyConfig(
  input: unknown,
): TenantEvidenceProxyConfig {
  return parseStrict(proxyConfigSchema, input);
}

type FetchImpl = typeof fetchWithTimeout;

function accountCredential(accountId: string, secret: string): string {
  return createHmac("sha256", secret).update(accountId).digest("hex");
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new TenantEvidenceProxyError("unavailable");
  }
}

export function createTenantEvidenceProxy(
  config: TenantEvidenceProxyConfig,
  fetchImpl: FetchImpl = fetchWithTimeout,
): {
  getProof(accountId: string, seq: number): Promise<TenantProofResponse>;
  getLatestEvidencePack(accountId: string): Promise<LatestEvidencePackResponse>;
} {
  const parsedConfig = parseTenantEvidenceProxyConfig(config);

  async function postProxy<T>(
    rawAccountId: string,
    body: unknown,
    responseSchema: z.ZodType<T>,
  ): Promise<T> {
    const accountId = parseStrict(accountIdSchema, rawAccountId);
    let response: Response;
    try {
      response = await fetchImpl(
        parsedConfig.url,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${accountCredential(accountId, parsedConfig.secret)}`,
            "content-type": "application/json",
            "x-caisson-account-id": accountId,
          },
          body: JSON.stringify(body),
        },
        { timeoutMs: 10_000 },
      );
    } catch {
      throw new TenantEvidenceProxyError("unavailable");
    }
    if (response.status === 404) {
      throw new TenantEvidenceProxyError("not-found");
    }
    if (!response.ok) {
      throw new TenantEvidenceProxyError("unavailable");
    }
    try {
      return parseStrict(responseSchema, await parseJson(response));
    } catch (error) {
      if (error instanceof TenantEvidenceProxyError) throw error;
      throw new TenantEvidenceProxyError("unavailable");
    }
  }

  return {
    getProof(rawAccountId, rawSeq) {
      const seq = z.number().int().nonnegative().parse(rawSeq);
      return postProxy(rawAccountId, { seq }, TenantProofResponseSchema);
    },
    getLatestEvidencePack(rawAccountId) {
      return postProxy(
        rawAccountId,
        { kind: "latest-evidence-pack" },
        LatestEvidencePackResponseSchema,
      );
    },
  };
}

/**
 * Map the persisted pack's own rollup without inventing a score. The two arrays remain separate
 * all the way to the view so `maps-to` can never be added to `implements` as faux coverage.
 */
export function mapBuyerCrosswalk(input: EvidencePackManifest): BuyerCrosswalk {
  const manifest = parseEvidencePackManifest(input);
  return {
    mapsTo: manifest.crosswalkRollup.cells.filter(
      (cell) => cell.claim === "maps-to",
    ),
    implements: manifest.crosswalkRollup.cells.filter(
      (cell) => cell.claim === "implements",
    ),
  };
}
