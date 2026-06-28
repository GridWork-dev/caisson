/**
 * Emit `styles/tokens.css` (--cs-* CSS vars) from the locked TS token objects. Deterministic:
 * same tokens in → byte-identical CSS out (drift-guardable in CI). Run: `bun run gen:tokens`.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { foundation } from "../src/tokens/foundation";
import {
  darkTheme,
  fonts,
  functional,
  lightTheme,
  selected,
} from "../src/tokens/theme";
import type { SemanticTheme } from "../src/tokens/types";

/** Semantic role → CSS var suffix. Explicit (not derived) for stable ordering + clean names. */
const SEMANTIC_VARS: ReadonlyArray<readonly [keyof SemanticTheme, string]> = [
  ["bg", "bg"],
  ["surface1", "surface-1"],
  ["surface2", "surface-2"],
  ["border", "border"],
  ["borderStrong", "border-strong"],
  ["fg", "fg"],
  ["fgMuted", "fg-muted"],
  ["accent", "accent"],
  ["accentHover", "accent-hover"],
  ["onAccent", "on-accent"],
  ["accentTint", "accent-tint"],
  ["focus", "focus"],
  ["link", "link"],
  ["glowAccent", "glow-accent"],
];

function semanticBlock(theme: SemanticTheme): string {
  return SEMANTIC_VARS.map(
    ([key, name]) => `  --cs-${name}: ${theme[key]};`,
  ).join("\n");
}

function sharedBlock(): string {
  const lines: string[] = [];
  lines.push("  /* functional / status */");
  lines.push(`  --cs-success: ${functional.success};`);
  lines.push(`  --cs-warning: ${functional.warning};`);
  lines.push(`  --cs-danger: ${functional.danger};`);
  lines.push(`  --cs-info: ${functional.info};`);
  lines.push("  /* type */");
  lines.push(`  --cs-font-sans: ${fonts.sans};`);
  lines.push(`  --cs-font-mono: ${fonts.mono};`);
  lines.push(`  --cs-font-mono-code: ${fonts.monoCode};`);
  for (const [k, v] of Object.entries(foundation.fontSize))
    lines.push(`  --cs-text-${k}: ${v};`);
  for (const [k, v] of Object.entries(foundation.fontWeight))
    lines.push(`  --cs-weight-${k}: ${v};`);
  for (const [k, v] of Object.entries(foundation.lineHeight))
    lines.push(`  --cs-leading-${k}: ${v};`);
  for (const [k, v] of Object.entries(foundation.letterSpacing))
    lines.push(`  --cs-tracking-${k}: ${v};`);
  for (const [k, v] of Object.entries(foundation.space))
    lines.push(`  --cs-space-${k}: ${v};`);
  for (const [k, v] of Object.entries(foundation.radius))
    lines.push(`  --cs-radius-${k}: ${v};`);
  lines.push("  /* motion (ADR-0078 §6) */");
  for (const [k, v] of Object.entries(foundation.motion.duration))
    lines.push(`  --cs-duration-${k}: ${v};`);
  for (const [k, v] of Object.entries(foundation.motion.ease))
    lines.push(`  --cs-ease-${k}: ${v};`);
  lines.push("  /* elevation (ADR-0078 §7) */");
  for (const [k, v] of Object.entries(foundation.elevation))
    lines.push(`  --cs-shadow-${k}: ${v};`);
  return lines.join("\n");
}

const css = `/* GENERATED — packages/ui/scripts/gen-tokens-css.ts. Do not edit by hand.
 * Locked selection: palette "${selected.palette}", type "${selected.type}". Run: bun run gen:tokens */

:root,
[data-theme="dark"] {
  /* colour — semantic (dark) */
${semanticBlock(darkTheme)}
${sharedBlock()}
}

[data-theme="light"] {
  /* colour — semantic (light); shared type/scale/functional inherited from :root */
${semanticBlock(lightTheme)}
}
`;

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../styles/tokens.css");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, css, "utf8");
process.stdout.write(`wrote ${out}\n`);
