// Per-tenant key derivation (ADR-0043). Each tenant's data-encryption key is DERIVED, never shared
// or stored: `tenant_key = HKDF-SHA256(ikm=MASTER_FIELD_KEY, salt=FIELD_CRYPTO_SALT,
// info="caisson-field-crypto:v"||key_version||":"||tenant_id)`. Deterministic (no key storage/backup
// surface), per-tenant isolated (tenant_id bound into `info`), rotation-aware (key_version in `info`).
// Native `crypto.hkdfSync` — no added dependency. The master key is read once and NEVER logged.
//
// The `info` construction and the 32-byte length live in portable.ts (ADR-0396) so the browser twin
// `deriveTenantKeyAsync` derives from the SAME vocabulary, not a second copy of it; both names are
// re-exported here unchanged.
import { hkdfSync } from "node:crypto";
import { ValidationError } from "@caisson-sh/kernel";
import { TENANT_KEY_BYTES, deriveInfo } from "./portable.ts";

export {
  TENANT_KEY_BYTES,
  deriveInfo,
  deriveTenantKeyAsync,
} from "./portable.ts";

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
