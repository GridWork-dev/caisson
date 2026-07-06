---
"@caisson/brand": minor
"@caisson/ui": minor
---

Split the Caisson brand layer out of the design-system kit. The wordmark, glyph, and the bespoke
domain icons move into a new private `@caisson/brand` package, and `@caisson/ui` gains a small icon
registration hook so an application supplies its own bespoke glyph set at startup. The kit now ships
no brand-specific defaults: the app-shell brand slot and the credential-strip label are caller-
provided with neutral fallbacks, keeping `@caisson/ui` brand-neutral and reusable. Every existing
`<Icon>`, wordmark, and glyph continues to render unchanged in the Caisson apps.
