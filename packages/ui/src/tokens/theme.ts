/**
 * The LOCKED default selection. Until the operator picks in the studio, the default is the
 * recommended candidate (palette A "Caisson cold-steel teal" + type 1 "Instrument"). Changing
 * the pick = change `SELECTED_*` here, then `bun run gen:tokens`. Append-only spirit: the
 * candidate sets in `candidates.ts` stay; only the pointer moves.
 */
import { accentCandidates, functional, typeCandidates } from "./candidates";
import type { AccentCandidate, SemanticTheme, TypeCandidate } from "./types";

const SELECTED_PALETTE = "a";
const SELECTED_TYPE = "1";

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
export { functional };

/** Locked font stacks. */
export const fonts = {
  sans: type.sans,
  mono: type.mono,
} as const;

/** The locked selection ids — surfaced in the studio so the lock is visible. */
export const selected = {
  palette: SELECTED_PALETTE,
  type: SELECTED_TYPE,
} as const;
