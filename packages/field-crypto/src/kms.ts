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
// erasure-by-key-destruction primitive. Because the KEK is per-scope, the shred is selective ACROSS
// scopes — other tenants are untouched — and because it acts on the KMS (not the store), it can
// render the field ciphertext under that scope unrecoverable WITHOUT mutating the append-only
// wrapped-DEK store (ADR-0014). Provider receipts remain literal: recoverable soft deletion is not
// called irreversible. The erasure-vs-immutable-chain reconciliation lives in `crypto-shred.ts`.
//
// It is NOT selective WITHIN a scope. Request contexts prefetch every historical version (ADR-0389),
// so once a scope's KEK is destroyed that tenant can no longer read OR write any encrypted field,
// and re-provisioning stays blocked for the provider's retention window. Shredding a tenant ends
// that tenant's encrypted-field lifetime; it does not erase one subset of their data.
import {
  createHash,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import {
  ConflictError,
  InternalError,
  NotFoundError,
  ValidationError,
} from "@caisson-sh/kernel";
import { type FieldKeyProvider } from "./provider.ts";
import { aesGcm } from "./cipher.ts";
import { buildAad } from "./aad.ts";
import { createAwsKmsClient } from "./kms-aws.ts";
import type {
  KmsClient,
  KmsDeletionReceipt,
  KmsOperationOptions,
} from "./kms-port.ts";

// The KmsClient port lives in ./kms-port.ts (a leaf) to break the kms.ts ↔ kms-aws.ts type cycle
// (dep-cruiser no-circular, tsPreCompilationDeps). Re-exported here for back-compat — index.ts and
// callers still import `KmsClient` from ./kms.ts.
export type { KmsClient, KmsDeletionReceipt, KmsOperationOptions };

const MAX_KEY_VERSION = 0xffff;

function assertTenantId(tenantId: string): void {
  if (tenantId.trim().length === 0) {
    throw new ValidationError("field-crypto: tenantId is required");
  }
}

function assertKeyVersion(keyVersion: number): void {
  if (
    !Number.isInteger(keyVersion) ||
    keyVersion < 1 ||
    keyVersion > MAX_KEY_VERSION
  ) {
    throw new ValidationError(
      `field-crypto: key version must be an integer in 1..${String(MAX_KEY_VERSION)}`,
      { keyVersion },
    );
  }
}

function parseStoredKeyVersion(value: string): number {
  if (!/^[1-9][0-9]*$/.test(value)) {
    throw new InternalError("field-crypto: invalid stored key version");
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > MAX_KEY_VERSION) {
    throw new InternalError("field-crypto: invalid stored key version");
  }
  return parsed;
}

/** Persistence for each tenant's wrapped DEKs by version + the current version. DB-backed via `DbWrappedKeyStore` (P2, below). */
export interface WrappedKeyStore {
  getWrapped(tenantId: string, keyVersion: number): Promise<Buffer | undefined>;
  /**
   * Atomically insert only when the tenant/version has no wrapped DEK. Returns true for the winner,
   * false when an append-only winner already exists.
   */
  putWrappedIfAbsent(
    tenantId: string,
    keyVersion: number,
    wrapped: Buffer,
  ): Promise<boolean>;
  putWrapped(
    tenantId: string,
    keyVersion: number,
    wrapped: Buffer,
  ): Promise<void>;
  currentVersion(tenantId: string): Promise<number | undefined>;
  /** Monotonic: a stale recovery writer must never lower a newer durable version. */
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
    assertTenantId(tenantId);
    assertKeyVersion(keyVersion);
    const wrapped = this.wrapped.get(this.key(tenantId, keyVersion));
    return wrapped === undefined ? undefined : Buffer.from(wrapped);
  }
  async putWrapped(
    tenantId: string,
    keyVersion: number,
    wrapped: Buffer,
  ): Promise<void> {
    assertTenantId(tenantId);
    assertKeyVersion(keyVersion);
    const key = this.key(tenantId, keyVersion);
    const existing = this.wrapped.get(key);
    if (existing !== undefined) {
      if (
        existing.length === wrapped.length &&
        timingSafeEqual(existing, wrapped)
      ) {
        return;
      }
      throw new ConflictError(
        "field-crypto: a different wrapped DEK already exists for this tenant/version (append-only)",
        { tenantId, keyVersion },
      );
    }
    this.wrapped.set(key, Buffer.from(wrapped));
  }
  async putWrappedIfAbsent(
    tenantId: string,
    keyVersion: number,
    wrapped: Buffer,
  ): Promise<boolean> {
    assertTenantId(tenantId);
    assertKeyVersion(keyVersion);
    const key = this.key(tenantId, keyVersion);
    if (this.wrapped.has(key)) return false;
    this.wrapped.set(key, Buffer.from(wrapped));
    return true;
  }
  async currentVersion(tenantId: string): Promise<number | undefined> {
    assertTenantId(tenantId);
    return this.current.get(tenantId);
  }
  async setCurrentVersion(tenantId: string, keyVersion: number): Promise<void> {
    assertTenantId(tenantId);
    assertKeyVersion(keyVersion);
    const current = this.current.get(tenantId);
    if (current === undefined || keyVersion > current) {
      this.current.set(tenantId, keyVersion);
    }
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
  /** Atomic compare-and-set used to elect one first-provision winner. */
  putIfAbsent(key: string, value: string): Promise<boolean>;
  /**
   * Atomically replace `expected` with `next`. `expected: undefined` means the key must not exist.
   * Required for monotonic current-version transitions under overlapping recovery/rotation.
   */
  compareAndSwap(
    key: string,
    expected: string | undefined,
    next: string,
  ): Promise<boolean>;
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
    assertTenantId(tenantId);
    assertKeyVersion(keyVersion);
    const v = await this.kv.get(this.wrappedKey(tenantId, keyVersion));
    return v === undefined ? undefined : Buffer.from(v, "base64");
  }

  async putWrapped(
    tenantId: string,
    keyVersion: number,
    wrapped: Buffer,
  ): Promise<void> {
    const inserted = await this.putWrappedIfAbsent(
      tenantId,
      keyVersion,
      wrapped,
    );
    if (inserted) return;

    const existing = await this.getWrapped(tenantId, keyVersion);
    if (
      existing !== undefined &&
      existing.length === wrapped.length &&
      timingSafeEqual(existing, wrapped)
    ) {
      return;
    }
    throw new ConflictError(
      "field-crypto: a different wrapped DEK already exists for this tenant/version (append-only)",
      { tenantId, keyVersion },
    );
  }

  async putWrappedIfAbsent(
    tenantId: string,
    keyVersion: number,
    wrapped: Buffer,
  ): Promise<boolean> {
    assertTenantId(tenantId);
    assertKeyVersion(keyVersion);
    return this.kv.putIfAbsent(
      this.wrappedKey(tenantId, keyVersion),
      wrapped.toString("base64"),
    );
  }

  async currentVersion(tenantId: string): Promise<number | undefined> {
    assertTenantId(tenantId);
    const v = await this.kv.get(this.currentKey(tenantId));
    return v === undefined ? undefined : parseStoredKeyVersion(v);
  }

  async setCurrentVersion(tenantId: string, keyVersion: number): Promise<void> {
    assertTenantId(tenantId);
    assertKeyVersion(keyVersion);
    const key = this.currentKey(tenantId);
    const next = String(keyVersion);
    for (;;) {
      const currentRaw = await this.kv.get(key);
      if (currentRaw !== undefined) {
        const current = parseStoredKeyVersion(currentRaw);
        if (current >= keyVersion) return;
      }
      if (await this.kv.compareAndSwap(key, currentRaw, next)) return;
    }
  }
}

