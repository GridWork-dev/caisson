# @caisson-sh/brand

## 0.1.7

### Patch Changes

- 611f1de: Package comments, tests, READMEs and generated templates now describe the reader as an adopter integrating the package into their own app, not a buyer of a Caisson product. Compliance-artifact wording that faced an adopter's own customers now says so explicitly, and internal signing-key and licensing-domain comments no longer reference a retired commercial license issuer.
- 73bdf3c: The site, demos and internal tooling follow the move to Apache-2.0: the gate now requires every published package to be Apache-2.0 with its LICENSE file, the commerce and entitlement checks are gone, and the docs install everything from public npm.

## 0.1.6

### Patch Changes

- 87275f6: Replace ESLint and Prettier with oxlint and oxfmt.

  Linting and formatting now run on the oxc toolchain. The rule floor is unchanged: the same
  no-any, no-console, type-only-import and provider-SDK-boundary rules are enforced, at the same
  severities, and formatting keeps the settings the previous formatter used. Every package here is
  touched by the dependency removal or by the one-pass reformat, so each takes a patch bump; no
  runtime behaviour changes.

  For anyone consuming the shared configuration: the lint config package is renamed, and the lint
  and format commands changed.

## 0.1.5

### Patch Changes

- 2cd4184: Complete the marketplace depth treatment for access reviews, the AI risk register, and the trust
  page with source-grounded records, poke-first media, bespoke token-following glyphs, and a 26/26
  sellable-module parity guard.

## 0.1.4

### Patch Changes

- cd48b89: Bespoke catalog marks for the twelve newest module pages replace the temporary generic icons: agent-trajectory, tool-exec, org-controls, compliance-core, billing-orchestration, ui-pro, local-inference, local-privacy, local-sync, frameworks-pack, signing-primitive, and credits now each carry a purpose-drawn domain glyph in the same line-icon family as the rest of the catalog, so every module reads as part of one designed set across the nav, cards, and depth-page heroes.
- c36b9e2: Builds now compile with the native TypeScript 7 compiler. The emitted type declarations are unchanged in API; some inferred type members appear in a different order in .d.ts files. Aggregate compile time drops roughly sevenfold.
- 16de8df: Declares each package's type-check-only `build` task as producing no cacheable output (`outputs: []`), clearing the five stale "no output files found" warnings from a clean turbo build. No behavior change.

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
