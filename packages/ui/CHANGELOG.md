# @caisson/ui

## 0.6.0

### Minor Changes

- 5a8b317: Add a `circle-user` account glyph to the icon set, and give the top-drawer Dialog variant an
  authored slide-down enter/exit with a fading backdrop. The motion is tokenized, exits a touch faster
  than it enters, and collapses to an instant swap under reduced-motion, with content never left
  hidden. Modal dialogs, side drawers, and the cart are untouched.
- f903014: Reveal gains an authored-motion variant API. Two new optional props extend the scroll
  reveal without changing any existing call site: `direction` (`"up" | "down" | "left" |
"right" | "none"`, default `"up"`) picks the axis the element travels in along, and
  `distance` (px, default 12) sets the pre-reveal offset. The offset is driven through the
  `--cs-reveal-x` / `--cs-reveal-y` custom properties the co-located `reveal.css`
  hidden-state rule reads, with fallbacks that reproduce the legacy fade-up-12 exactly — so
  existing `<Reveal>` and `<Reveal delay={...}>` usages are unchanged. Pair `delay` across
  siblings (`delay={i * 70}`) for a staggered grid cascade. `prefers-reduced-motion` still
  forces the pre-reveal state visible (never stuck at `opacity: 0`), and the primitive stays
  gated on `.cs-js` so no-JS / pre-hydration renders content fully visible, per the design system's motion rules.
- 51e3ed0: BREAKING: `EditionCard` / `EditionCardProps` are renamed to `BundleCard` /
  `BundleCardProps` (`components/bundle-card`), completing the six-bundle vocabulary flip
  now that editions are sold as bundles. Pure rename: props, markup, and the
  shipped `.cs-edition*` CSS class contract are unchanged. Update imports from
  `EditionCard` to `BundleCard`.
