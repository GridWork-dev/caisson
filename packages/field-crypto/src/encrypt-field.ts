// Row-bound field encryption (ADR-0055 — closes threat-model gaps TM2/TM-E). The explicit sibling of the
// transparent column (column.ts `sealField`/`openField`): it threads the row's stable PK into the AAD
// as a 4-tuple `tenant∥kv∥column∥rowId`, so a ciphertext relocated to (or rolled back from) another
// row of the SAME tenant+column+key_version fails to authenticate. SEC/HIPAA columns MUST use this
// path; low-sensitivity fields may stay on the transparent 3-tuple column.
//
// WHY EXPLICIT (not the Drizzle `customType` seam): `toDriver`/`fromDriver` see only the cell value,
// never the row's PK, so the transparent column cannot bind a row id. The caller therefore supplies
// the `FieldCryptoContext` AND the `rowId` here.
//
// ROW-ID REQUIREMENT — the `rowId` MUST be the row's STABLE primary key, known BEFORE the INSERT so
// the AAD can be computed at encrypt time. Use a client-minted `crypto.randomUUID()` PK (ADR-0055):
// a DB-generated serial/identity is assigned only AFTER the INSERT, by which point the ciphertext is
// already sealed — there is no value to bind to. The PK must also be immutable (re-keying a row to a
// new PK would strand its encrypted cells, which is the intended tamper-evidence, not a bug).
//
// Fail-closed: a degenerate `rowId` is rejected up front, and any AAD mismatch (wrong row, column,
// tenant, or key version) surfaces as an AEAD authentication failure on decrypt — never a silent
// wrong-plaintext read.
import { ValidationError } from "@caisson-sh/kernel";
import { type AeadCipher, aesGcm, cipherForAlg } from "./cipher.ts";
import { parseEnvelope, serializeEnvelope } from "./envelope.ts";
import { buildAad } from "./aad.ts";
import type { FieldCryptoContext } from "./column.ts";

/**
 * Reject a missing/blank `rowId` before it can collapse the row binding. An empty id would bind
 * every row of a column to the same degenerate AAD element, defeating cross-row tamper-evidence —
 * fail closed rather than encrypt under a useless binding.
 */
function assertRowId(rowId: string): void {
  if (typeof rowId !== "string" || rowId.trim() === "") {
    throw new ValidationError(
      "field-crypto: encryptField requires a non-empty rowId (the row's stable crypto.randomUUID() PK) — refusing to bind a degenerate row identity (fail-closed)",
    );
  }
}

/**
 * Encrypt `plaintext` for one row under the context's CURRENT key version, binding the 4-tuple
 * `tenant∥keyVersion∥columnContext∥rowId` as AAD. Returns the base64 envelope (ADR-0046). Pure +
 * testable: the tenant context and row id are explicit. `rowId` must be the row's stable
 * `crypto.randomUUID()` PK (see the file header).
 */
export function encryptField(
  ctx: FieldCryptoContext,
  columnContext: string,
  rowId: string,
  plaintext: string,
  cipher: AeadCipher = aesGcm,
): string {
  assertRowId(rowId);
  const keyVersion = ctx.currentVersion();
  // The key is lent for this operation only; the context wipes it when this callback returns.
  return ctx.withKey(keyVersion, (key) => {
    const aad = buildAad(ctx.tenantId, keyVersion, columnContext, rowId);
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
  });
}

/**
 * Decrypt a row-bound envelope. The key version + algorithm come FROM the envelope (self-describing,
 * ADR-0046), so a value written under an older version still decrypts after rotation. The SAME
 * `columnContext` + `rowId` used at encrypt time must be supplied; any mismatch (cross-row,
 * cross-column, cross-tenant, or tamper) throws on AEAD authentication — fail-closed, never a silent
 * wrong-plaintext read.
 */
export function decryptField(
  ctx: FieldCryptoContext,
  columnContext: string,
  rowId: string,
  stored: string,
): string {
  assertRowId(rowId);
  const env = parseEnvelope(stored);
  return ctx.withKey(env.keyVersion, (key) => {
    const aad = buildAad(ctx.tenantId, env.keyVersion, columnContext, rowId);
    const cipher = cipherForAlg(env.algId);
    return cipher
      .decrypt(
        key,
        { nonce: env.nonce, ciphertext: env.ciphertext, tag: env.tag },
        aad,
      )
      .toString("utf8");
  });
}
