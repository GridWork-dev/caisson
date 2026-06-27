// The FieldKeyProvider port (ADR-0043). Key MANAGEMENT sits behind one interface; the ciphertext
// format, the column type, and the rotation registry are unchanged when a buyer swaps providers.
//   - DerivedKeyProvider (default) — per-tenant HKDF derivation, zero infra. Exposes a SYNCHRONOUS
//     `deriveKey` for the Drizzle column hot-path (toDriver/fromDriver are sync; HKDF is sync).
//   - KmsKeyProvider (kms.ts) — async envelope encryption behind the same port (network behind it).
import { z } from "zod";
import { ConfigError } from "@caisson/kernel";
import { deriveTenantKey } from "./derive.ts";
import { KeyVersionRegistry } from "./registry.ts";

/**
 * The async key-management port (ADR-0043). `keyFor` returns a tenant's data-encryption key bytes
 * for a given version; `currentVersion` reports the version a new write should use. (The ADR sketch
 * names `CryptoKey`; `node:crypto` symmetric ciphers take raw key bytes, so the DEK is a `Buffer`.)
 */
export interface FieldKeyProvider {
  keyFor(tenantId: string, keyVersion: number): Promise<Buffer>;
  currentVersion(tenantId: string): Promise<number>;
}

/** Providers whose key derivation is synchronous can back the Drizzle column directly. */
export interface SyncFieldKeyProvider extends FieldKeyProvider {
  deriveKey(tenantId: string, keyVersion: number): Buffer;
  currentVersionSync(tenantId: string): number;
}

const HEX_32_BYTES = z
  .string()
  .regex(/^[0-9a-fA-F]{64}$/, "must be 64 hex chars (32 bytes)");

/** Strict over ONLY the two field-crypto vars (never the whole env), so other vars are not rejected. */
const FieldCryptoEnv = z
  .object({ MASTER_FIELD_KEY: HEX_32_BYTES, FIELD_CRYPTO_SALT: HEX_32_BYTES })
  .strict();

export class DerivedKeyProvider implements SyncFieldKeyProvider {
  // The master key is a hard secret — a true-private field so it can never be enumerated, JSON
  // -serialized, or logged. Read once at construction, never written to any log/egress path.
  readonly #masterKey: Buffer;
  // The salt is per-deployment and NON-secret (ADR-0043, Fork 3).
  readonly #salt: Buffer;
  readonly registry: KeyVersionRegistry;

  constructor(
    masterKey: Buffer,
    salt: Buffer,
    registry = new KeyVersionRegistry(),
  ) {
    if (masterKey.length !== 32) {
      throw new ConfigError("field-crypto: MASTER_FIELD_KEY must be 32 bytes");
    }
    if (salt.length !== 32) {
      throw new ConfigError("field-crypto: FIELD_CRYPTO_SALT must be 32 bytes");
    }
    this.#masterKey = masterKey;
    this.#salt = salt;
    this.registry = registry;
  }

  /** Build from validated env (hex-encoded 32-byte master + salt). The values never get logged. */
  static fromEnv(
    env: Record<string, string | undefined> = process.env,
    registry = new KeyVersionRegistry(),
  ): DerivedKeyProvider {
    // Map a Zod parse failure to a typed ConfigError — a fixed message that NEVER echoes the env
    // value (the key material must not reach a log/HTTP envelope).
    let parsed: z.infer<typeof FieldCryptoEnv>;
    try {
      parsed = FieldCryptoEnv.parse({
        MASTER_FIELD_KEY: env.MASTER_FIELD_KEY,
        FIELD_CRYPTO_SALT: env.FIELD_CRYPTO_SALT,
      });
    } catch {
      throw new ConfigError(
        "field-crypto: MASTER_FIELD_KEY and FIELD_CRYPTO_SALT must each be 64 hex chars (32 bytes)",
      );
    }
    return new DerivedKeyProvider(
      Buffer.from(parsed.MASTER_FIELD_KEY, "hex"),
      Buffer.from(parsed.FIELD_CRYPTO_SALT, "hex"),
      registry,
    );
  }

  deriveKey(tenantId: string, keyVersion: number): Buffer {
    return deriveTenantKey(this.#masterKey, this.#salt, keyVersion, tenantId);
  }

  currentVersionSync(tenantId: string): number {
    return this.registry.currentVersion(tenantId);
  }

  async keyFor(tenantId: string, keyVersion: number): Promise<Buffer> {
    return this.deriveKey(tenantId, keyVersion);
  }

  async currentVersion(tenantId: string): Promise<number> {
    return this.currentVersionSync(tenantId);
  }

  /** Never serialize the master key — redact if this provider is ever stringified. */
  toJSON(): Record<string, string> {
    return { provider: "DerivedKeyProvider", masterKey: "[redacted]" };
  }
}
