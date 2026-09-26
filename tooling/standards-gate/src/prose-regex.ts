/**
 * Shared internal-prose regex vocabulary for the shipped-prose (`checkShippedProse`) and
 * changeset-source (`checkChangesetProse`) gates. One source of truth for what counts as an
 * "internal-only" term or a bare ADR citation, so the two checks can never independently drift
 * on the shape.
 */

/** The bare ADR-id shape (no `\b` boundaries — callers compose their own). */
export const ADR_ID_SOURCE = "ADR-\\d{4}";

/**
 * Internal-only vocabulary (SS-1/SS-2/SS-4): sibling-repo names, session/build-phase shorthand,
 * and internal issue-tracker ids. Deliberately excludes the ADR-id shape itself — a bare vs.
 * parenthetical ADR citation is judged separately (`BARE_ADR` / `hasBareAdrInDescription`), never
 * flagged here.
 */
export const INTERNAL_TERM =
  /\b(gridwork|tessera|media-pipeline|Wardfile|prospector|GW\s+Digital|CAISSON-\d+|Linear\s+\w|PR\s*#\d+|Wave-[0-9]|harvest\s+slice|picker\s+round|ponytail:)\b|\b(P[56]|T1[0-8]|Gate-[0-9]|fork-[a-z])\b/i;

/**
 * SS-3: a comment line whose only substantive content is an ADR citation — either
 * "see/per/cf ADR-NNNN" or the naked id itself, in line- or block-comment form, optionally a
 * comma/slash id list with trailing punctuation. The rule itself is unstated, only the id is
 * cited. A citation after real prose on the same line never matches (the shape is anchored to
 * the comment marker with nothing but the citation allowed before end-of-line).
 */
export const BARE_ADR = new RegExp(
  // Alternation: (a) citation-opener style — "see/per/cf ADR-NNNN" right after the comment
  // marker, trailing prose or not; (b) naked-id style — the line's ONLY content is the id
  // (or a comma/slash id list), optional period and block-comment close. A trailing `)` is
  // deliberately NOT allowed to end the naked form: a lone `// ADR-NNNN).` line is the wrap
  // tail of a parenthetical opened on the previous line, not a bare citation (this scan is
  // line-based and cannot see the opening line).
  `^\\s*(//|/\\*|\\*)\\s*(?:(?:see|per|cf\\.?)\\s+${ADR_ID_SOURCE}\\b|${ADR_ID_SOURCE}(?:\\s*[,/+]\\s*(?:${ADR_ID_SOURCE}|\\d{4}))*\\s*\\.?\\s*(?:\\*/)?\\s*$)`,
  "i",
);

/**
 * SS-12: true when `description` cites an ADR id without the parenthetical-after-≥4-plain-words
 * allowance — a trailing bare citation, or a parenthetical too close to the start of the sentence
 * to read as "state the capability first, the id second, parenthetically".
 */
export function hasBareAdrInDescription(description: string): boolean {
  const pattern = new RegExp(`${ADR_ID_SOURCE}(?:[/,]\\d{4})*`, "g");
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(description))) {
    const before = description.slice(0, match.index);
    const parenIdx = before.lastIndexOf("(");
    if (parenIdx === -1) return true;
    const words = before
      .slice(0, parenIdx)
      .trim()
      .split(/\s+/)
      .filter((w) => /^[A-Za-z]+$/.test(w));
    if (words.length < 4) return true;
  }
  return false;
}