export class KmsKeyProvider implements FieldKeyProvider {
  constructor(
    private readonly kms: KmsClient,
    private readonly store: WrappedKeyStore,
    private readonly operationOptions?: KmsOperationOptions,
  ) {}

  private assertWrappedDek(value: unknown): asserts value is Buffer {
    if (!Buffer.isBuffer(value) || value.length === 0) {
      throw new InternalError(
        "field-crypto: KMS returned an invalid non-empty wrapped DEK",
      );
    }
  }

  private assertPlaintextDek(value: unknown): asserts value is Buffer {
    if (!Buffer.isBuffer(value) || value.length !== 32) {
      throw new InternalError(
        "field-crypto: KMS returned an invalid 32-byte AES-256 DEK",
      );
    }
  }

  private wipeByteView(value: unknown): void {
    if (!ArrayBuffer.isView(value)) return;
    new Uint8Array(value.buffer, value.byteOffset, value.byteLength).fill(0);
  }

  private operationAbortError(): Error {
    const signal = this.operationOptions?.abortSignal;
    return signal?.reason instanceof Error
      ? signal.reason
      : new InternalError("field-crypto: KMS operation aborted");
  }

  private throwIfOperationAborted(): void {
    if (this.operationOptions?.abortSignal?.aborted === true) {
      throw this.operationAbortError();
    }
  }

