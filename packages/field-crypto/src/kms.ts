// KmsKeyProvider — the opt-in, documented upgrade tier (ADR-0043). Envelope encryption: a per-tenant
// data-encryption key (DEK) is generated and WRAPPED by a key-encryption key (KEK) that never leaves
// the KMS; only the wrapped DEK is stored. On read, the wrapped DEK is unwrapped via the KMS. The
// KMS itself is behind the `KmsClient` port, so AWS KMS / GCP KMS / Azure Key Vault / HashiCorp Vault
// are drop-in (one interface, provider chosen by config) — ADR-0043's "not an AWS hard-binding".
//
// SCOPE (Wave 0): the seam + the wrapped-DEK envelope are REAL and tested via a local wrap double;
// NO live cloud call runs in CI — the network is behind the port. Production supplies a real
// `KmsClient` (AWS wiring in `kms-aws.ts`, exported here as `awsKmsClient` for back-compat, ADR-0171).
// The DEK plaintext is held only transiently to (un)wrap and to encrypt; it is never logged or persisted.
//
// CRYPTO-SHRED (P2 / ADR-0055): every key is scoped by a `keyId` (a per-tenant OR per-subject key
// identifier). `scheduleKeyDeletion(keyId)` destroys that scope's KEK — the NIST SP 800-88
// erasure-by-key-destruction primitive. Because the KEK is per-scope, the shred is SELECTIVE, and
// because it acts on the KMS (not the store), it renders the field ciphertext under that scope
// permanently unrecoverable WITHOUT mutating the append-only wrapped-DEK store (ADR-0014). The
// erasure-vs-immutable-chain reconciliation lives in `crypto-shred.ts`.
import { createHash, hkdfSync, randomBytes } from "node:crypto";
import { NotFoundError, ValidationError } from "@caisson/kernel";
import { type FieldKeyProvider } from "./provider.ts";
import { aesGcm } from "./cipher.ts";
import { buildAad } from "./aad.ts";
import { createAwsKmsClient } from "./kms-aws.ts";
import type { KmsClient } from "./kms-port.ts";

// The KmsClient port lives in ./kms-port.ts (a leaf) to break the kms.ts ↔ kms-aws.ts type cycle
// (dep-cruiser no-circular, tsPreCompilationDeps). Re-exported here for back-compat — index.ts and
// callers still import `KmsClient` from ./kms.ts.
export type { KmsClient };

/** Persistence for each tenant's wrapped DEKs by version + the current version. DB-backed via `DbWrappedKeyStore` (P2, below). */
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

/**
 * The minimal async key-value seam a {@link DbWrappedKeyStore} persists through — deliberately NOT
 * a pg client: the caller wires `get`/`put` to Postgres (or Redis, or anything durable) so this
 * package stays free of a hard DB dependency. Values are opaque strings.
 */
export interface KeyValueStore {
  get(key: string): Promise<string | undefined>;
  put(key: string, value: string): Promise<void>;
}

/**
 * DB-backed `WrappedKeyStore` (the P2 upgrade from `InMemoryWrappedKeyStore`) over an injected
 * `KeyValueStore`. Wrapped DEK bytes are stored base64-encoded; the current version as a decimal
 * string. Every key is namespaced under `field-crypto:` so the injected store can be shared.
 */
export class DbWrappedKeyStore implements WrappedKeyStore {
  constructor(private readonly kv: KeyValueStore) {}

  private wrappedKey(tenantId: string, keyVersion: number): string {
    return `field-crypto:wrapped:${tenantId}:${keyVersion}`;
  }
  private currentKey(tenantId: string): string {
    return `field-crypto:current:${tenantId}`;
  }

  async getWrapped(
    tenantId: string,
    keyVersion: number,
  ): Promise<Buffer | undefined> {
    const v = await this.kv.get(this.wrappedKey(tenantId, keyVersion));
    return v === undefined ? undefined : Buffer.from(v, "base64");
  }

  async putWrapped(
    tenantId: string,
    keyVersion: number,
    wrapped: Buffer,
  ): Promise<void> {
    await this.kv.put(
      this.wrappedKey(tenantId, keyVersion),
      wrapped.toString("base64"),
    );
  }

  async currentVersion(tenantId: string): Promise<number | undefined> {
    const v = await this.kv.get(this.currentKey(tenantId));
    return v === undefined ? undefined : Number(v);
  }

  async setCurrentVersion(tenantId: string, keyVersion: number): Promise<void> {
    await this.kv.put(this.currentKey(tenantId), String(keyVersion));
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
      throw new ValidationError(
        `field-crypto: key version overflow for tenant ${JSON.stringify(tenantId)}`,
      );
    }
    const { wrappedKey } = await this.kms.generateDataKey(tenantId);
    await this.store.putWrapped(tenantId, next, wrappedKey);
    await this.store.setCurrentVersion(tenantId, next);
    return next;
  }

  async keyFor(tenantId: string, keyVersion: number): Promise<Buffer> {
    const wrapped = await this.store.getWrapped(tenantId, keyVersion);
    if (wrapped === undefined) {
      throw new NotFoundError(
        `field-crypto: no wrapped DEK for tenant ${JSON.stringify(tenantId)} v${keyVersion} — provision first`,
      );
    }
    return this.kms.decryptDataKey(tenantId, wrapped); // network behind the port; plaintext DEK is transient
  }

  async currentVersion(tenantId: string): Promise<number> {
    const v = await this.store.currentVersion(tenantId);
    if (v === undefined) {
      throw new NotFoundError(
        `field-crypto: tenant ${JSON.stringify(tenantId)} has no provisioned KMS key — call provision()`,
      );
    }
    return v;
  }

  /**
   * Crypto-shred this tenant/subject scope (ADR-0055, P2-9): schedule irreversible KEK deletion in the
   * KMS. The append-only wrapped-DEK rows are LEFT IN PLACE — the store is immutable (ADR-0014) and
   * once the KEK is gone they are inert, so every field ciphertext under this scope becomes
   * unrecoverable WITHOUT ever mutating append-only storage. Returns the highest key version that
   * existed at shred time (0 if the scope was never provisioned) for the erasure audit record.
   * Idempotent: re-shredding an already-shredded scope is a no-op success.
   */
  async scheduleKeyDeletion(tenantId: string): Promise<number> {
    const through = (await this.store.currentVersion(tenantId)) ?? 0;
    await this.kms.scheduleKeyDeletion(tenantId);
    return through;
  }
}

