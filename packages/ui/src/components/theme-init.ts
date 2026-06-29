// Server-safe theming constants + the pre-paint init script (ADR-0100 F3). Kept OUT of the
// "use client" ThemeToggle so a server root layout can import `themeInitScript` without pulling a
// client component across the boundary.

/** localStorage key holding the user's PINNED choice ("dark" | "light"), absent until first click. */
export const THEME_STORAGE_KEY = "cs-theme";

/**
 * Pre-paint script — inline in the root layout `<head>` via
 * `<script dangerouslySetInnerHTML={{ __html: themeInitScript }} />`, BEFORE first paint.
 *
 * It applies ONLY a pinned choice (sets `data-theme` from localStorage). If the user has NOT pinned,
 * it leaves `data-theme` unset so the CSS 3-prong (tokens.css) follows the OS via
 * `@media (prefers-color-scheme)` — the F3 "follow OS until first click" behavior, with no FOUC for
 * pinned users. Also adds `cs-js` to <html> so the scroll-reveal hidden state can engage (no-JS
 * keeps content visible).
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==="dark"||t==="light"){document.documentElement.dataset.theme=t;}}catch(e){}document.documentElement.classList.add("cs-js");})();`;