- b5a3690: `Dialog`'s drawer variant grows a `side="top"` edge — a full-width sheet capped to content
  height instead of a full-height side column, the shape a nav drawer under a fixed header
  bar wants — and an optional `className` prop for a consumer-specific chrome override (e.g.
  pinning the drawer below an app's own fixed header).
- b5a3690: Add six interactive primitives: Tabs, Checkbox, Radio, Switch, Badge, and Accordion. All
  hand-rolled with zero Radix and zero new dependencies, following the kit's existing recipe —
  co-located CSS reading only `--cs-*` tokens, BEM naming, `>=24px` touch targets, and
  hand-written keyboard interaction per the relevant WAI-ARIA authoring pattern
  (tablist/tab/tabpanel for Tabs, native `<details name>` exclusive-group for single-open
  Accordions, `role="switch"` for Switch). Checkbox, Radio, Switch, and Badge `forwardRef`
  onto their single root; Tabs and Accordion don't take a ref. Every new primitive ships with
  an automated axe-core accessibility regression test.
- b7e58a8: Add the premium component tier, layered on the open design-system floor: an advanced data grid (multi-column filter builder, row grouping with aggregation, column show/hide and pin, CSV export, and fixed-height row virtualization), a virtualized keyboard-navigable tree, an operations/coverage matrix, a hash-chain audit timeline with per-link verification badges, a redaction-aware payload viewer, a retype-to-confirm destructive-action dialog, and an advanced date-range picker with fiscal-quarter and billing-cycle presets and a comparison range. Every component ships full keyboard navigation, ARIA roles and labels, and focus management, and themes entirely through the design-system token contract.

  The open floor kit also gains the table-stakes pieces it was missing: single-column sort, a substring filter, and pagination on the DataTable, plus Dialog (native modal and edge drawer), ConfirmDialog, Toast with a live region, a styled Select, CopyField, standalone Pagination, and DetailList.

- b43959c: Adds a runtime theme API: `createTheme`/`applyTheme` plus a preset registry
  (`registerPreset`/`getPreset`/`listPresets`), available from `@caisson/ui/theme`. Three
  built-in presets ship out of the box — `caisson` (the default), `pressure`, and
  `bulkhead` — and buyers can layer their own token overrides on top of any of them or
  register a fully custom preset. `applyTheme` swaps the live theme in the browser by
  upserting a `<style>` tag; `createTheme`/`themeToCssVars`/`themeToCssText` are pure and
  safe to call during server-side rendering.

### Patch Changes

- 08fd857: Fixes all 7 findings from the July 2026 production browser audit of the public site:

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

- 0137008: AppShell (dashboard shell) mobile fixes (CAISSON-69): the topbar account pill truncates with an
  ellipsis instead of clipping past `.cs-shell`'s grid-level overflow, and a new optional
  `mobileNavFooter` prop lets a consumer render extra content (e.g. Sign-out) inside the mobile
  off-canvas drawer, reachable even when the topbar has no room for it.
- 8253e76: OSS launch readiness wave. LICENSE copyright restamped to Caisson Software LLC across the
  open set. README/AGENTS prose trued to the built reality: six-bundle vocabulary, current
  entitlement examples, decision-record citations stripped from public-facing docs. The
  eu-ai-act-sample template's kernel pin corrected to the current release line, with a
  dynamic staleness test so future version cuts fail loud. Docs service search now races the
  per-query embed against an eight-second deadline and degrades to the keyword floor instead
  of holding the query open past caller budgets; a refund-policy docs page makes refund
  questions answerable. Site sign-in sets a non-HttpOnly session-hint cookie so owned-items
  UI renders without an extra round trip, and the build ignores a spurious Next trace
  warning. Public-mirror exporter hardened: prose renames scoped to the open package set,
  four mirror-only test exclusions, a root bunfig for the mirror workspace, and a historical
  backfill mode for the rot-guard.
- eff7248: Reveal now shares a single `IntersectionObserver` across every instance on the page
  instead of constructing one per element. A page with a dozen or more `<Reveal>`s
  (a typical landing page) used to spin up a dozen or more observers doing the same
  scroll-tracking work; now there's exactly one, keyed to each element through a
  `WeakMap` so every instance still reveals independently off its own intersection.
  Visual behavior, timing, and the `prefers-reduced-motion` fallback are unchanged —
  this is purely an internal cost reduction on page hydration.
- 47e04fd: Typography: every sans-serif zero now renders as a plain oval — a single-glyph companion
  face (Mona Sans, subset to the one character) sits in front of the body font, whose only
  zero is barred and read ambiguously in prose. Docs: the eleven pages that hedged "this
  reference is still expanding" now carry complete API references documenting each package's
  real exported surface, with two stale auth claims corrected along the way. Marketplace:
  diagram slides drop the duplicated chrome-bar sentence in favor of a short artifact label;
  the carousel caption remains the single visible narration. Compare pages: the two value
  columns no longer squeeze the Detail column to a sliver on phones.
- 51e3ed0: `SkuMatrix` and `StatusChip` can no longer force a page wider than the viewport
  (CAISSON-66). The matrix table moves to `table-layout: fixed` with `overflow-wrap`, so a
  long cell breaks inside its own column instead of colliding with the neighbouring one; a
  wide matrix (5+ columns, e.g. the Module × 6-bundle grid) gets a `:has()`-keyed min-width
  floor and scrolls inside the existing `.cs-matrix__wrap` container (gradient cue), with
  the first column now sticky, while a narrow compare table simply wraps in place. The
  status chip drops `white-space: nowrap` for wrap-with-max-width, so a long fact label
  wraps inside the pill instead of stretching the layout.
- c905c61: Mobile grid collapse uses `minmax(0, 1fr)` instead of bare `1fr`, and `.cs-card` gains
  `overflow-wrap: break-word`. A bare `1fr` track floors at min-content, so one long
  unbreakable token in a card body (e.g. a slash-joined identifier list) widened the whole
  page past a 390px viewport by 144px; the track now shrinks and the token wraps inside
  the card.
- 2c93128: Closes out the a11y and perf polish deferred from the interactive-primitives review:

  - `Dialog` now locks background scroll while open (a native `<dialog>`'s `showModal()`
    traps focus and makes the page inert, but never stopped it from scrolling underneath),
    restoring the prior value on close — including for nested dialogs, which share one
    counted lock so an inner dialog closing doesn't unlock scroll while an outer one is
    still open. Every drawer/modal consumer picks this up automatically.
  - `Tabs` no longer points `aria-controls` at a tabpanel id that doesn't exist in the DOM.
    Only the active tab's panel is ever mounted, so inactive tabs now omit `aria-controls`
    instead of referencing a dangling id.
  - `Tooltip`'s merged trigger ref is now memoized instead of being rebuilt on every render.

## 0.5.0

### Minor Changes

- Fixed the package exports so consumers outside the Bun runtime now get real type declarations
  and compiled JavaScript instead of raw TypeScript source with no build step. The root entry and
  the tokens entry each resolve to a compiled file under dist for plain Node or bundler consumers,
  while Bun keeps resolving straight to the TypeScript source for zero-build development. The
  components barrel and the per-component subpath exports still point at the raw source files
  directly, since components ship framework-agnostic with co-located stylesheets for a consuming
  app to transpile itself, and the two stylesheet exports are unchanged. The package now runs a
  real TypeScript build that emits declaration files into a dist directory, which is already
  excluded from version control repo-wide.

## 0.4.0

### Minor Changes

- defb22e: Split the Caisson brand layer out of the design-system kit. The wordmark, glyph, and the bespoke
  domain icons move into a new private `@caisson/brand` package, and `@caisson/ui` gains a small icon
  registration hook so an application supplies its own bespoke glyph set at startup. The kit now ships
  no brand-specific defaults: the app-shell brand slot and the credential-strip label are caller-
  provided with neutral fallbacks, keeping `@caisson/ui` brand-neutral and reusable. Every existing
  `<Icon>`, wordmark, and glyph continues to render unchanged in the Caisson apps.
- 783110d: Added a persistent price and purchase bar pinned to the bottom of the screen on mobile for module
  pages. Previously, on a phone the price and "Add to cart" button could end up far down the page,
  past the full feature list and FAQ, before a visitor found them. Now the price and purchase button
  stay visible at every scroll position on small screens, while the full purchase card — with edition
  bundling and related reading — still appears in its usual place further down the page. Desktop
  layouts are unchanged.

### Patch Changes

- b791198: Documentation and metadata cleanup plus dependency-declaration hygiene: package descriptions, READMEs, changelogs, and source comments no longer carry internal build references, and shared external dependency ranges now resolve through the workspace dependency catalog (published dependency ranges unchanged; the TypeScript devDependency floor moves to ^5.7.3).
- 783110d: Gave the buyer dashboard's post-purchase pages (license, credits, AI keys, compliance,
  members, activity, plan, overview) a visual polish pass. Forms now share one consistent
  label-and-field look across the dashboard, empty and owner-only states read calmly instead
  of as a stray line of text, the compliance page's three frameworks are now visually
  separated instead of running together, the members "add a seat" field explains that
  invite-by-email isn't available yet, and the activity page now says when it's showing
  credit-ledger history instead of per-call usage detail. No data, permissions, or purchase
  flows changed — this is a presentation-only update.
