/**
 * The preset registry (ADR-0250 G2b). The three locked OKLCH candidates (`../tokens/candidates.ts`
 * — palette A/B/C, evaluated live in the studio and otherwise a build-time-only discard) ship as
 * registrable presets here instead. `"caisson"` (candidate "a") is the default, matching the
 * locked selection in `../tokens/theme.ts`.
 */
import { accentCandidates } from "../tokens/candidates.ts";
import type { AccentCandidate } from "../tokens/types.ts";
import { themePresetSchema } from "./types.ts";
import type { ThemePreset } from "./types.ts";

/** Candidate id -> preset slug. Each candidate's own `name` already leads with this word
 *  ("Caisson · cold-steel teal", "Pressure · deep moss", "Bulkhead · near-monochrome"). */
const BUILTIN_SLUGS: Record<AccentCandidate["id"], string> = {
  a: "caisson",
  b: "pressure",
  c: "bulkhead",
};

/** The preset `createTheme()` resolves to when no `preset` is given. */
export const DEFAULT_PRESET_ID = "caisson";

const registry = new Map<string, ThemePreset>();

/** Freeze a parsed preset + its nested `dark`/`light` maps so getPreset/listPresets can't hand a
 *  consumer a live handle to corrupt a built-in. Two levels deep is the whole shape. */
function freezePreset(preset: ThemePreset): ThemePreset {
  Object.freeze(preset.dark);
  Object.freeze(preset.light);
  return Object.freeze(preset);
}

for (const candidate of accentCandidates) {
  const id = BUILTIN_SLUGS[candidate.id];
  registry.set(
    id,
    freezePreset(
      themePresetSchema.parse({
        id,
        name: candidate.name,
        dark: candidate.dark,
        light: candidate.light,
      }),
    ),
  );
}

/**
 * Register a named preset. Validated `.strict()` — an unknown key or a missing/empty token
 * throws. Presets are append-only by id: re-registering an existing id with an identical
 * (deep-equal) shape is a harmless no-op, but a DIFFERENT shape under an existing id throws —
 * a silent overwrite would flip every consumer already resolved to that id underfoot.
 */
export function registerPreset(preset: ThemePreset): void {
  const parsed = themePresetSchema.parse(preset);
  const existing = registry.get(parsed.id);
  // Equality relies on Zod normalizing key order + every field being required (no optionals) so
  // two equal shapes stringify identically. Revisit if optional token fields are ever added.
  if (existing && JSON.stringify(existing) !== JSON.stringify(parsed)) {
    throw new Error(
      `Preset "${parsed.id}" is already registered with a different shape — pick a new id.`,
    );
  }
  registry.set(parsed.id, freezePreset(parsed));
}

export function getPreset(id: string): ThemePreset | undefined {
  return registry.get(id);
}

export function listPresets(): readonly ThemePreset[] {
  return Array.from(registry.values());
}
