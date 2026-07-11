---
"@caisson/site": patch
"@caisson/ui": patch
---

Fixes all 7 findings from the ADR-0322/0323 production browser audit:

- The homepage "Real paths. Real code." code viewer was invisible at every breakpoint: CSS Modules
  was silently scoping the `#repo-artifact-tab-*` id selectors that drive the pure-CSS `:has()`
  reveal, so they never matched the real DOM ids and every card stayed `display: none`. The ids are
  now wrapped in `:global()`.
- `/docs` had no `<main>` landmark, so the "Skip to content" link had no target to scroll or focus
  to; fumadocs' `DocsLayout` now wraps its children in one `<main id="main-content" tabIndex={-1}>`.
- The marketplace compare checkbox's safe click target was 13x13px, well under the WCAG 2.2 2.5.8
  minimum, and sat under the card's full-surface preview button. It now has an invisible 44x44
  hit area lifted above the stretched action.
- The docs search dialog dropped focus to `<body>` on every dismissal path (Escape, close button,
  backdrop) because none of its triggers render Radix's own `<Dialog.Trigger>`, so Radix's built-in
  focus-restore never had a trigger to return to. It now tracks whichever element opened the dialog
  and restores focus there via `onCloseAutoFocus`.
- The docs GitHub nav icon was an `<svg role="img">` with no accessible name. It now renders via a
  site-owned `links` icon item (`aria-hidden` on the glyph) instead of fumadocs' `githubUrl`
  shortcut, which hardcodes the unlabeled SVG; the link itself keeps its `aria-label="GitHub"`.
- A sitewide 44px touch-target pass: the cart trigger, mobile-nav toggle, media-carousel arrows, the
  shared `Button` recipe, and fumadocs' own search/sidebar/GitHub icon-button trio now all carry an
  invisible centered hit-area expansion — visual sizes are unchanged.
- The homepage depth-fog hero field now probes `canvas.getContext("webgl2")` before ever
  constructing `THREE.WebGLRenderer`, and silences three.js's own console hook for the renderer
  construction attempt, so an environment that can't allocate WebGL falls back to the poster without
  logging repeated renderer errors.