  private wipeOnOperationAbort(value: unknown): () => void {
    const signal = this.operationOptions?.abortSignal;
    if (signal === undefined) return () => undefined;
    const wipe = (): void => {
      this.wipeByteView(value);
    };
    signal.addEventListener("abort", wipe, { once: true });
    if (signal.aborted) wipe();
    return () => signal.removeEventListener("abort", wipe);
  }

  private async recoverWrappedVersion(
    tenantId: string,
    keyVersion: number,
    preferDurableCurrent: boolean,
  ): Promise<number | undefined> {
    const wrapped = await this.store.getWrapped(tenantId, keyVersion);
    if (wrapped === undefined) return undefined;
    this.assertWrappedDek(wrapped);
    if (preferDurableCurrent) {
      const current = await this.store.currentVersion(tenantId);
      if (current !== undefined) {
        assertKeyVersion(current);
        return current;
      }
    }
    await this.store.setCurrentVersion(tenantId, keyVersion);
    const current = await this.store.currentVersion(tenantId);
    if (current === undefined) {
      throw new InternalError(
        "field-crypto: recovered wrapped DEK version was not durably visible",
      );
    }
    assertKeyVersion(current);
    return current;
  }

  /** Provision (or rotate to) a fresh wrapped DEK for a tenant; returns the new current version. */
  async provision(tenantId: string): Promise<number> {
    assertTenantId(tenantId);
    this.throwIfOperationAborted();
    const storedCurrent = await this.store.currentVersion(tenantId);
    this.throwIfOperationAborted();
    if (storedCurrent !== undefined) assertKeyVersion(storedCurrent);
    const cur = storedCurrent ?? 0;
    const next = cur + 1;
    if (next > MAX_KEY_VERSION) {
      throw new ValidationError(
        `field-crypto: key version overflow for tenant ${JSON.stringify(tenantId)}`,
      );
    }
    const recovered = await this.recoverWrappedVersion(tenantId, next, false);
    if (recovered !== undefined) return recovered;

    const generated: unknown = await this.kms.generateDataKey(
      tenantId,
      this.operationOptions,
    );
    const plaintextKey =
      typeof generated === "object" && generated !== null
        ? Reflect.get(generated, "plaintextKey")
        : undefined;
    let stopAbortWipe = (): void => undefined;
    try {
      const wrappedKey =
        typeof generated === "object" && generated !== null
          ? Reflect.get(generated, "wrappedKey")
          : undefined;
      this.assertPlaintextDek(plaintextKey);
      this.assertWrappedDek(wrappedKey);
      stopAbortWipe = this.wipeOnOperationAbort(plaintextKey);
      this.throwIfOperationAborted();
      const inserted = await this.store.putWrappedIfAbsent(
        tenantId,
        next,
        wrappedKey,
      );
      this.throwIfOperationAborted();
      if (!inserted) {
        throw new ConflictError(
          "field-crypto: concurrent rotation created this key version (append-only)",
          { tenantId, keyVersion: next },
        );
      }
      await this.store.setCurrentVersion(tenantId, next);
      this.throwIfOperationAborted();
      return next;
    } finally {
      stopAbortWipe();
      this.wipeByteView(plaintextKey);
    }
  }

