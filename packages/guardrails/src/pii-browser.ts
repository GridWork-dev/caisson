// WebCrypto PII twins. The detector/rewrite leaf is shared with the synchronous Node API; only the
// runtime-bound hash and field-crypto operations differ.
import {
  ALG_AES_256_GCM,
  aesGcmOpenAsync,
  aesGcmSealAsync,
  buildAadBytes,
  deriveTenantKeyAsync,
  parseEnvelopeBytes,
  serializeEnvelopeBytes,
} from "@caisson-sh/field-crypto/browser";
import {
  PII_COLUMN_CONTEXT,
  assertBoundedGuardText,
  assertBoundedPiiMatches,
  assertBoundedPiiTokens,
  detectPii,
  replacePiiPlaceholderBounded,
  rewritePii,
} from "./pii-core.ts";
import type { PiiMatch, PiiToken } from "./pii-core.ts";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/**
 * Browser-held field material. Deployments must inject this at runtime; a production master key
 * must never be compiled into an end-user bundle. The sync `FieldCryptoContext` remains Node-only.
 */
export interface BrowserPiiCryptoContext {
  readonly tenantId: string;
  readonly masterKey: Uint8Array;
  readonly salt: Uint8Array;
  readonly currentVersion: number;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    textEncoder.encode(value),
  );
  let hex = "";
  for (const byte of new Uint8Array(digest)) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

/** Browser-safe SHA-256 redaction, byte-identical to sync `redactPii(text, "hash")`. */
export async function hashPiiAsync(
  text: string,
  matches: readonly PiiMatch[] = detectPii(text),
): Promise<string> {
  assertBoundedPiiMatches(text, matches);
  const digests = await Promise.all(
    matches.map((match) => sha256Hex(match.value)),
  );
  return rewritePii(
    text,
    matches,
    (match, index) =>
      `[${match.kind.toUpperCase()}:${digests[index]!.slice(0, 12)}]`,
  );
}

/**
 * Seal every PII value with a fresh package-owned GCM nonce under the existing three-part AAD.
 * The result contains only redacted text and opaque token metadata; raw matches are not returned.
 */
export async function tokenizePiiAsync(
  text: string,
  ctx: BrowserPiiCryptoContext,
): Promise<{ redacted: string; tokens: PiiToken[] }> {
  const matches = detectPii(text);
  const key = await deriveTenantKeyAsync(
    ctx.masterKey,
    ctx.salt,
    ctx.currentVersion,
    ctx.tenantId,
  );
  try {
    const aad = buildAadBytes(
      ctx.tenantId,
      ctx.currentVersion,
      PII_COLUMN_CONTEXT,
    );
    const tokens: PiiToken[] = [];
    for (const [index, match] of matches.entries()) {
      // Serialize use of the derived byte array so `finally` can never wipe it while another
      // WebCrypto import is still pending after a sibling operation rejects.
      const sealed = await aesGcmSealAsync(
        key,
        textEncoder.encode(match.value),
        aad,
      );
      tokens.push({
        placeholder: `[[PII:${match.kind}:${index}]]`,
        kind: match.kind,
        sealed: serializeEnvelopeBytes({
          algId: ALG_AES_256_GCM,
          keyVersion: ctx.currentVersion,
          ...sealed,
        }),
      });
    }
    const redacted = rewritePii(
      text,
      matches,
      (_match, index) => tokens[index]!.placeholder,
    );
    return { redacted, tokens };
  } finally {
    key.fill(0);
  }
}

/**
 * Restore placeholders using each envelope's embedded key version. Dropped placeholders are never
 * re-injected, matching the synchronous API. Authentication/AAD failures throw fail-closed.
 */
export async function detokenizePiiAsync(
  text: string,
  tokens: readonly PiiToken[],
  ctx: BrowserPiiCryptoContext,
): Promise<string> {
  assertBoundedGuardText(text);
  assertBoundedPiiTokens(tokens);
  let output = text;
  for (const token of tokens) {
    if (!output.includes(token.placeholder)) continue;
    const envelope = parseEnvelopeBytes(token.sealed);
    const key = await deriveTenantKeyAsync(
      ctx.masterKey,
      ctx.salt,
      envelope.keyVersion,
      ctx.tenantId,
    );
    try {
      const aad = buildAadBytes(
        ctx.tenantId,
        envelope.keyVersion,
        PII_COLUMN_CONTEXT,
      );
      const plaintext = await aesGcmOpenAsync(key, envelope, aad);
      output = replacePiiPlaceholderBounded(
        output,
        token.placeholder,
        textDecoder.decode(plaintext),
      );
    } finally {
      key.fill(0);
    }
  }
  return output;
}
