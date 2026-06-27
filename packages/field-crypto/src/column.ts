// The Drizzle `customType` encrypted column (ADR-0006/0046) — encrypt-on-write / decrypt-on-read,
// transparent to queries. `toDriver`/`fromDriver` are SYNCHRONOUS and CONTEXT-FREE, so the active
// tenant flows in through an AsyncLocalStorage the caller sets with `withFieldCryptoContext` (the
// Compliance edition wires this alongside `withTenant`, ADR-0005 — the encryption boundary EQUALS
// the RLS tenant boundary). No context bound → encrypt/decrypt REFUSE (fail-closed): a column can
// never be read or written outside a tenant scope. The sync derived-key path backs this; a KMS
// (async) provider pre-resolves + caches keys into the context (P2 wiring, not the sync hot-path).
import { AsyncLocalStorage } from "node:async_hooks";
import { customType } from "drizzle-orm/pg-core";
import { type AeadCipher, aesGcm, cipherForAlg } from "./cipher.ts";
import { parseEnvelope, serializeEnvelope } from "./envelope.ts";
import { buildAad } from "./aad.ts";
import type { SyncFieldKeyProvider } from "./provider.ts";

/** The synchronous tenant context the column reads. Carries the tenant id + a sync key resolver. */
export interface FieldCryptoContext {
  readonly tenantId: string;
  /** Derive (or look up a pre-resolved) tenant key for a version — synchronously. */
  deriveKey(keyVersion: number): Buffer;
  /** The version a new write encrypts under. */
  currentVersion(): number;
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
    throw new Error(
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

/** Encrypt a plaintext under a context's current key version → the base64 envelope. (Pure; testable.) */
export function sealField(
  ctx: FieldCryptoContext,
  columnContext: string,
  plaintext: string,
  cipher: AeadCipher = aesGcm,
): string {
  const keyVersion = ctx.currentVersion();
  const key = ctx.deriveKey(keyVersion);
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
}

/** Decrypt a stored envelope under a context (key version comes from the envelope). (Pure; testable.) */
export function openField(
  ctx: FieldCryptoContext,
  columnContext: string,
  stored: string,
): string {
  const env = parseEnvelope(stored);
  const key = ctx.deriveKey(env.keyVersion);
  const aad = buildAad(ctx.tenantId, env.keyVersion, columnContext);
  const cipher = cipherForAlg(env.algId);
  return cipher
    .decrypt(
      key,
      { nonce: env.nonce, ciphertext: env.ciphertext, tag: env.tag },
      aad,
    )
    .toString("utf8");
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
