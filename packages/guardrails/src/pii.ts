// TS-native PII detection + redaction (ADR-0063). Four detectors (email / US-SSN /
// credit-card with a Luhn check / phone) over a
// deterministic overlap resolver, then three redaction modes:
//   - `mask`     → a fixed class placeholder (`[EMAIL]`), irreversible.
//   - `hash`     → a class placeholder + a stable SHA-256 prefix (`[EMAIL:ab12…]`), irreversible,
//                  but equal values map to equal tokens (correlatable without exposure).
//   - `tokenize` → REVERSIBLE: the original is sealed via field-crypto `sealField` and replaced with
//                  an opaque placeholder; `detokenizePii` restores it via `openField`. This is the
//                  redact-before-egress / restore-on-return round-trip (ADR-0055). The sole
//                  reversible path is field-crypto — never a bespoke crypto path here.
import { createHash } from "node:crypto";
import type { FieldCryptoContext } from "@caisson-sh/field-crypto";
import { sealField, openField } from "@caisson-sh/field-crypto";
import {
  PII_COLUMN_CONTEXT,
  assertBoundedGuardText,
  assertBoundedPiiTokens,
  detectPii,
  maskPii,
  replacePiiPlaceholderBounded,
  rewritePii,
} from "./pii-core.ts";
import type { PiiMatch, PiiToken, RedactMode } from "./pii-core.ts";

export {
  PII_KINDS,
  PII_COLUMN_CONTEXT,
  detectPii,
  maskPii,
} from "./pii-core.ts";
export type {
  PiiKind,
  PiiMatch,
  PiiToken,
  PiiMode,
  RedactMode,
} from "./pii-core.ts";

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Irreversibly redact every PII hit. `mask` → `[KIND]`; `hash` → `[KIND:<12-hex>]` (stable per
 * value). Returns the redacted text plus metadata-only matches (no raw value re-exposed downstream).
 */
export function redactPii(
  text: string,
  mode: RedactMode,
): { redacted: string; matches: PiiMatch[] } {
  const matches = detectPii(text);
  const replace =
    mode === "mask"
      ? (m: PiiMatch): string => `[${m.kind.toUpperCase()}]`
      : (m: PiiMatch): string =>
          `[${m.kind.toUpperCase()}:${sha256Hex(m.value).slice(0, 12)}]`;
  return {
    redacted:
      mode === "mask"
        ? maskPii(text, matches)
        : rewritePii(text, matches, replace),
    matches,
  };
}

/**
 * Reversibly tokenize every PII hit: seal the original via field-crypto under the bound tenant
 * context and replace it with an opaque indexed placeholder. The `tokens` travel alongside the
 * redacted text; `detokenizePii` restores the originals after the provider round-trip.
 */
export function tokenizePii(
  text: string,
  ctx: FieldCryptoContext,
): { redacted: string; tokens: PiiToken[] } {
  const matches = detectPii(text);
  const tokens: PiiToken[] = [];
  let i = 0;
  const redacted = rewritePii(text, matches, (m) => {
    const placeholder = `[[PII:${m.kind}:${i}]]`;
    tokens.push({
      placeholder,
      kind: m.kind,
      sealed: sealField(ctx, PII_COLUMN_CONTEXT, m.value),
    });
    i += 1;
    return placeholder;
  });
  return { redacted, tokens };
}

/**
 * Restore tokenized PII: for each token, open its field-crypto envelope under the same tenant
 * context and substitute every occurrence of the placeholder back in. A token whose placeholder no
 * longer appears (the provider dropped it) is simply skipped — never re-injected.
 */
export function detokenizePii(
  text: string,
  tokens: readonly PiiToken[],
  ctx: FieldCryptoContext,
): string {
  assertBoundedGuardText(text);
  assertBoundedPiiTokens(tokens);
  let out = text;
  for (const token of tokens) {
    if (!out.includes(token.placeholder)) continue;
    const original = openField(ctx, PII_COLUMN_CONTEXT, token.sealed);
    out = replacePiiPlaceholderBounded(out, token.placeholder, original);
  }
  return out;
}
