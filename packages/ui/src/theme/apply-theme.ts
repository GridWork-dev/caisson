/**
 * Runtime theme application (ADR-0250 G2b). `themeToCssVars`/`themeToCssText` are pure — work
 * anywhere, including SSR. `applyTheme` is the browser-side call that upserts a `<style>`
 * override; it touches `document` only inside the function body (never at module scope), so
 * importing this module is always SSR-safe. `themeToCssText` mirrors the EXACT three-prong
 * cascade of the generated `styles/tokens.css` — dark default, an OS-seed
 * `@media (prefers-color-scheme: light) { :root:not([data-theme="dark"]) }` block, and the
 * manual `[data-theme="light"]` override — so every override selector matches the base's
 * specificity and the runtime theme wins purely by later source order (a later `<style>` tag).
 * Emitting only two prongs would be a silent no-op for unpinned light-OS visitors: the base
 * OS-seed rule at specificity (0,2,0) would outrank a two-prong override's `:root` at (0,1,0).
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
    // OS-seed prong — matches the base tokens.css (0,2,0) rule so the override wins by source
    // order for unpinned light-OS visitors, not just for those who've pinned [data-theme].
    `@media (prefers-color-scheme: light) {`,
    `  :root:not([data-theme="dark"]) {`,
    ...semanticCssLines(theme.light, 4),
    `  }`,
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
  const found = target.getElementById(styleId);
  // Only reuse the element if it's actually a <style> — a non-style element sharing the id (a
  // page's own <div id="...">) would otherwise have its content clobbered with raw CSS text.
  let el = found?.tagName === "STYLE" ? found : null;
  if (!el) {
    el = target.createElement("style");
    el.id = styleId;
    target.head.appendChild(el);
  }
  el.textContent = themeToCssText(theme);
}
