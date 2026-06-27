// Per-tenant key derivation (ADR-0043). Each tenant's data-encryption key is DERIVED, never shared
// or stored: `tenant_key = HKDF-SHA256(ikm=MASTER_FIELD_KEY, salt=FIELD_CRYPTO_SALT,
// info="caisson-field-crypto:v"||key_version||":"||tenant_id)`. Deterministic (no key storage/backup
// surface), per-tenant isolated (tenant_id bound into `info`), rotation-aware (key_version in `info`).
// Native `crypto.hkdfSync` — no added dependency. The master key is read once and NEVER logged.
import { hkdfSync } from "node:crypto";
import { ValidationError } from "@caisson/kernel";

/** AES-256 needs a 32-byte key; HKDF-SHA256 expands the master key to exactly this length. */
export const TENANT_KEY_BYTES = 32;

/** The HKDF `info` domain-separation string — EXACTLY per ADR-0043. Tenant + key-version live here. */
export function deriveInfo(keyVersion: number, tenantId: string): string {
  if (!Number.isInteger(keyVersion) || keyVersion < 1 || keyVersion > 0xffff) {
    throw new ValidationError(
      `field-crypto: keyVersion must be an integer in [1, 65535], got ${String(keyVersion)}`,
    );
  }
  if (tenantId.length === 0) {
    throw new ValidationError(
      "field-crypto: refusing to derive a key for an empty tenantId",
    );
  }
  return `caisson-field-crypto:v${keyVersion}:${tenantId}`;
}

/**
 * Derive a tenant's 32-byte data-encryption key. `masterKey` (32B IKM) and `salt` (32B
 * per-deployment, non-secret) come from the validated env (`DerivedKeyProvider`); `keyVersion` +
 * `tenantId` are bound into HKDF `info` for rotation + per-tenant domain separation (ADR-0043,
 * Fork 3 confirmed — separation lives in `info`, not the salt).
 */
export function deriveTenantKey(
  masterKey: Buffer,
  salt: Buffer,
  keyVersion: number,
  tenantId: string,
): Buffer {
  if (masterKey.length !== TENANT_KEY_BYTES) {
    throw new ValidationError(
      `field-crypto: MASTER_FIELD_KEY must be ${TENANT_KEY_BYTES} bytes, got ${masterKey.length}`,
    );
  }
  if (salt.length !== TENANT_KEY_BYTES) {
    throw new ValidationError(
      `field-crypto: FIELD_CRYPTO_SALT must be ${TENANT_KEY_BYTES} bytes, got ${salt.length}`,
    );
  }
  const info = deriveInfo(keyVersion, tenantId);
  // hkdfSync returns an ArrayBuffer — wrap as a Buffer for the cipher key.
  return Buffer.from(
    hkdfSync("sha256", masterKey, salt, info, TENANT_KEY_BYTES),
  );
}