  /**
   * Return an existing current version or provision version 1 exactly once.
   *
   * Concurrent first seals use the store's atomic insert-if-absent operation: one wrapped DEK wins,
   * every losing generated plaintext is zeroized, and all callers record/use version 1 without
   * overwriting the append-only winner.
   */
  async ensureProvisioned(tenantId: string): Promise<number> {
    assertTenantId(tenantId);
    this.throwIfOperationAborted();
    const current = await this.store.currentVersion(tenantId);
    this.throwIfOperationAborted();
    if (current !== undefined) {
      assertKeyVersion(current);
      return current;
    }
    const recovered = await this.recoverWrappedVersion(tenantId, 1, true);
    if (recovered !== undefined) return recovered;

    const generated: unknown = await this.kms.generateDataKey(
      tenantId,
      this.operationOptions,
    );
    const plaintextKey =
      typeof generated === "object" && generated !== null
        ? Reflect.get(generated, "plaintextKey")
        : undefined;
    let stopAbortWipe = (): void => undefined;
    try {
      const wrappedKey =
        typeof generated === "object" && generated !== null
          ? Reflect.get(generated, "wrappedKey")
          : undefined;
      this.assertPlaintextDek(plaintextKey);
      this.assertWrappedDek(wrappedKey);
      stopAbortWipe = this.wipeOnOperationAbort(plaintextKey);
      this.throwIfOperationAborted();
      const inserted = await this.store.putWrappedIfAbsent(
        tenantId,
        1,
        wrappedKey,
      );
      this.throwIfOperationAborted();
      if (inserted) {
        await this.store.setCurrentVersion(tenantId, 1);
        this.throwIfOperationAborted();
        return 1;
      }

      // ON CONFLICT waits for a concurrent winner to commit. Under READ COMMITTED this fresh
      // statement then sees both the winning wrapped DEK and its committed current-version row.
      const winner = await this.store.currentVersion(tenantId);
      this.throwIfOperationAborted();
      if (winner === undefined) {
        // A prior process may have committed the append-only wrapped DEK and failed before its
        // marker write. The loser can safely complete that idempotent transition without replacing
        // key material.
        await this.store.setCurrentVersion(tenantId, 1);
        this.throwIfOperationAborted();
        const repaired = await this.store.currentVersion(tenantId);
        this.throwIfOperationAborted();
        if (repaired === undefined) {
          throw new InternalError(
            "field-crypto: repaired current-version marker was not durably visible",
          );
        }
        assertKeyVersion(repaired);
        return repaired;
      }
      assertKeyVersion(winner);
      return winner;
    } finally {
      stopAbortWipe();
      this.wipeByteView(plaintextKey);
    }
  }

  async keyFor(tenantId: string, keyVersion: number): Promise<Buffer> {
    assertTenantId(tenantId);
    assertKeyVersion(keyVersion);
    const wrapped = await this.store.getWrapped(tenantId, keyVersion);
    if (wrapped === undefined) {
      throw new NotFoundError(
        `field-crypto: no wrapped DEK for tenant ${JSON.stringify(tenantId)} v${keyVersion} — provision first`,
      );
    }
    this.assertWrappedDek(wrapped);
    const plaintext: unknown = await this.kms.decryptDataKey(
      tenantId,
      wrapped,
      this.operationOptions,
    );
    try {
      this.assertPlaintextDek(plaintext);
      this.throwIfOperationAborted();
      return plaintext;
    } catch (error) {
      this.wipeByteView(plaintext);
      throw error;
    }
  }

  async currentVersion(tenantId: string): Promise<number> {
    assertTenantId(tenantId);
    const v = await this.store.currentVersion(tenantId);
    if (v === undefined) {
      throw new NotFoundError(
        `field-crypto: tenant ${JSON.stringify(tenantId)} has no provisioned KMS key — call provision()`,
      );
    }
    assertKeyVersion(v);
    return v;
  }

