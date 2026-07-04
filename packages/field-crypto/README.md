# @caisson/field-crypto

Per-tenant authenticated field encryption — the floor the Compliance edition's encrypted columns
stand on. ADR-0043 (per-tenant keys) · ADR-0046 (envelope) · ADR-0045 (cipher) · ADR-0006 (data layer).

## What it gives you

- **Per-tenant keys, derived (zero infra).** `tenant_key = HKDF-SHA256(MASTER_FIELD_KEY,
FIELD_CRYPTO_SALT, "caisson-field-crypto:v"+keyVersion+":"+tenantId)`. No per-tenant key storage,
  no backup surface; the tenant is bound into HKDF `info`, so one key compromise never crosses
  tenants. The encryption boundary **equals** the RLS tenant boundary (ADR-0005).
- **AES-256-GCM behind an `AeadCipher` seam.** Zero dependency, FIPS-approved. Fresh CSPRNG nonce
  per write; `tenant_id ∥ key_version ∥ column-context` bound as AAD (a ciphertext can't be moved
  between rows, tenants, or columns). An alternate cipher is a drop-in.
- **Self-describing versioned envelope.** `[ver|alg|key_version|nonce|ciphertext|tag]` base64 →
  `text`. The decrypt path reads the version + alg + key version from the value itself, so rotation
  AND cipher migration need no out-of-band metadata.
- **Key-version rotation registry.** Bump the current version; old envelopes keep decrypting (lazy
  re-encrypt on next write).
- **Pluggable `FieldKeyProvider` port.** `DerivedKeyProvider` (default) or `KmsKeyProvider`
  (envelope encryption, AWS documented + GCP/Azure/Vault drop-in; network behind the port).

## Use

```ts
import {
  DerivedKeyProvider,
  TenantFieldCrypto,
  encryptedColumn,
  withFieldCryptoContext,
  derivedContext,
} from "@caisson/field-crypto";

// Application path (async; works over any provider incl. KMS):
const provider = DerivedKeyProvider.fromEnv(); // MASTER_FIELD_KEY + FIELD_CRYPTO_SALT (hex 32B)
const crypto = new TenantFieldCrypto(provider);
const sealed = await crypto.encryptField(tenantId, "424-...", "patient.ssn");
const plain = await crypto.decryptField(tenantId, sealed, "patient.ssn");

// Drizzle column (sync; transparent encrypt-on-write / decrypt-on-read). The tenant context flows
// through AsyncLocalStorage — bind it alongside withTenant (the boundary == the RLS boundary):
const ssn = encryptedColumn("patient.ssn")("ssn");
await withFieldCryptoContext(derivedContext(provider, tenantId), () => db.insert(...));
```

## Env

| Var                 | What                                        | Notes                                                             |
| ------------------- | ------------------------------------------- | ----------------------------------------------------------------- |
| `MASTER_FIELD_KEY`  | 32-byte IKM, hex (64 chars)                 | Hard secret — read once, never logged.                            |
| `FIELD_CRYPTO_SALT` | 32-byte per-deployment salt, hex (64 chars) | Non-secret; cross-deployment domain separation (ADR-0043 Fork 3). |

## Tests

`bun test packages/field-crypto/src` — cipher round-trip + tamper/AAD-mismatch reject, derive KAT,
the envelope golden, and the cross-tenant **isolation** integration test (two tenants → distinct
keys; tenant B cannot decrypt tenant A's envelope; a v1 ciphertext still decrypts after rotation).