- ad66801: Clarify two historical code comments; no behavior change.
- 8ab8ccc: Follow-up visual pass after a partial re-audit: the module comparison table now shows the same
  right-edge scroll fade as code samples when a column runs off narrow screens, and its 4th edition
  column is reachable on mobile. Terminal cards no longer clip their status badge when the label is
  long. Placeholder text is readable in light mode on every form across the site (sign-in,
  password-reset, newsletter), not just the ones fixed last time. The docs code samples now match the
  same scroll-fade treatment as the rest of the site. Several hero code/terminal panels (home,
  compliance, agentic-dev, local-first, the EU AI Act page) had their sample text re-wrapped so it no
  longer clips at the card edge. The EULA now keeps a readable line length on desktop, the footer no
  longer overflows the viewport on mobile, and a few small copy/layout bugs (a missing hyphen, an
  orphaned card in a 4-item grid, a monospace numeral style bleeding onto the word "from") are fixed.
- 783110d: Scrollable code samples and terminal output now show a soft fade at the right edge on narrow
  screens, so it's clear there's more to see instead of the content looking cut off. The
  marketplace tab row gets the same treatment when it doesn't fit the screen width. The email
  placeholder text in the product-updates signup now reads clearly in light mode.
- 0af4dbf: Rewrote README, AGENTS, CHANGELOG, package.json descriptions, and inline source comments to
  read as clean, buyer-facing documentation. Removed sibling-repository provenance framing,
  internal build-phase shorthand, and bare specification-id citations that had leaked into
  shipped copy. No runtime behavior changed in any package — documentation and comments only.
- 783110d: Fixed five small display bugs found in a visual audit of the marketing site:

  - The Agent runner module card showed a broken glyph instead of its icon on the modules page.
  - The Alerting module's pricing description had an awkward, hard-to-read sentence.
  - On mobile, three-digit module prices in the stack builder's example (like $199) were cut off to
    two digits (like $19) — a real trust problem on a pricing surface.
  - The glossary's "AI & agent infrastructure" heading rendered with the word gap almost invisible
    on wide screens.
  - The docs sidebar's "Base substrate" section repeated its own name as its only link's label
    instead of a distinct label.

## 0.3.0

### Minor Changes

- bd9a005: 15 new bespoke icon marks: the nine remaining standalone-module glyphs
  (retention-runner, alerting, ai-meter, ai-evals, guardrails, prompt-registry, local-store,
  agent-kernel, agent-runner), the four edition marks on the shared caisson waterline/chamber form
  (edition-compliance, edition-ai-kit, edition-local-ai, edition-agent-dev), the Everything-bundle
  mark, and a plan-tier mark. Same contract as the existing bespoke set: 24-grid, 2px stroke,
  currentColor, no fill — additive to `IconName`, no breaking change.

## 0.2.1

### Patch Changes

- 904b15b: Internal documentation and link housekeeping (repo links, internal tooling references, observability naming). No behavior change to any runtime path.
- 6e08cc6: Declare turbo build outputs (noEmit typecheck, outputs []) — build-tooling metadata only, no runtime change.

## 0.2.0

### Minor Changes

- 9483a36: Initial public release (0.1.0) — publish-readiness flip (ADR-0111). The open Base substrate (Apache-2.0, tier `oss`) publishes to public npm; the commercial editions/primitives/generator (tier `paid`) publish to GitHub Packages restricted. Versions were aligned to 0.1.0 in lockstep with the registry ledger; this changeset records the 0.1.0 release and seeds the changeset-presence gate (ADR-0021).
