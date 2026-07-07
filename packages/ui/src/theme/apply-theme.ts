/**
 * Runtime theme application (ADR-0250 G2b). `themeToCssVars`/`themeToCssText` are pure — work
 * anywhere, including SSR. `applyTheme` is the browser-side call that upserts a `<style>`
 * override; it touches `document` only inside the function body (never at module scope), so
 * importing this module is always SSR-safe. Mirrors the cascade shape of the generated
 * `styles/tokens.css` (`:root, [data-theme="dark"]` + `[data-theme="light"]`) so a runtime theme
 * wins by DOM order (later `<style>` tag), not a specificity trick.
 */
import {
  semanticCssLines,
  semanticThemeToCssVars,
} from "../tokens/css-vars.ts";
import type { Theme } from "./types.ts";

const DEFAULT_STYLE_ID = "cs-theme-override";

/** Pure: per-mode `--cs-*` var maps for a resolved theme. SSR-safe. */
export function themeToCssVars(theme: Theme): {
  dark: Record<string, string>;
  light: Record<string, string>;
} {
  return {
    dark: semanticThemeToCssVars(theme.dark),
    light: semanticThemeToCssVars(theme.light),
  };
}

/** Pure: a `<style>`-ready CSS text block for a resolved theme. Usable server-side (no `document`
 *  needed) to render the override inline for a flash-free first paint, ahead of any client-side
 *  `applyTheme()` call. */
export function themeToCssText(theme: Theme): string {
  return [
    `:root, [data-theme="dark"] {`,
    ...semanticCssLines(theme.dark, 2),
    `}`,
    ``,
    `[data-theme="light"] {`,
    ...semanticCssLines(theme.light, 2),
    `}`,
  ].join("\n");
}

export interface ApplyThemeOptions {
  /** Injection root. Defaults to the global `document`. Passing one explicitly is also what
   *  makes this function testable without a browser DOM. */
  target?: Document;
  /** id of the upserted `<style>` tag — re-calls with the same id replace, not duplicate. */
  styleId?: string;
}

/**
 * Apply a theme by upserting a `<style>` tag with its CSS text. Called during SSR with no
 * explicit `target` (no `document`) is a no-op — render `themeToCssText()` into a `<style>` tag
 * server-side instead.
 */
export function applyTheme(
  theme: Theme,
  options: ApplyThemeOptions = {},
): void {
  const target =
    options.target ?? (typeof document === "undefined" ? undefined : document);
  // ponytail: SSR no-op is the ceiling here — a caller that needs a flash-free first paint
  // renders themeToCssText() server-side instead; upgrade to a real SSR style-collector if a
  // framework integration needs one.
  if (!target) return;

  const styleId = options.styleId ?? DEFAULT_STYLE_ID;
  let el = target.getElementById(styleId);
  if (!el) {
    el = target.createElement("style");
    el.id = styleId;
    target.head.appendChild(el);
  }
  el.textContent = themeToCssText(theme);
}
