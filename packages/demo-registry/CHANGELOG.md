# @caisson/demo-registry

## 0.2.0

### Minor Changes

- 97b0341: A shared component-demo registry, a live operator catalog, and two migrated growth-email
  templates.

  `@caisson/demo-registry` is a new, private, unpublished package: one typed catalog of every
  base-kit, UI Pro, and per-package embeddable component, each entry carrying its owning
  package, license tier, prop variants, and a live demo renderer built from sample data. It
  is the one data source the buyer-facing component gallery and the operator catalog both
  read from, so what ships is what gets demoed — never a second, drifting copy.

  `@caisson/email` gains two more registered templates: `waitlist-welcome` and
  `nurture-follow-up`, migrated from a standalone plain-HTML implementation into the shared
  branded layout used by every other transactional email. Every email the product sends —
  transactional and growth — now renders through one template registry.

  The admin app's design-system section is now the catalog: every component and every email
  template render live with sample data, grouped and filterable by license tier and owning
  package, with a send-test-to-operator action on each email. The marketing site's two
  standalone growth-email builders (never wired to a live sender) are removed in favor of
  the two templates now living in `@caisson/email`; the dev-only email preview page is
  removed too, superseded by the operator catalog.

### Patch Changes

- 51e3ed0: The UI-base demo entry follows the `EditionCard` → `BundleCard` rename in `@caisson/ui`
  (display name + import; the stable `ui.edition-card` demo id is unchanged). Private
  package only; no publishable release.
- Updated dependencies [1bc677a]
- Updated dependencies [1bc677a]
- Updated dependencies [1bc677a]
- Updated dependencies [08fd857]
- Updated dependencies [0137008]
- Updated dependencies [1bc677a]
- Updated dependencies [329150a]
- Updated dependencies [679cce6]
- Updated dependencies [1bc677a]
- Updated dependencies [8670f38]
- Updated dependencies [5a8b317]
- Updated dependencies [8253e76]
- Updated dependencies [1bc677a]
- Updated dependencies [f903014]
- Updated dependencies [eff7248]
- Updated dependencies [b63d107]
- Updated dependencies [47e04fd]
- Updated dependencies [51e3ed0]
- Updated dependencies [b5a3690]
- Updated dependencies [b5a3690]
- Updated dependencies [51e3ed0]
- Updated dependencies [c905c61]
- Updated dependencies [2c93128]
- Updated dependencies [b7e58a8]
- Updated dependencies [b5a3690]
- Updated dependencies [b43959c]
- Updated dependencies [4d85f28]
- Updated dependencies [4c8daa9]
  - @caisson/ai-meter@1.0.0
  - @caisson/audit-harness@1.0.0
  - @caisson/audit-worm@1.0.0
  - @caisson/ui@0.6.0
  - @caisson/license-issue@1.0.0
  - @caisson/local-store@1.0.0
  - @caisson/ui-pro@0.2.0
  - @caisson/prompt-registry@1.0.0
