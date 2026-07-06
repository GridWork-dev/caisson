# @caisson/ui

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
