// The Drizzle `customType` encrypted column (ADR-0006/0046) — encrypt-on-write / decrypt-on-read,
// transparent to queries. `toDriver`/`fromDriver` are SYNCHRONOUS and CONTEXT-FREE, so the active
// tenant flows in through an AsyncLocalStorage the caller sets with `withFieldCryptoContext` (the
// Compliance edition wires this alongside `withTenant`, ADR-0005 — the encryption boundary EQUALS
// the RLS tenant boundary). No context bound → encrypt/decrypt REFUSE (fail-closed): a column can
// never be read or written outside a tenant scope. The sync derived-key path backs this; a KMS
// (async) provider pre-resolves + caches keys into the context (P2 wiring, not the sync hot-path).
import { AsyncLocalStorage } from "node:async_hooks";
import { InternalError, ValidationError } from "@caisson/kernel";
import { customType } from "drizzle-orm/pg-core";
import { type AeadCipher, aesGcm, cipherForAlg } from "./cipher.ts";
import { parseEnvelope, serializeEnvelope } from "./envelope.ts";
import { buildAad } from "./aad.ts";
import type { FieldKeyProvider, SyncFieldKeyProvider } from "./provider.ts";

/** The synchronous tenant context the column reads. Carries the tenant id + a sync key resolver. */
export interface FieldCryptoContext {
  readonly tenantId: string;
  /** Derive (or look up a pre-resolved) tenant key for a version — synchronously. */
  deriveKey(keyVersion: number): Buffer;
  /** The version a new write encrypts under. */
  currentVersion(): number;
}

/** A request-local KMS context whose plaintext DEKs can be actively zeroized at scope exit. */
export interface DisposableFieldCryptoContext extends FieldCryptoContext {
  /** Zero every prefetched DEK and make further key access fail closed. Idempotent. */
  dispose(): void;
}

const store = new AsyncLocalStorage<FieldCryptoContext>();

/** Run `fn` with the field-crypto tenant context bound. Wrap your tenant-scoped DB work in this. */
export function withFieldCryptoContext<T>(
  ctx: FieldCryptoContext,
  fn: () => T,
): T {
  return store.run(ctx, fn);
}

/** The bound context, or throw — never encrypt/decrypt unscoped (fail-closed, ADR-0005). */
export function currentFieldCryptoContext(): FieldCryptoContext {
  const ctx = store.getStore();
  if (ctx === undefined) {
    // A query reached an encrypted column outside `withFieldCryptoContext` — a wiring bug, not user
    // input. Fail closed as a 500 (never a partial/unscoped read); never coerce a tenant.
    throw new InternalError(
      "field-crypto: no tenant context bound — refusing to encrypt/decrypt unscoped (fail-closed)",
    );
  }
  return ctx;
}

/** Build a `FieldCryptoContext` from a sync provider (e.g. DerivedKeyProvider) for one tenant. */
export function derivedContext(
  provider: SyncFieldKeyProvider,
  tenantId: string,
): FieldCryptoContext {
  return {
    tenantId,
    deriveKey: (keyVersion) => provider.deriveKey(tenantId, keyVersion),
    currentVersion: () => provider.currentVersionSync(tenantId),
  };
}

/**
 * Build a synchronous request-local context from an async KMS provider.
 *
 * Every version from 1 through current is unwrapped before the context becomes usable, preserving
 * the no-remigration invariant for historical envelopes. The returned context MUST be disposed;
 * production callers should use {@link withKmsFieldCryptoContext}, which guarantees cleanup.
 */
