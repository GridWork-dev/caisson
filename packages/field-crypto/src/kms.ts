// KmsKeyProvider — the opt-in, documented upgrade tier (ADR-0043). Envelope encryption: a per-tenant
// data-encryption key (DEK) is generated and WRAPPED by a key-encryption key (KEK) that never leaves
// the KMS; only the wrapped DEK is stored. On read, the wrapped DEK is unwrapped via the KMS. The
// KMS itself is behind the `KmsClient` port, so AWS KMS / GCP KMS / Azure Key Vault / HashiCorp Vault
// are drop-in (one interface, provider chosen by config) — ADR-0043's "not an AWS hard-binding".
//
// SCOPE (Wave 0): the seam + the wrapped-DEK envelope are REAL and tested via a local wrap double;
// NO live cloud call runs in CI — the network is behind the port. Production supplies a real
// `KmsClient` (AWS wiring sketched in `awsKmsClient` below). The DEK plaintext is held only
// transiently to (un)wrap and to encrypt; it is never logged or persisted.
import { type FieldKeyProvider } from "./provider.ts";
import { aesGcm } from "./cipher.ts";
import { buildAad } from "./aad.ts";

/** The KMS port. A production impl calls the cloud KMS; the test double wraps locally. */
export interface KmsClient {
  /** Generate a fresh 32-byte DEK and return it alongside its KEK-wrapped form. */
  generateDataKey(): Promise<{ plaintextKey: Buffer; wrappedKey: Buffer }>;
  /** Unwrap a previously-wrapped DEK back to its 32-byte plaintext. */
  decryptDataKey(wrappedKey: Buffer): Promise<Buffer>;
}

/** Persistence for each tenant's wrapped DEKs by version + the current version. DB-backed in P2. */
export interface WrappedKeyStore {
  getWrapped(tenantId: string, keyVersion: number): Promise<Buffer | undefined>;
  putWrapped(
    tenantId: string,
    keyVersion: number,
    wrapped: Buffer,
  ): Promise<void>;
  currentVersion(tenantId: string): Promise<number | undefined>;
  setCurrentVersion(tenantId: string, keyVersion: number): Promise<void>;
}

export class InMemoryWrappedKeyStore implements WrappedKeyStore {
  private readonly wrapped = new Map<string, Buffer>();
  private readonly current = new Map<string, number>();
  private key(t: string, v: number): string {
    return `${t}:${v}`;
  }
  async getWrapped(
    tenantId: string,
    keyVersion: number,
  ): Promise<Buffer | undefined> {
    return this.wrapped.get(this.key(tenantId, keyVersion));
  }
  async putWrapped(
    tenantId: string,
    keyVersion: number,
    wrapped: Buffer,
  ): Promise<void> {
    this.wrapped.set(this.key(tenantId, keyVersion), wrapped);
  }
  async currentVersion(tenantId: string): Promise<number | undefined> {
    return this.current.get(tenantId);
  }
  async setCurrentVersion(tenantId: string, keyVersion: number): Promise<void> {
    this.current.set(tenantId, keyVersion);
  }
}

export class KmsKeyProvider implements FieldKeyProvider {
  constructor(
    private readonly kms: KmsClient,
    private readonly store: WrappedKeyStore,
  ) {}

  /** Provision (or rotate to) a fresh wrapped DEK for a tenant; returns the new current version. */
  async provision(tenantId: string): Promise<number> {
    const cur = (await this.store.currentVersion(tenantId)) ?? 0;
    const next = cur + 1;
    if (next > 0xffff) {
      throw new Error(
        `field-crypto: key version overflow for tenant ${JSON.stringify(tenantId)}`,
      );
    }
    const { wrappedKey } = await this.kms.generateDataKey();
    await this.store.putWrapped(tenantId, next, wrappedKey);
    await this.store.setCurrentVersion(tenantId, next);
    return next;
  }

  async keyFor(tenantId: string, keyVersion: number): Promise<Buffer> {
    const wrapped = await this.store.getWrapped(tenantId, keyVersion);
    if (wrapped === undefined) {
      throw new Error(
        `field-crypto: no wrapped DEK for tenant ${JSON.stringify(tenantId)} v${keyVersion} — provision first`,
      );
    }
    return this.kms.decryptDataKey(wrapped); // network behind the port; plaintext DEK is transient
  }

  async currentVersion(tenantId: string): Promise<number> {
    const v = await this.store.currentVersion(tenantId);
    if (v === undefined) {
      throw new Error(
        `field-crypto: tenant ${JSON.stringify(tenantId)} has no provisioned KMS key — call provision()`,
      );
    }
    return v;
  }
}

/**
 * A LOCAL wrap double for tests + local dev — wraps the DEK with AES-256-GCM under an in-process KEK
 * (a real AEAD wrap, so the envelope round-trips). It is NOT a KMS: the KEK lives in process. Swap
 * for `awsKmsClient` (or a GCP/Azure/Vault impl) in production.
 */
export class LocalKmsClient implements KmsClient {
  private static readonly WRAP_AAD = buildAad("kms", 0, "dek-wrap");
  constructor(private readonly kek: Buffer) {
    if (kek.length !== 32)
      throw new Error("field-crypto: LocalKmsClient KEK must be 32 bytes");
  }
  async generateDataKey(): Promise<{
    plaintextKey: Buffer;
    wrappedKey: Buffer;
  }> {
    const { randomBytes } = await import("node:crypto");
    const plaintextKey = randomBytes(32);
    const { nonce, ciphertext, tag } = aesGcm.encrypt(
      this.kek,
      plaintextKey,
      LocalKmsClient.WRAP_AAD,
    );
    return {
      plaintextKey,
      wrappedKey: Buffer.concat([nonce, ciphertext, tag]),
    };
  }
  async decryptDataKey(wrappedKey: Buffer): Promise<Buffer> {
    const nonce = wrappedKey.subarray(0, 12);
    const tag = wrappedKey.subarray(wrappedKey.length - 16);
    const ciphertext = wrappedKey.subarray(12, wrappedKey.length - 16);
    return aesGcm.decrypt(
      this.kek,
      { nonce, ciphertext, tag },
      LocalKmsClient.WRAP_AAD,
    );
  }
}

/**
 * AWS KMS adapter (documented seam — wire in production). The real impl uses `@aws-sdk/client-kms`:
 *
 *   generateDataKey: KMS `GenerateDataKey({ KeyId, KeySpec: "AES_256" })`
 *     → { Plaintext (the DEK), CiphertextBlob (the wrapped DEK) }
 *   decryptDataKey:  KMS `Decrypt({ KeyId, CiphertextBlob })` → { Plaintext (the DEK) }
 *
 * Left unwired here so CI makes no live cloud call (the SDK is added + the client constructed by the
 * buyer's deployment). GCP KMS (`encrypt`/`decrypt`), Azure Key Vault (`wrapKey`/`unwrapKey`), and
 * HashiCorp Vault Transit (`/transit/encrypt|decrypt`) implement the same two methods.
 */
export function awsKmsClient(_config: {
  keyId: string;
  region?: string;
}): KmsClient {
  throw new Error(
    "field-crypto: awsKmsClient is a documented seam — supply @aws-sdk/client-kms wiring in your deployment (see kms.ts)",
  );
}
