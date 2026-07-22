---
"@caisson/ui": patch
---

Code blocks and terminals now show a persistent thin scrollbar and an overflow-only edge shadow instead of a near-invisible fade, so clipped code no longer reads as a hard cut. The light-mode accent is nudged one step darker so eyebrow and status text clears the AA contrast floor, and the contrast check now measures each colour the way both browser gamut-mapping engines paint it and takes the stricter result. Two new code-syntax colour tokens (a string colour and a keyword colour, one value per theme) give highlighted code a Caisson-palette scale instead of a generic one. Inline code in prose renders as a styled chip.
