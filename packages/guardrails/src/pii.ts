// TS-native PII detection + redaction (ADR-0063). Built FRESH — no `media-pipeline` seed; PUBLIC
// patterns only. Four detectors (email / US-SSN / credit-card with a Luhn check / phone) over a
// deterministic overlap resolver, then three redaction modes:
//   - `mask`     → a fixed class placeholder (`[EMAIL]`), irreversible.
//   - `hash`     → a class placeholder + a stable SHA-256 prefix (`[EMAIL:ab12…]`), irreversible,
//                  but equal values map to equal tokens (correlatable without exposure).
//   - `tokenize` → REVERSIBLE: the original is sealed via field-crypto `sealField` and replaced with
//                  an opaque placeholder; `detokenizePii` restores it via `openField`. This is the
//                  redact-before-egress / restore-on-return round-trip (ADR-0055/TM4). The sole
//                  reversible path is field-crypto — never a bespoke crypto path here.
import { createHash } from "node:crypto";
import type { FieldCryptoContext } from "@caisson/field-crypto";
import { sealField, openField } from "@caisson/field-crypto";

export const PII_KINDS = ["email", "ssn", "credit_card", "phone"] as const;
export type PiiKind = (typeof PII_KINDS)[number];

/** The AAD-bound column identity the PII tokenizer seals under (binds the ciphertext to this use). */
export const PII_COLUMN_CONTEXT = "guardrails.pii";

export type RedactMode = "mask" | "hash";
export type PiiMode = RedactMode | "tokenize";

/** A located PII hit. `value` is held only in-process for sealing/redaction — never emitted. */
export interface PiiMatch {
  readonly kind: PiiKind;
  readonly value: string;
  readonly start: number;
  readonly end: number;
}

/** A reversible token: the opaque placeholder left in the text + the field-crypto envelope for it. */
export interface PiiToken {
  readonly placeholder: string;
  readonly kind: PiiKind;
  /** The field-crypto envelope (base64) — opening it requires the same tenant context. */
  readonly sealed: string;
}

/** Luhn check over the digits of a candidate card number (13–19 digits). */
function luhnValid(candidate: string): boolean {
  const digits = candidate.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (double) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    double = !double;
  }
  return sum % 10 === 0;
}

interface Detector {
  readonly kind: PiiKind;
  readonly re: RegExp;
  readonly validate?: (value: string) => boolean;
}

// Order is informational only — overlaps are resolved deterministically below. Each `re` is global.
const DETECTORS: readonly Detector[] = [
  { kind: "email", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  { kind: "ssn", re: /\b\d{3}-\d{2}-\d{4}\b/g },
  {
    // 3-3-4 with a separator — distinct from SSN's 3-2-4 middle group, so the two never collide.
    kind: "phone",
    re: /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g,
  },
  {
    // 13–19 digits with optional single separators; only accepted when Luhn-valid.
    kind: "credit_card",
    re: /\d(?:[ -]?\d){12,18}/g,
    validate: luhnValid,
  },
];

/**
 * Detect PII in `text`. Runs every detector, then resolves overlaps deterministically: earliest
 * start wins, ties broken by longest span (a 16-digit card beats a phone-shaped substring inside
 * it), then by kind name — so the same input always redacts identically (golden-stable).
 */
export function detectPii(text: string): PiiMatch[] {
  const all: PiiMatch[] = [];
  for (const det of DETECTORS) {
    for (const m of text.matchAll(det.re)) {
      if (m.index === undefined) continue;
      const value = m[0];
      if (det.validate !== undefined && !det.validate(value)) continue;
      all.push({
        kind: det.kind,
        value,
        start: m.index,
        end: m.index + value.length,
      });
    }
  }
  all.sort(
    (a, b) =>
      a.start - b.start ||
      b.end - b.start - (a.end - a.start) ||
      a.kind.localeCompare(b.kind),
  );
  const resolved: PiiMatch[] = [];
  let lastEnd = -1;
  for (const m of all) {
    if (m.start >= lastEnd) {
      resolved.push(m);
      lastEnd = m.end;
    }
  }
  return resolved;
}

/** Rebuild `text`, replacing each resolved match span via `replace(match)`. */
function rewrite(
  text: string,
  matches: readonly PiiMatch[],
  replace: (m: PiiMatch) => string,
): string {
  let out = "";
  let last = 0;
  for (const m of matches) {
    out += text.slice(last, m.start) + replace(m);
    last = m.end;
  }
  return out + text.slice(last);
}

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
  return { redacted: rewrite(text, matches, replace), matches };
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
  const redacted = rewrite(text, matches, (m) => {
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
  let out = text;
  for (const token of tokens) {
    if (!out.includes(token.placeholder)) continue;
    const original = openField(ctx, PII_COLUMN_CONTEXT, token.sealed);
    out = out.split(token.placeholder).join(original);
  }
  return out;
}