  /**
   * Request crypto-shred for this tenant/subject scope (ADR-0055, P2-9). The provider receipt states
   * whether deletion is still recoverable or proved irreversible. The append-only wrapped-DEK rows
   * are LEFT IN PLACE; their availability follows the provider-reported key state. Returns the
   * highest key version covered by the request. A missing durable current-version marker is refused:
   * callers cannot use this primitive to delete an unprovisioned or unbound external key scope.
   * Destructive workflow retries/reconciliation belong at the authorized host boundary.
   */
  async scheduleKeyDeletion(tenantId: string): Promise<{
    readonly shreddedThroughVersion: number;
    readonly deletion: KmsDeletionReceipt;
  }> {
    assertTenantId(tenantId);
    const storedCurrent = await this.store.currentVersion(tenantId);
    if (storedCurrent === undefined) {
      throw new NotFoundError(
        `field-crypto: tenant ${JSON.stringify(tenantId)} has no provisioned KMS key — refusing destructive deletion`,
      );
    }
    assertKeyVersion(storedCurrent);
    // Request-time abort budgets are intentionally not forwarded to destructive operations. A
    // provider acceptance followed by local timeout is ambiguous; the host must durably reconcile
    // deletion state and record the returned receipt.
    const deletion = await this.kms.scheduleKeyDeletion(tenantId);
    return { shreddedThroughVersion: storedCurrent, deletion };
  }
}

/**
 * A LOCAL wrap double for tests + local dev — wraps each DEK with AES-256-GCM under a per-scope KEK
 * (a real AEAD wrap, so the envelope round-trips). It is NOT a KMS: the master KEK lives in process.
 * The per-`keyId` wrapping KEK is HKDF-derived from the master, so `scheduleKeyDeletion` is SELECTIVE
 * — shredding one scope leaves every other scope's KEK (and ciphertext) intact. Its tombstone is
 * process-memory only: recreating the client with the same master recovers the KEK, so the local
 * backend reports recoverable soft deletion. Swap for a durable KMS driver in production.
 */
export class LocalKmsClient implements KmsClient {
  /** Non-secret HKDF domain-separation salt for the per-scope KEK (local double only). */
  private static readonly KEK_SALT = createHash("sha256")
    .update("caisson-local-kms-kek/v1")
    .digest();
  /** Master KEK; each scope's wrapping KEK is HKDF-derived from it + the `keyId`. */
  private readonly master: Buffer;
  /** Soft-deleted key ids (in-process tombstone only). */
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

  /** Reject any op on a soft-deleted scope for this client instance. */
  private assertLive(keyId: string): void {
    if (this.shredded.has(keyId)) {
      throw new NotFoundError(
        `field-crypto: key ${JSON.stringify(keyId)} was soft-deleted for this client instance — key operations are disabled`,
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

  async scheduleKeyDeletion(keyId: string): Promise<KmsDeletionReceipt> {
    // Refuse an empty scope — the port contract requires an explicit keyId for the crypto-shred, so a
    // missing scope can never fall through to a broader deletion (mirrors the AWS driver, ADR-0197).
    if (keyId.length === 0) {
      throw new ValidationError(
        "field-crypto: scheduleKeyDeletion requires an explicit keyId",
      );
    }
    // Tombstone this scope for the current process. The master remains available, so a new client can
    // derive the same scope KEK; the receipt must report that recovery boundary truthfully.
    this.shredded.add(keyId);
    return { state: "soft-deleted", irreversible: false };
  }
}

/**
 * AWS KMS adapter (ADR-0171 — wired). Real impl lives in `kms-aws.ts` (`createAwsKmsClient`) so this
 * file doesn't grow an `@aws-sdk/client-kms` dependency of its own; this export is kept for the
 * original documented-seam name. See `kms-aws.ts`'s header for the exact command mapping.
 *
 * GCP Cloud KMS is ALSO wired (ADR-0171 — the same binding pre-authorizes further drivers with no new
 * ADR): `createGcpKmsClient` in `kms-gcp.ts`, over `encrypt`/`decrypt`/`destroyCryptoKeyVersion` —
 * see that file's header for its command mapping. Azure Key Vault (`wrapKey`/`unwrapKey`/`deleteKey`)
 * and HashiCorp Vault Transit (`/transit/encrypt|decrypt`, delete the key) implement the same three
 * methods and are equally drop-in behind the `KmsClient` port, on demand.
 */
export function awsKmsClient(config: {
  keyId: string;
  region?: string;
}): KmsClient {
  return createAwsKmsClient(config);
}