/**
 * A LOCAL wrap double for tests + local dev — wraps each DEK with AES-256-GCM under a per-scope KEK
 * (a real AEAD wrap, so the envelope round-trips). It is NOT a KMS: the master KEK lives in process.
 * The per-`keyId` wrapping KEK is HKDF-derived from the master, so `scheduleKeyDeletion` is SELECTIVE
 * — shredding one scope leaves every other scope's KEK (and ciphertext) intact. Swap for
 * `awsKmsClient` (or a GCP/Azure/Vault impl) in production.
 */
export class LocalKmsClient implements KmsClient {
  /** Non-secret HKDF domain-separation salt for the per-scope KEK (local double only). */
  private static readonly KEK_SALT = createHash("sha256")
    .update("caisson-local-kms-kek/v1")
    .digest();
  /** Master KEK; each scope's wrapping KEK is HKDF-derived from it + the `keyId`. */
  private readonly master: Buffer;
  /** Crypto-shredded key ids (in-process tombstone). Irreversible for the client's lifetime. */
  private readonly shredded = new Set<string>();

  constructor(masterKek: Buffer) {
    if (masterKek.length !== 32)
      throw new ValidationError(
        "field-crypto: LocalKmsClient KEK must be 32 bytes",
      );
    this.master = masterKek;
  }

  /** HKDF-derive the per-scope wrapping KEK so distinct scopes get distinct, independently-shreddable keys. */
  private scopeKek(keyId: string): Buffer {
    return Buffer.from(
      hkdfSync(
        "sha256",
        this.master,
        LocalKmsClient.KEK_SALT,
        `kek:${keyId}`,
        32,
      ),
    );
  }

  /** The per-scope wrap AAD binds `keyId`, so a blob from one scope can't be unwrapped under another. */
  private wrapAad(keyId: string): Buffer {
    return buildAad("kms", 0, `dek-wrap:${keyId}`);
  }

  /** Reject any op on a crypto-shredded scope — fail-closed; the erasure is irreversible. */
  private assertLive(keyId: string): void {
    if (this.shredded.has(keyId)) {
      throw new NotFoundError(
        `field-crypto: key ${JSON.stringify(keyId)} was crypto-shredded — its data is unrecoverable`,
      );
    }
  }

  async generateDataKey(
    keyId: string,
  ): Promise<{ plaintextKey: Buffer; wrappedKey: Buffer }> {
    this.assertLive(keyId);
    const plaintextKey = randomBytes(32);
    const { nonce, ciphertext, tag } = aesGcm.encrypt(
      this.scopeKek(keyId),
      plaintextKey,
      this.wrapAad(keyId),
    );
    return {
      plaintextKey,
      wrappedKey: Buffer.concat([nonce, ciphertext, tag]),
    };
  }

  async decryptDataKey(keyId: string, wrappedKey: Buffer): Promise<Buffer> {
    this.assertLive(keyId);
    const nonce = wrappedKey.subarray(0, 12);
    const tag = wrappedKey.subarray(wrappedKey.length - 16);
    const ciphertext = wrappedKey.subarray(12, wrappedKey.length - 16);
    return aesGcm.decrypt(
      this.scopeKek(keyId),
      { nonce, ciphertext, tag },
      this.wrapAad(keyId),
    );
  }

  async scheduleKeyDeletion(keyId: string): Promise<void> {
    // Destroy the scope's KEK. Immediate in the local double (a real KMS schedules a pending-deletion
    // window); the effect is identical — every DEK wrapped under `keyId` is now permanently inert.
    this.shredded.add(keyId);
  }
}

/**
 * AWS KMS adapter (ADR-0171 — wired). Real impl lives in `kms-aws.ts` (`createAwsKmsClient`) so this
 * file doesn't grow an `@aws-sdk/client-kms` dependency of its own; this export is kept for the
 * original documented-seam name. See `kms-aws.ts`'s header for the exact command mapping.
 *
 * GCP KMS (`encrypt`/`decrypt`/`destroyCryptoKeyVersion`), Azure Key Vault
 * (`wrapKey`/`unwrapKey`/`deleteKey`), and HashiCorp Vault Transit
 * (`/transit/encrypt|decrypt`, delete the key) implement the same three methods and are equally
 * drop-in behind the `KmsClient` port.
 */
export function awsKmsClient(config: {
  keyId: string;
  region?: string;
}): KmsClient {
  return createAwsKmsClient(config);
}