export async function kmsContext(
  provider: FieldKeyProvider,
  tenantId: string,
): Promise<DisposableFieldCryptoContext> {
  if (tenantId.length === 0) {
    throw new ValidationError("field-crypto: tenantId is required");
  }
  const currentVersion = await provider.currentVersion(tenantId);
  if (
    !Number.isInteger(currentVersion) ||
    currentVersion < 1 ||
    currentVersion > 0xffff
  ) {
    throw new InternalError(
      "field-crypto: KMS provider returned an invalid current key version",
    );
  }

  const versions = Array.from(
    { length: currentVersion },
    (_, index) => index + 1,
  );
  const settled = await Promise.allSettled(
    versions.map((version) => provider.keyFor(tenantId, version)),
  );
  const keys = new Map<number, Buffer>();
  let failed = false;
  let failure: unknown;

  for (let index = 0; index < settled.length; index += 1) {
    const result = settled[index];
    const version = versions[index];
    if (result === undefined || version === undefined) {
      if (!failed) {
        failure = new InternalError(
          "field-crypto: KMS context prefetch result was incomplete",
        );
      }
      failed = true;
      continue;
    }
    if (result.status === "rejected") {
      if (!failed) {
        failure =
          result.reason ??
          new InternalError(
            "field-crypto: KMS provider rejected a DEK unwrap without an error",
          );
      }
      failed = true;
      continue;
    }
    if (result.value.length !== 32) {
      if (!failed) {
        failure = new InternalError(
          "field-crypto: KMS provider returned a DEK that is not 32 bytes",
        );
      }
      failed = true;
      result.value.fill(0);
      continue;
    }
    keys.set(version, result.value);
  }

  if (failed) {
    for (const key of keys.values()) key.fill(0);
    keys.clear();
    throw failure;
  }

  let disposed = false;
  const workingKeys = new Set<Buffer>();
  const assertLive = (): void => {
    if (disposed) {
      throw new InternalError(
        "field-crypto: KMS context is disposed — refusing key access",
      );
    }
  };

  return {
    tenantId,
    deriveKey(keyVersion) {
      assertLive();
      const key = keys.get(keyVersion);
      if (key === undefined) {
        throw new InternalError(
          `field-crypto: request KMS context has no prefetched key v${String(keyVersion)}`,
        );
      }
      // Track every working copy so even a caller that retains it cannot keep plaintext past scope.
      // sealField/openField zero copies eagerly; dispose() is the mandatory backstop for all callers.
      const workingKey = Buffer.from(key);
      workingKeys.add(workingKey);
      return workingKey;
    },
    currentVersion() {
      assertLive();
      return currentVersion;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const key of keys.values()) key.fill(0);
      keys.clear();
      for (const workingKey of workingKeys) workingKey.fill(0);
      workingKeys.clear();
    },
  };
}

/**
 * Bind a KMS-backed field context for one request and zero every prefetched plaintext DEK at exit.
 * AsyncLocalStorage propagates the context through awaited tenant work; cleanup runs on success or
 * failure and no context is retained process-wide.
 */
export async function withKmsFieldCryptoContext<T>(
  provider: FieldKeyProvider,
  tenantId: string,
  fn: (ctx: FieldCryptoContext) => Promise<T> | T,
): Promise<T> {
  const ctx = await kmsContext(provider, tenantId);
  try {
    return await withFieldCryptoContext(ctx, () => fn(ctx));
  } finally {
    ctx.dispose();
  }
}

/** Encrypt a plaintext under a context's current key version → the base64 envelope. (Pure; testable.) */
export function sealField(
  ctx: FieldCryptoContext,
  columnContext: string,
  plaintext: string,
  cipher: AeadCipher = aesGcm,
): string {
  const keyVersion = ctx.currentVersion();
  // `deriveKey()` may return a context-owned cached buffer. Operate on a caller-owned copy so
  // eager zeroization cannot corrupt the context's source key; disposable KMS contexts erase that
  // source material at request exit.
  const key = Buffer.from(ctx.deriveKey(keyVersion));
  try {
    const aad = buildAad(ctx.tenantId, keyVersion, columnContext);
    const { nonce, ciphertext, tag } = cipher.encrypt(
      key,
      Buffer.from(plaintext, "utf8"),
      aad,
    );
    return serializeEnvelope({
      algId: cipher.algId,
      keyVersion,
      nonce,
      ciphertext,
      tag,
    });
  } finally {
    key.fill(0);
  }
}

/** Decrypt a stored envelope under a context (key version comes from the envelope). (Pure; testable.) */
export function openField(
  ctx: FieldCryptoContext,
  columnContext: string,
  stored: string,
): string {
  const env = parseEnvelope(stored);
  const key = Buffer.from(ctx.deriveKey(env.keyVersion));
  try {
    const aad = buildAad(ctx.tenantId, env.keyVersion, columnContext);
    const cipher = cipherForAlg(env.algId);
    return cipher
      .decrypt(
        key,
        { nonce: env.nonce, ciphertext: env.ciphertext, tag: env.tag },
        aad,
      )
      .toString("utf8");
  } finally {
    key.fill(0);
  }
}

/**
 * An encrypted `text` column bound to a stable `columnContext` (the column's identity, bound into
 * AAD so a ciphertext cannot be moved to another column). Use inside a table definition:
 * `ssn: encryptedColumn("patient.ssn")("ssn")`. Reads the ambient tenant context (fail-closed).
 */
export function encryptedColumn(
  columnContext: string,
  cipher: AeadCipher = aesGcm,
) {
  return customType<{ data: string; driverData: string }>({
    dataType() {
      return "text";
    },
    toDriver(plaintext: string): string {
      return sealField(
        currentFieldCryptoContext(),
        columnContext,
        plaintext,
        cipher,
      );
    },
    fromDriver(stored: string): string {
      return openField(currentFieldCryptoContext(), columnContext, stored);
    },
  });
}
