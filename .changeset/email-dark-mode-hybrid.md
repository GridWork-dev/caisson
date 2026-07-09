---
"@caisson/email": minor
---

Dark-mode support for every transactional template via the hybrid technique: the light
palette retuned off pure-white/near-black extremes (survives Gmail-style forced inversion),
plus `color-scheme`/`supported-color-schemes` metas and a `prefers-color-scheme: dark`
palette (`BRAND_COLOR_DARK`, keyed off explicit layout classes with `!important`) for
clients that honor author dark styles. All color styling stays in the shared layout —
no template changes.
