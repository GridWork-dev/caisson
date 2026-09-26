// ADR-0162 — the per-tenant encrypted BYOK provider-key store. An adopter's tenant supplies its OWN
// provider API key; this store holds it ENCRYPTED AT REST (field-crypto envelope) behind FORCE RLS, so
// a DB dump leaks no usable key and a cross-tenant read is refused twice over (RLS + the crypto AAD,
// which binds `tenantId`). It composes two shipped primitives and adds no new crypto:
//   • @caisson-sh/field-crypto — `sealField`/`openField` (per-tenant HKDF + AES-256-GCM + versioned
//     envelope) under a caller-supplied `FieldCryptoContext` (tenant-scoped, ADR-0043/0046);
//   • @caisson-sh/tenancy-rls — every read/write runs inside `withTenant` on a pre-scoped `TenantExecutor`;
//     the `buildTenantPolicySql` WITH CHECK rejects a forged cross-tenant write (ADR-0005).
//
// REPLACE semantics, deliberately (NOT the append-only DEK rule of `field-crypto/store.pg.ts`): a
// provider API key is a rotatable CREDENTIAL, not a data-encryption key — no historical ciphertext
// depends on it, so replacing a leaked/rotated key is the intended operation. One row per
// (account_id, provider); `putTenantProviderKey` upserts. `columnContext` binds the ciphertext to this
// column so an envelope cannot be moved elsewhere and opened.
import { randomUUID } from "node:crypto";
import { ValidationError } from "@caisson-sh/kernel";
import type { TenantExecutor } from "@caisson-sh/tenancy-rls";
import { buildTenantPolicySql } from "@caisson-sh/tenancy-rls";
import {
  openField,
  sealField,
  type FieldCryptoContext,
} from "@caisson-sh/field-crypto";

/** The stable column identity bound into the crypto AAD (an envelope cannot be moved + opened). */
const BYOK_COLUMN_CONTEXT = "ai.tenant_provider_key";

// One CURRENT encrypted provider key per (account, provider). `key_version` records the field-crypto
// envelope version in force at write time (for master-key rotation), not a BYOK-rotation counter.
export const TENANT_AI_CREDENTIAL_SCHEMA_SQL = `
CREATE TABLE tenant_ai_credential (
  id           text PRIMARY KEY,
  account_id   text NOT NULL,
  provider     text NOT NULL,
  key_version  integer NOT NULL,
  ciphertext   text NOT NULL,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, provider)
);
${buildTenantPolicySql("tenant_ai_credential")}
`;

/** Reject an empty provider before any query — never run an unscoped credential lookup (fail-closed). */
function assertProvider(provider: string): void {
  if (provider.length === 0) {
    throw new ValidationError("ai-kit BYOK: provider is required");
  }
}

/**
 * Store (or replace) a tenant's encrypted provider key. Runs inside `withTenant(tx, accountId)`; the
 * `ctx.tenantId` MUST equal that account (the RLS WITH CHECK and the crypto AAD both enforce it). The
 * plaintext key is sealed under the tenant's current envelope version and never persisted in the clear.
 */
export async function putTenantProviderKey(
  tx: TenantExecutor,
  ctx: FieldCryptoContext,
  provider: string,
  plaintextKey: string,
): Promise<void> {
  assertProvider(provider);
  if (plaintextKey.length === 0) {
    throw new ValidationError("ai-kit BYOK: provider key is required");
  }
  const keyVersion = ctx.currentVersion();
  const ciphertext = sealField(ctx, BYOK_COLUMN_CONTEXT, plaintextKey);
  await tx.query(
    `INSERT INTO tenant_ai_credential (id, account_id, provider, key_version, ciphertext, updated_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (account_id, provider)
     DO UPDATE SET ciphertext = EXCLUDED.ciphertext, key_version = EXCLUDED.key_version, updated_at = now()`,
    [randomUUID(), ctx.tenantId, provider, keyVersion, ciphertext],
  );
}

/**
 * Read + decrypt a tenant's provider key, or `undefined` if none is stored. Runs inside
 * `withTenant(tx, accountId)`; RLS scopes the read to the caller's account and `openField` verifies the
 * AAD (tenant + column), so a row surfaced out of scope cannot be decrypted.
 */
export async function getTenantProviderKey(
  tx: TenantExecutor,
  ctx: FieldCryptoContext,
  provider: string,
): Promise<string | undefined> {
  assertProvider(provider);
  const res = await tx.query<{ ciphertext: string }>(
    `SELECT ciphertext FROM tenant_ai_credential WHERE account_id = $1 AND provider = $2`,
    [ctx.tenantId, provider],
  );
  const row = res.rows[0];
  return row === undefined
    ? undefined
    : openField(ctx, BYOK_COLUMN_CONTEXT, row.ciphertext);
}
