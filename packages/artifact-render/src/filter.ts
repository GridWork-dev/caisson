// src/filter.ts — the readiness-language claim filter (ADR-0080 copy law).
//
// Every customer-facing compliance surface in this repo (the pack-format `postureCopy` field, the
// crosswalk-rollup cell `note`, the regime-crosswalk disclaimers) independently re-derives the same
// rule: Caisson never claims "compliant" / "certified" / "verified" for itself — readiness/posture
// language only. This is that rule, factored ONE place so a new render path (the ISO 27001 SoA, the
// trust page) reuses it instead of re-deriving the regex. FAIL CLOSED: a caller that skips this
// check ships un-filtered prose, which is why every render primitive in this package (citation rows)
// routes free-text fields through it before they reach an artifact.
import { ValidationError } from "@caisson-sh/kernel";

/**
 * The banned claim words (case-insensitive, word-bounded) — the union of every existing guard in the
 * repo: `compliant`/`certified` (pack-format.ts `postureCopy`) plus `verified` (crosswalk-rollup.ts
 * cell `note`). Caisson is a toolmaker, never an assessed/certified entity for its own product.
 */
export const READINESS_LANGUAGE_BANNED_WORDS_RE =
  /\b(compliant|certified|verified)\b/i;

/**
 * True iff `text` uses readiness/posture language only (no banned claim word). Pure predicate — use
 * {@link assertReadinessLanguage} at a construction boundary where a violation should fail closed.
 */
export function isReadinessLanguage(text: string): boolean {
  return !READINESS_LANGUAGE_BANNED_WORDS_RE.test(text);
}

/**
 * Fail-closed guard: throws a redaction-safe `ValidationError` when `text` uses a banned claim word.
 * `field` names the offending field in the error message (never echoes the text itself — the message
 * states the rule, not the input, so it stays safe to surface to a caller/log without leaking prose).
 */
export function assertReadinessLanguage(text: string, field: string): void {
  if (!isReadinessLanguage(text)) {
    throw new ValidationError(
      `${field} must use readiness/posture language, never claim "compliant"/"certified"/"verified" (ADR-0080)`,
    );
  }
}
