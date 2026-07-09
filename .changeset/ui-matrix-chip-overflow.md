---
"@caisson/ui": patch
---

`SkuMatrix` and `StatusChip` can no longer force a page wider than the viewport
(CAISSON-66). The matrix table moves to `table-layout: fixed` with `overflow-wrap`, so a
long cell breaks inside its own column instead of colliding with the neighbouring one; a
wide matrix (5+ columns, e.g. the Module × 6-bundle grid) gets a `:has()`-keyed min-width
floor and scrolls inside the existing `.cs-matrix__wrap` container (gradient cue), with
the first column now sticky, while a narrow compare table simply wraps in place. The
status chip drops `white-space: nowrap` for wrap-with-max-width, so a long fact label
wraps inside the pill instead of stretching the layout.
