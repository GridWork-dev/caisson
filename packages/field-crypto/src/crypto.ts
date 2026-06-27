// The high-level field-crypto API: ties a FieldKeyProvider (key management) + an AeadCipher
// (ADR-0045) + the versioned envelope (ADR-0046) + the AAD binding (ADR-0045). Fully async, so it
// works over ANY provider including KMS. The Drizzle column (column.ts) is the sync-context sibling
// for the derived-key hot-path; this is the general path used by application code and by the
// cross-tenant isolation integration test.
import { type AeadCipher, aesGcm, cipherForAlg } from "./cipher.ts";
import { parseEnvelope, serializeEnvelope } from "./envelope.ts";
import { buildAad } from "./aad.ts";
import type { FieldKeyProvider } from "./provider.ts";

export class TenantFieldCrypto {
  constructor(
    private readonly provider: FieldKeyProvider,
    private readonly cipher: AeadCipher = aesGcm,
  ) {}

  /**
   * Encrypt a field value for `tenantId` under the tenant's CURRENT key version, binding
   * `tenant_id || key_version || columnContext` as AAD. Returns the base64 envelope (ADR-0046).
   */
  async encryptField(
    tenantId: string,
    plaintext: string,
    columnContext: string,
  ): Promise<string> {
    const keyVersion = await this.provider.currentVersion(tenantId);
    const key = await this.provider.keyFor(tenantId, keyVersion);
    const aad = buildAad(tenantId, keyVersion, columnContext);
    const { nonce, ciphertext, tag } = this.cipher.encrypt(
      key,
      Buffer.from(plaintext, "utf8"),
      aad,
    );
    return serializeEnvelope({
      algId: this.cipher.algId,
      keyVersion,
      nonce,
      ciphertext,
      tag,
    });
  }

  /**
   * Decrypt a stored envelope for `tenantId`. The key version + algorithm come FROM the envelope
   * (self-describing, ADR-0046), so a value written under an older version still decrypts after
   * rotation. Throws on tamper, an AAD mismatch, or a cross-tenant key (the isolation proof).
   */
  async decryptField(
    tenantId: string,
    stored: string,
    columnContext: string,
  ): Promise<string> {
    const env = parseEnvelope(stored);
    const key = await this.provider.keyFor(tenantId, env.keyVersion);
    const aad = buildAad(tenantId, env.keyVersion, columnContext);
    const cipher = cipherForAlg(env.algId);
    const plaintext = cipher.decrypt(
      key,
      { nonce: env.nonce, ciphertext: env.ciphertext, tag: env.tag },
      aad,
    );
    return plaintext.toString("utf8");
  }
}
