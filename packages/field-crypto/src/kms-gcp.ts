// src/kms-gcp.ts — the real GCP Cloud KMS `KmsClient` driver (ADR-0171 pre-authorized: "GCP KMS...
// implement the same three methods and are equally drop-in behind the KmsClient port", kms.ts:279-282),
// wiring kms.ts's documented seam over the official `@google-cloud/kms` client. Mirrors kms-aws.ts's
// injected-config / `ConfigError` fail-closed factory shape exactly — same raw-vendor-SDK call (not
// REST): GCP's Node client already resolves Application Default Credentials internally the same way
// the AWS SDK resolves its default credential chain, so hand-rolling a REST+OAuth2 token exchange
// would only re-implement what the official client does for free.
//
// GCP KMS HAS NO GenerateDataKey RPC (unlike AWS): envelope encryption there is BYO-DEK — mint the
// 32-byte plaintext DEK locally (same as `LocalKmsClient`) and call `Encrypt` on the CryptoKey to get
// the wrapped form back. `Encrypt`/`Decrypt` address a CryptoKey resource (GCP auto-picks the primary
// version to encrypt with, and auto-detects the version from the ciphertext to decrypt) — there is no
// per-call version to choose for those two ops. Only destroy is version-scoped:
// `DestroyCryptoKeyVersion` schedules deletion of ONE CryptoKeyVersion (GCP CryptoKeys/KeyRings
// themselves can never be deleted, only their versions), so the per-tenant CMK's own scope is
// destroyed by targeting `<cryptoKeyName>/cryptoKeyVersions/<cryptoKeyVersion>`
// (`config.cryptoKeyVersion`, default "1" — the version a freshly-provisioned per-tenant key starts on).
//
// PER-TENANT CMK (mirrors ADR-0197). The port's per-call `keyId` IS the CryptoKey resource name for
// that tenant, falling back to the configured default (`config.cryptoKeyName`) ONLY when the per-call
// scope is empty — same rule as kms-aws.ts's `cmkFor`.
//
// TENANT BINDING. Each Encrypt/Decrypt call sets `additionalAuthenticatedData` binding the scope
// (GCP's raw-bytes AAD is the analog of AWS's `EncryptionContext` map / this package's own GCM AAD in
// aad.ts): a DEK wrapped for tenant A cannot be unwrapped in tenant B's context even on a shared
// CryptoKey.
//
// Mapping (per kms.ts's documented seam comment, kms.ts:279-282):
//   generateDataKey(keyId)      -> local randomBytes(32) DEK, then Encrypt({ name: cryptoKeyFor(keyId), plaintext, additionalAuthenticatedData })
//   decryptDataKey(keyId, blob) -> Decrypt({ name: cryptoKeyFor(keyId), ciphertext: blob, additionalAuthenticatedData })
//   scheduleKeyDeletion(keyId)  -> DestroyCryptoKeyVersion({ name: `${cryptoKeyFor(keyId)}/cryptoKeyVersions/${cryptoKeyVersion}` })  // empty keyId throws
//
// `cryptoKeyVersion` + the default `cryptoKeyName` are injected via `config`, never a module constant;
// a missing default `cryptoKeyName` fails closed with `ConfigError` at construction, not at the first
// call. Tests inject a fake `client` (a `Pick<KeyManagementServiceClient, "encrypt"|"decrypt"|
// "destroyCryptoKeyVersion">`), so `bun test` never reaches GCP.
import { randomBytes } from "node:crypto";
import { KeyManagementServiceClient } from "@google-cloud/kms";
import { ConfigError, InternalError, ValidationError } from "@caisson/kernel";
import type { KmsClient } from "./kms-port.ts";

/**
 * The injected GCP KMS transport — only the three RPCs this driver calls, collapsed to a `Pick<>`
 * (mirrors `KmsSendable` in kms-aws.ts; GCP's client has no single dispatch method to collapse to, so
 * this picks the three named methods instead of one `send`). Production supplies a real
 * `KeyManagementServiceClient`; tests inject a fake so no call reaches GCP.
 */
