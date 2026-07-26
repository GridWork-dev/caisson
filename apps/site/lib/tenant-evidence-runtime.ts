import { createHash, timingSafeEqual } from "node:crypto";
import { parseStrict, strictObject } from "@caisson/kernel";
import { z } from "zod";
import { readScoped } from "./db.ts";
import {
  createTenantEvidenceProxy,
  parseTenantEvidenceProxyConfig,
} from "./tenant-evidence.ts";

const boundAccountSchema = strictObject({
  accountId: z.string().trim().min(1).max(256),
});

export class TenantScopeError extends Error {
  constructor() {
    super("tenant evidence read is outside the session RLS scope");
    this.name = "TenantScopeError";
  }
}

export type TenantScopeProbe = (accountId: string) => Promise<string | null>;

function opaqueEqual(left: string, right: string): boolean {
  const leftDigest = createHash("sha256").update(left).digest();
  const rightDigest = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

/**
 * Open a real `withTenant` transaction and read the bound tenant GUC after the app role is active.
 * This is an authorization probe, not a caller assertion: the expected id came from the session.
 */
async function probeTenantScope(accountId: string): Promise<string | null> {
  return readScoped(accountId, async (tx) => {
    const result = await tx.query<{ account_id: unknown }>(
      "SELECT current_setting('app.current_account', true) AS account_id",
    );
    if (result.rows.length !== 1) return null;
    const parsed = parseStrict(boundAccountSchema, {
      accountId: result.rows[0]?.account_id,
    });
    return parsed.accountId;
  });
}

export async function assertTenantEvidenceScope(
  accountId: string,
  probe: TenantScopeProbe = probeTenantScope,
): Promise<void> {
  const boundAccountId = await probe(accountId);
  if (boundAccountId === null || !opaqueEqual(boundAccountId, accountId)) {
    throw new TenantScopeError();
  }
}

export function tenantEvidenceProxyFromEnv(
  env: Record<string, string | undefined> = process.env,
) {
  return createTenantEvidenceProxy(
    parseTenantEvidenceProxyConfig({
      url: env.CAISSON_PROOF_PROXY_URL,
      internalHost: env.CAISSON_PROOF_PROXY_INTERNAL_HOST,
      secret: env.CAISSON_PROOF_PROXY_SECRET,
    }),
  );
}
