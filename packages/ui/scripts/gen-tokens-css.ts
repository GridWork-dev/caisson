/**
 * Emit `styles/tokens.css` (--cs-* CSS vars) from the locked TS token objects. Deterministic:
 * same tokens in → byte-identical CSS out (drift-guardable in CI). Run: `bun run gen:tokens`.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { semanticCssLines } from "../src/tokens/css-vars";
import { foundation } from "../src/tokens/foundation";
import {
  codeTokensDark,
  codeTokensLight,
  darkTheme,
  fonts,
  functionalDark,
  functionalLight,
  lightTheme,
  selected,
} from "../src/tokens/theme";
import type {
  CodeTokens,
  FunctionalTokens,
  SemanticTheme,
} from "../src/tokens/types";

// Semantic role -> CSS var suffix mapping lives in ../src/tokens/css-vars.ts (shared with the
// runtime theme API, ../src/theme/apply-theme.ts) so the two can never drift apart.
function semanticBlock(theme: SemanticTheme): string {
  return semanticCssLines(theme, 2).join("\n");
}

// Functional/status tokens are per-mode (the dark set fails AA on light surfaces) — emitted with
// the semantic block in each theme block, NOT in the mode-independent sharedBlock.
function functionalBlock(fn: FunctionalTokens): string {
  return [
    "  /* functional / status */",
    `  --cs-success: ${fn.success};`,
    `  --cs-warning: ${fn.warning};`,
    `  --cs-danger: ${fn.danger};`,
    `  --cs-info: ${fn.info};`,
  ].join("\n");
}

// Code-syntax tokens are per-mode too (ADR-0374 Decision 2) — the automatic-highlight scale for the
// docs/glossary Shiki path, kept out of the status vocabulary. Emitted with the semantic block in
// each theme block, same as functional/status.
function codeBlock(code: CodeTokens): string {
  return [
    "  /* code syntax (ADR-0374) */",
    `  --cs-code-string: ${code.codeString};`,
    `  --cs-code-keyword: ${code.codeKeyword};`,
  ].join("\n");
}

function sharedBlock(): string {
  const lines: string[] = [];
  lines.push("  /* type */");
  lines.push(`  --cs-font-sans: ${fonts.sans};`);
  lines.push(`  --cs-font-mono: ${fonts.mono};`);
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

// 3-prong dark mode (ADR-0100 F3). Dark is the un-attributed default (:root). The OS-seed block
// follows prefers-color-scheme:light UNLESS the user has explicitly chosen — the
// `:root:not([data-theme="dark"])` selector (specificity 0,2,0) beats the base `:root` (0,1,0),
// so OS-light wins by default but a manual `[data-theme]` choice still wins (it nulls the :not or
// matches the equal-specificity later rule). No JS needed for the OS follow; the ThemeToggle only
// writes [data-theme] once the user pins a choice.
const css = `/* GENERATED — packages/ui/scripts/gen-tokens-css.ts. Do not edit by hand.
 * Locked selection: palette "${selected.palette}", type "${selected.type}". Run: bun run gen:tokens */

:root,
[data-theme="dark"] {
  /* colour — semantic (dark, default) */
${semanticBlock(darkTheme)}
${functionalBlock(functionalDark)}
${codeBlock(codeTokensDark)}
${sharedBlock()}
}

/* OS-seed: follow the system's light preference until the user pins a theme. */
@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) {
    /* colour — semantic + functional (light, OS-seeded) */
${semanticBlock(lightTheme)}
${functionalBlock(functionalLight)}
${codeBlock(codeTokensLight)}
  }
}

/* manual override — wins over the OS seed */
[data-theme="light"] {
  /* colour — semantic + functional (light); shared type/scale inherited from :root */
${semanticBlock(lightTheme)}
${functionalBlock(functionalLight)}
${codeBlock(codeTokensLight)}
}
`;

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../styles/tokens.css");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, css, "utf8");
process.stdout.write(`wrote ${out}\n`);
