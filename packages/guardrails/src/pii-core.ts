// Runtime-neutral PII detection and rewriting. This is the ONE detector used by both the existing
// synchronous Node API and the WebCrypto browser entry; neither surface carries a copied matcher.

export const PII_KINDS = ["email", "ssn", "credit_card", "phone"] as const;
export type PiiKind = (typeof PII_KINDS)[number];

/** The AAD-bound column identity the PII tokenizer seals under. */
export const PII_COLUMN_CONTEXT = "guardrails.pii";

export type RedactMode = "mask" | "hash";
export type PiiMode = RedactMode | "tokenize";

// Work bounds are code-unit based so they can be checked without allocating an encoded copy. Keep
// them internal to the package entries: they are denial-of-service ceilings, not product quotas.
export const MAX_GUARD_TEXT_CODE_UNITS = 100_000;
export const MAX_PII_MATCHES = 1_024;
export const MAX_PII_TOKENS = 1_024;
export const MAX_PII_ENVELOPE_CODE_UNITS = 262_144;
const MAX_PII_TOTAL_ENVELOPE_CODE_UNITS = 2_097_152;
const MAX_PII_PLACEHOLDER_CODE_UNITS = 128;

/** A located PII hit. `value` stays in-process for rewriting and sealing and is never emitted. */
export interface PiiMatch {
  readonly kind: PiiKind;
  readonly value: string;
  readonly start: number;
  readonly end: number;
}

/** A reversible token: an opaque placeholder plus an authenticated field-crypto envelope. */
export interface PiiToken {
  readonly placeholder: string;
  readonly kind: PiiKind;
  readonly sealed: string;
}

export function assertBoundedGuardText(text: string): void {
  if (text.length > MAX_GUARD_TEXT_CODE_UNITS) {
    throw new RangeError(
      `guardrails: text exceeds ${MAX_GUARD_TEXT_CODE_UNITS} code units`,
    );
  }
}

export function assertBoundedPiiMatches(
  text: string,
  matches: readonly PiiMatch[],
): void {
  assertBoundedGuardText(text);
  if (matches.length > MAX_PII_MATCHES) {
    throw new RangeError(
      `guardrails: PII match count exceeds ${MAX_PII_MATCHES}`,
    );
  }
  let totalValueCodeUnits = 0;
  for (const match of matches) {
    if (
      !Number.isInteger(match.start) ||
      !Number.isInteger(match.end) ||
      match.start < 0 ||
      match.end < match.start ||
      match.end > text.length
    ) {
      throw new RangeError("guardrails: invalid PII match span");
    }
    totalValueCodeUnits += match.value.length;
    if (totalValueCodeUnits > MAX_GUARD_TEXT_CODE_UNITS) {
      throw new RangeError(
        `guardrails: PII match values exceed ${MAX_GUARD_TEXT_CODE_UNITS} code units`,
      );
    }
  }
}

export function assertBoundedPiiTokens(tokens: readonly PiiToken[]): void {
  if (tokens.length > MAX_PII_TOKENS) {
    throw new RangeError(
      `guardrails: PII token count exceeds ${MAX_PII_TOKENS}`,
    );
  }
  let totalEnvelopeCodeUnits = 0;
  for (const token of tokens) {
    if (
      token.placeholder.length === 0 ||
      token.placeholder.length > MAX_PII_PLACEHOLDER_CODE_UNITS
    ) {
      throw new RangeError("guardrails: invalid PII token placeholder length");
    }
    if (token.sealed.length > MAX_PII_ENVELOPE_CODE_UNITS) {
      throw new RangeError(
        `guardrails: PII envelope exceeds ${MAX_PII_ENVELOPE_CODE_UNITS} code units`,
      );
    }
    totalEnvelopeCodeUnits += token.sealed.length;
    if (totalEnvelopeCodeUnits > MAX_PII_TOTAL_ENVELOPE_CODE_UNITS) {
      throw new RangeError(
        `guardrails: total PII envelope input exceeds ${MAX_PII_TOTAL_ENVELOPE_CODE_UNITS} code units`,
      );
    }
  }
}

/** Replace a restored token only after proving the resulting string stays under the text ceiling. */
export function replacePiiPlaceholderBounded(
  text: string,
  placeholder: string,
  plaintext: string,
): string {
  assertBoundedGuardText(text);
  assertBoundedGuardText(plaintext);
  if (
    placeholder.length === 0 ||
    placeholder.length > MAX_PII_PLACEHOLDER_CODE_UNITS
  ) {
    throw new RangeError("guardrails: invalid PII token placeholder length");
  }
  let occurrences = 0;
  let cursor = 0;
  while (true) {
    const found = text.indexOf(placeholder, cursor);
    if (found === -1) break;
    occurrences += 1;
    cursor = found + placeholder.length;
  }
  const growthPerOccurrence = plaintext.length - placeholder.length;
  if (
    growthPerOccurrence > 0 &&
    occurrences >
      Math.floor(
        (MAX_GUARD_TEXT_CODE_UNITS - text.length) / growthPerOccurrence,
      )
  ) {
    throw new RangeError(
      `guardrails: restored text exceeds ${MAX_GUARD_TEXT_CODE_UNITS} code units`,
    );
  }
  return text.split(placeholder).join(plaintext);
}

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

const DETECTORS: readonly Detector[] = [
  { kind: "email", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  { kind: "ssn", re: /\b\d{3}-\d{2}-\d{4}\b/g },
  {
    kind: "phone",
    re: /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g,
  },
  {
    kind: "credit_card",
    re: /\d(?:[ -]?\d){12,18}/g,
    validate: luhnValid,
  },
];

/** Detect PII and resolve overlaps by start, longest span, then kind. */
export function detectPii(text: string): PiiMatch[] {
  assertBoundedGuardText(text);
  const all: PiiMatch[] = [];
  for (const detector of DETECTORS) {
    for (const match of text.matchAll(detector.re)) {
      if (match.index === undefined) continue;
      const value = match[0];
      if (detector.validate !== undefined && !detector.validate(value)) {
        continue;
      }
      if (all.length >= MAX_PII_MATCHES) {
        throw new RangeError(
          `guardrails: PII match count exceeds ${MAX_PII_MATCHES}`,
        );
      }
      all.push({
        kind: detector.kind,
        value,
        start: match.index,
        end: match.index + value.length,
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
  for (const match of all) {
    if (match.start >= lastEnd) {
      resolved.push(match);
      lastEnd = match.end;
    }
  }
  return resolved;
}

/** Internal shared rewrite leaf. Callers must pass the ordered matches returned by `detectPii`. */
export function rewritePii(
  text: string,
  matches: readonly PiiMatch[],
  replace: (match: PiiMatch, index: number) => string,
): string {
  assertBoundedPiiMatches(text, matches);
  let output = "";
  let last = 0;
  matches.forEach((match, index) => {
    output += text.slice(last, match.start) + replace(match, index);
    last = match.end;
  });
  return output + text.slice(last);
}

/** Irreversibly replace each PII value with its class marker. */
export function maskPii(
  text: string,
  matches: readonly PiiMatch[] = detectPii(text),
): string {
  return rewritePii(text, matches, (match) => `[${match.kind.toUpperCase()}]`);
}
