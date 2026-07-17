# @caisson/brand

## 0.1.3

### Patch Changes

- 59e1365: TypeScript bridge to 6.0.3 (Kickoff T task 5, re-derived version map): the workspace catalog moves
  from ^5.7.3 to ^6.0.3 (the stable JS-compiler transition release; 7.x is the native compiler whose
  stable API waits for 7.1). standards-gate pins its own typescript to ^6.0.3 explicitly so a future
  catalog move to 7.x cannot strand its ts.createScanner usage. brand, ui-pro, and demo-registry gain
  a css.d.ts ambient declaration for the side-effect CSS imports TS 6.0 now checks (TS2882).

## 0.1.2

### Patch Changes

- 51e3ed0: The wordmark lockup now wraps: the footer descriptor ("compliance-grade infrastructure")
  can drop to its own line instead of overflowing a narrow grid column and rendering on top
  of the adjacent footer nav column at 390px viewports. The plain glyph+wordmark
  nav usage never triggers the wrap. Private package only; no publishable release.

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
