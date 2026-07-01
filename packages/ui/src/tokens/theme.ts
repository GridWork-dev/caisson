/**
 * The LOCKED selection (operator pick, 2026-06-27): palette A "Caisson cold-steel teal" +
 * type 2 "Structural" (Hubot Sans + Martian Mono). Recorded in ADR-0042. Changing the pick =
 * change `SELECTED_*` here, then `bun run gen:tokens`. Append-only spirit: the candidate sets
 * in `candidates.ts` stay; only the pointer moves.
 */
import {
  accentCandidates,
  functional,
  functionalDark,
  functionalLight,
  typeCandidates,
} from "./candidates";
import type { AccentCandidate, SemanticTheme, TypeCandidate } from "./types";

const SELECTED_PALETTE = "a";
const SELECTED_TYPE = "2";

function requireCandidate<T extends { id: string }>(
  list: readonly T[],
  id: string,
  kind: string,
): T {
  const found = list.find((c) => c.id === id);
  if (!found) throw new Error(`No ${kind} candidate with id "${id}"`);
  return found;
}

const palette: AccentCandidate = requireCandidate(
  accentCandidates,
  SELECTED_PALETTE,
  "palette",
);
const type: TypeCandidate = requireCandidate(
  typeCandidates,
  SELECTED_TYPE,
  "type",
);

export const darkTheme: SemanticTheme = palette.dark;
export const lightTheme: SemanticTheme = palette.light;
export { functional, functionalDark, functionalLight };

/**
 * Locked font stacks. Wrapped in the `next/font` CSS variables the site sets on <html>
 * (`apps/site/lib/fonts.ts`) with the literal candidate stack as the fallback — so the site
 * self-hosts the woff2 (ADR-0079 §4) while any context without next/font (the studio) still
 * resolves the named family. `mono` (Martian Mono, ADR-0078 §1 / ADR-0195) is the SINGLE
 * monospace surface — brand/label/numeral AND code blocks (JetBrains Mono dropped, D-7).
 */
export const fonts = {
  sans: `var(--font-sans, ${type.sans})`,
  mono: `var(--font-mono, ${type.mono})`,
} as const;

/** The locked selection ids — surfaced in the studio so the lock is visible. */
export const selected = {
  palette: SELECTED_PALETTE,
  type: SELECTED_TYPE,
} as const;
