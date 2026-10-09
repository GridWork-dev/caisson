# @caisson-sh/field-crypto

Per-tenant authenticated field encryption — the floor that encrypted columns
stand on. ADR-0043 (per-tenant keys) · ADR-0046 (envelope) · ADR-0045 (cipher) · ADR-0006 (data layer).

## What it gives you

- **Per-tenant keys, derived (dev/self-hosted zero infra).** `tenant_key = HKDF-SHA256(MASTER_FIELD_KEY,
FIELD_CRYPTO_SALT, "caisson-field-crypto:v"+keyVersion+":"+tenantId)`. No per-tenant key storage,
  no backup surface; the tenant is bound into HKDF `info`, so one key compromise never crosses
  tenants. The encryption boundary **equals** the RLS tenant boundary (ADR-0005).
- **AES-256-GCM behind an `AeadCipher` seam.** Zero dependency, FIPS-approved. Fresh CSPRNG nonce
  per write; the transparent column binds `tenant_id ∥ key_version ∥ column-context` as AAD, so
  ciphertext cannot move across tenants or columns. Use the explicit row-bound API with a stable
  row ID when same-column relocation between rows must also fail authentication.
- **Self-describing versioned envelope.** `[ver|alg|key_version|nonce|ciphertext|tag]` base64 →
  `text`. The decrypt path reads the version + alg + key version from the value itself, so rotation
  AND cipher migration need no out-of-band metadata.
- **Key-version rotation registry.** Bump the current version; old envelopes keep decrypting (lazy
  re-encrypt on next write).
- **Pluggable `FieldKeyProvider` port.** `DerivedKeyProvider` (default) or `KmsKeyProvider`
  (envelope encryption, AWS + GCP + Azure wired through injected SDK clients; network behind the
  port). Deletion returns the provider-proven state, so a recoverable cloud retention window is
  never labeled irreversible.

## Entry points

- `.` — the full surface, node-capable (KMS adapters, the Drizzle column, the Postgres stores).
- `./browser` — per-tenant HKDF derivation, AES-256-GCM seal/open, the row-bound AAD tuple, and the
  envelope codec, over WebCrypto and `Uint8Array` instead of `node:crypto` and `Buffer`: safe inside
  a client bundle or any WebCrypto-only runtime (Node >= 20.12). The `…Async` / `…Bytes` names are
  the browser half of the same vocabulary, not a second format — both directions of the interop are
  pinned byte-for-byte against the shipped `__golden__` fixtures. Every name on `./browser` is also
  on `.`.

## Use

```ts
import {
  DerivedKeyProvider,
  TenantFieldCrypto,
  encryptedColumn,
  withFieldCryptoContext,
  derivedContext,
} from "@caisson-sh/field-crypto";

// Derived path for dev/test or an explicitly selected self-hosted deployment:
const provider = DerivedKeyProvider.fromEnv(); // MASTER_FIELD_KEY + FIELD_CRYPTO_SALT (hex 32B)
const crypto = new TenantFieldCrypto(provider);
const sealed = await crypto.encryptField(tenantId, "424-...", "patient.ssn");
const plain = await crypto.decryptField(tenantId, sealed, "patient.ssn");

// Drizzle column (sync; transparent encrypt-on-write / decrypt-on-read). The tenant context flows
// through AsyncLocalStorage — bind it alongside withTenant (the boundary == the RLS boundary):
const ssn = encryptedColumn("patient.ssn")("ssn");
await withFieldCryptoContext(derivedContext(provider, tenantId), () => db.insert(...));
```

For a KMS-backed request, persist the wrapped DEKs in the same tenant transaction and bind the
async provider before touching encrypted fields:

```ts
import {
  KmsKeyProvider,
  PgWrappedKeyStore,
  withKmsFieldCryptoContext,
} from "@caisson-sh/field-crypto";

await withTenant(db, tenantId, async (tx) => {
  const provider = new KmsKeyProvider(kmsClient, new PgWrappedKeyStore(tx));
  await provider.ensureProvisioned(tenantId);
  await withKmsFieldCryptoContext(provider, tenantId, async (ctx) => {
    await writeEncryptedFields(tx, ctx);
  });
});
```

`withKmsFieldCryptoContext` unwraps every historical version at bind time and zeroizes those
plaintext DEKs in `finally`. This preserves old-envelope reads after rotation without a
process-lifetime plaintext-key cache. Azure wrapped payloads also pin the exact KEK version returned
by the wrap operation, so a later KEK rotation does not silently redirect historical unwraps.

## Derived-provider env

| Var                 | What                                        | Notes                                                             |
| ------------------- | ------------------------------------------- | ----------------------------------------------------------------- |
| `MASTER_FIELD_KEY`  | 32-byte IKM, hex (64 chars)                 | Hard secret — read once, never logged.                            |
| `FIELD_CRYPTO_SALT` | 32-byte per-deployment salt, hex (64 chars) | Non-secret; cross-deployment domain separation (ADR-0043 Fork 3). |

Azure Key Vault production integrations require an HTTPS vault URL, a deterministic key-name
prefix, `RSA-OAEP-256`, purge protection, and a bounded request deadline. The generic package keeps
those deployment choices behind `createAzureKeyVaultKmsClient`; the Caisson site constructs an
explicit `ClientSecretCredential` from required service-principal variables — never an ambient
credential chain — strictly validates its runtime policy variables, and supplies the request
deadline.

## Tests

`bun test packages/field-crypto/src` — cipher round-trip + tamper/AAD-mismatch reject, derive KAT,
the envelope golden, and the cross-tenant **isolation** integration test (two tenants → distinct
keys; tenant B cannot decrypt tenant A's envelope; a v1 ciphertext still decrypts after rotation).
