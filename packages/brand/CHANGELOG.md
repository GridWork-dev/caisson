# @caisson/brand

## 0.1.1

### Patch Changes

- Added a README to each package describing what it provides, how to install or reference it, and a short usage example built from its real exports. No runtime behavior changed.

## 0.1.0

### Minor Changes

- defb22e: Split the Caisson brand layer out of the design-system kit. The wordmark, glyph, and the bespoke
  domain icons move into a new private `@caisson/brand` package, and `@caisson/ui` gains a small icon
  registration hook so an application supplies its own bespoke glyph set at startup. The kit now ships
  no brand-specific defaults: the app-shell brand slot and the credential-strip label are caller-
  provided with neutral fallbacks, keeping `@caisson/ui` brand-neutral and reusable. Every existing
  `<Icon>`, wordmark, and glyph continues to render unchanged in the Caisson apps.
