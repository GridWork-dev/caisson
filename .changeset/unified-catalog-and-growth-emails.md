---
"@caisson/demo-registry": minor
"@caisson/email": minor
"@caisson/admin": patch
"@caisson/site": patch
---

A shared component-demo registry, a live operator catalog, and two migrated growth-email
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
