// Runtime-neutral PII detection and rewriting. This is the ONE detector used by both the existing
// synchronous Node API and the WebCrypto browser entry; neither surface carries a copied matcher.

export const PII_KINDS = ["email", "ssn", "credit_card", "phone"] as const;
export type PiiKind = (typeof PII_KINDS)[number];

/** The AAD-bound column identity the PII tokenizer seals under. */
export const PII_COLUMN_CONTEXT = "guardrails.pii";

export type RedactMode = "mask" | "hash";
export type PiiMode = RedactMode | "tokenize";

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
  const all: PiiMatch[] = [];
  for (const detector of DETECTORS) {
    for (const match of text.matchAll(detector.re)) {
      if (match.index === undefined) continue;
      const value = match[0];
      if (detector.validate !== undefined && !detector.validate(value)) {
        continue;
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