export type GcpKmsSendable = Pick<
  KeyManagementServiceClient,
  "encrypt" | "decrypt" | "destroyCryptoKeyVersion"
>;

export interface GcpKmsClientConfig {
  /**
   * The DEFAULT CryptoKey resource name — used only when a call passes no per-tenant scope `keyId`.
   * Full path shape: `projects/<project>/locations/<location>/keyRings/<ring>/cryptoKeys/<key>`.
   */
  cryptoKeyName: string;
  /**
   * The CryptoKeyVersion `scheduleKeyDeletion` targets (GCP's destroy op is version-scoped, not
   * key-scoped, unlike AWS's key-scoped `ScheduleKeyDeletion`). Defaults to `"1"` — the version a
   * freshly-provisioned per-tenant key starts on.
   */
  cryptoKeyVersion?: string;
  /** Override the underlying KMS transport. Tests inject a fake here so no call reaches GCP. */
  client?: GcpKmsSendable;
}

/**
 * The `additionalAuthenticatedData` binding a wrapped DEK to its tenant/subject scope — mirrors
 * `scopeContext`'s `EncryptionContext` in kms-aws.ts and the GCM AAD in aad.ts. A blob generated
 * under one scope's AAD fails `Decrypt` under another's.
 */
function scopeAad(keyId: string): Buffer {
  return Buffer.from(`caisson:field-crypto:scope=${keyId}`, "utf8");
}

/** The real GCP Cloud KMS `KmsClient` (ADR-0171) — see the module-level mapping comment for the three ops. */
export function createGcpKmsClient(config: GcpKmsClientConfig): KmsClient {
  if (config.cryptoKeyName === undefined || config.cryptoKeyName.length === 0) {
    throw new ConfigError(
      "createGcpKmsClient requires a default `cryptoKeyName`",
    );
  }
  const defaultCryptoKeyName = config.cryptoKeyName;
  const cryptoKeyVersion = config.cryptoKeyVersion ?? "1";
  const sdk: GcpKmsSendable = config.client ?? new KeyManagementServiceClient();

  // The CryptoKey a call targets: the per-tenant scope `keyId`, or the default CryptoKey when none is passed.
  const cryptoKeyFor = (keyId: string): string =>
    keyId.length > 0 ? keyId : defaultCryptoKeyName;

  return {
    async generateDataKey(
      keyId: string,
    ): Promise<{ plaintextKey: Buffer; wrappedKey: Buffer }> {
      const plaintextKey = randomBytes(32);
      const [{ ciphertext }] = await sdk.encrypt({
        name: cryptoKeyFor(keyId),
        plaintext: plaintextKey,
        additionalAuthenticatedData: scopeAad(keyId),
      });
      if (ciphertext === undefined || ciphertext === null) {
        throw new InternalError(
          "field-crypto: GCP KMS Encrypt returned no ciphertext",
        );
      }
      return {
        plaintextKey,
        wrappedKey: Buffer.from(ciphertext as Uint8Array),
      };
    },

    async decryptDataKey(keyId: string, wrappedKey: Buffer): Promise<Buffer> {
      const [{ plaintext }] = await sdk.decrypt({
        name: cryptoKeyFor(keyId),
        ciphertext: wrappedKey,
        additionalAuthenticatedData: scopeAad(keyId),
      });
      if (plaintext === undefined || plaintext === null) {
        throw new InternalError(
          "field-crypto: GCP KMS Decrypt returned no plaintext",
        );
      }
      return Buffer.from(plaintext as Uint8Array);
    },

    async scheduleKeyDeletion(keyId: string): Promise<void> {
      // Refuse an empty scope: falling back to the default CryptoKey here would destroy its version
      // for EVERY tenant that shares it as their fallback.
      if (keyId.length === 0) {
        throw new ValidationError(
          "field-crypto: GCP KMS scheduleKeyDeletion requires an explicit keyId — refusing to destroy the default CryptoKey's version",
        );
      }
      await sdk.destroyCryptoKeyVersion({
        name: `${cryptoKeyFor(keyId)}/cryptoKeyVersions/${cryptoKeyVersion}`,
      });
    },
  };
}
