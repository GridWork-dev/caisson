---
"@caisson/ui": patch
---

`SkuMatrix` and `StatusChip` can no longer force a page wider than the viewport
(CAISSON-66). The matrix table moves to `table-layout: fixed` with a per-cell min-width
and `overflow-wrap`, so a long unbroken cell breaks inside its own column instead of
colliding with the neighbouring one, and real overflow scrolls inside the existing
`.cs-matrix__wrap` container (with the gradient cue) rather than the page; the first
column (row labels) is now sticky while the rest scrolls. The status chip drops
`white-space: nowrap` for wrap-with-max-width, so a long fact label wraps inside the
pill instead of stretching the layout.
