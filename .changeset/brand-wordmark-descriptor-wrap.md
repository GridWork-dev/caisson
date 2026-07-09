---
"@caisson/brand": patch
---

The wordmark lockup now wraps: the footer descriptor ("compliance-grade infrastructure")
can drop to its own line instead of overflowing a narrow grid column and rendering on top
of the adjacent footer nav column at 390px viewports (CAISSON-65). The plain glyph+wordmark
nav usage never triggers the wrap. Private package only; no publishable release.
