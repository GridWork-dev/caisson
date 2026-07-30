# @caisson/admin

## 0.1.1

### Patch Changes

- f2cb853: `@caisson/kernel`'s main entry point is now browser-safe. Everything that needs a Node built-in — constant-time secret comparison, audit-chain hashing, migration assembly, and the SSRF guard — moved to a new `@caisson/kernel/node` entry point. The main entry keeps the error model, the strict-schema helpers, canonical serialization and the audit-chain types, the money and version types, the timeout-bounded fetch, and the event sink.

  Server-side code that used one of the moved functions changes a single import path: `@caisson/kernel/node` re-exports the main entry in full, so nothing else in that import list has to move. Nothing changed about what any of these functions do.

  This is what lets packages built on the kernel — the trust-page generator and the artifact renderer among them — be imported directly into a browser bundle. Previously any import of the kernel dragged Node's crypto and DNS modules along with it, and a front end had to keep its own hand-written copy of that logic in step by hand. `@caisson/frameworks-pack` gains a matching `@caisson/frameworks-pack/registry` entry point exposing the control model on its own, for the same reason; its main entry is unchanged.

- 0739131: The internal proof bearer now carries a signed timestamp and is rejected outside a five-minute
  acceptance window, so the credential expires instead of staying valid until the secret rotates.
  The verifier still accepts the legacy untimestamped form during the verifier-first rollout, and
  the internal-proof rate limiter no longer consumes an account token on a globally-denied request.
- Updated dependencies [e917c52]
- Updated dependencies [e917c52]
- Updated dependencies [f2cb853]
- Updated dependencies [a5f9ea8]
- Updated dependencies [894fc27]
- Updated dependencies [b5cd9d6]
  - @caisson/registry-schema@0.5.9
  - @caisson/kernel@0.7.0
  - @caisson/audit-worm@2.2.1
  - @caisson/compliance-core@0.6.3
  - @caisson/platform-migrations@0.3.1
  - @caisson/platform-reads@0.2.10
  - @caisson/service-license@0.1.1
  - @caisson/ui@0.6.4
  - @caisson/credits@0.5.11
  - @caisson/auth@0.4.2
  - @caisson/email@0.5.5
  - @caisson/observability@0.3.6
  - @caisson/org-controls@0.3.6
  - @caisson/rate-limit@0.1.9
  - @caisson/tenancy-rls@0.5.7
  - @caisson/demo-registry@0.2.12
  - @caisson/brand@0.1.5

## 0.1.0

### Minor Changes

- 31bf5f1: Add the account-bound internal proof seam and wire the admin audit viewer, lazy row proofs, and signed complete-snapshot evidence-pack export.

### Patch Changes

- 96aa01d: Let the architecture fleet overlay use a Railway project-scoped token instead of the
  account-scoped one, falling back to the account token when the narrower pair isn't set.
- af54102: Visual-remediation closeout: eyebrow variation pass across the bundle, security, procurement, marketplace, and legal page families; legal conspicuous clauses restyled from all-caps to bold sentence case on a set-off band (wording unchanged); clause-break dashes swept out of buyer-facing prose in comparisons, docs content, and legal pages; marketplace stack total docked as a mobile bottom bar with a live-region total; persistent header CTA demoted to secondary; docs search palette completes its tab semantics with a touch close control and suggested pages; admin top nav collapses behind a mobile disclosure panel.
- 56e46f1: Visual-remediation residual batch: legal pages gain a fixed "On this page" jump-nav rail
  occupying the flagged right-column dead space (62ch measure untouched); the footer
  newsletter Turnstile widget survives sibling mounts (script-dedup race fixed, widget
  cleanup on unmount); the visual harness drops third-party challenge-platform console
  noise by source origin; light-mode surface-1 steps to oklch L 0.965 so cards read as
  surfaces against the page background (contrast matrix re-verified); the admin
  foundations accent-fork panels render as an explicit three-up grid instead of orphaning
  Panel C in an empty quadrant.
- Updated dependencies [6d1c805]
- Updated dependencies [31bf5f1]
- Updated dependencies [25fd03c]
- Updated dependencies [a00a9ef]
- Updated dependencies [6d1c805]
- Updated dependencies [6d1c805]
- Updated dependencies [96aa01d]
- Updated dependencies [96aa01d]
- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
- Updated dependencies [96aa01d]
- Updated dependencies [2cd4184]
- Updated dependencies [a21c478]
- Updated dependencies [108a358]
- Updated dependencies [fe2dfac]
- Updated dependencies [6d1c805]
- Updated dependencies [56e46f1]
  - @caisson/ui@0.6.3
  - @caisson/audit-worm@2.2.0
  - @caisson/registry-schema@0.5.8
  - @caisson/observability@0.3.5
  - @caisson/email@0.5.4
  - @caisson/service-license@0.1.0
  - @caisson/platform-migrations@0.3.0
  - @caisson/kernel@0.6.0
  - @caisson/rate-limit@0.1.8
  - @caisson/brand@0.1.5
  - @caisson/compliance-core@0.6.2
  - @caisson/demo-registry@0.2.11
  - @caisson/credits@0.5.10
  - @caisson/platform-reads@0.2.9
  - @caisson/auth@0.4.1
  - @caisson/org-controls@0.3.5
  - @caisson/tenancy-rls@0.5.6

## 0.0.17

### Patch Changes

- Updated dependencies [d0e6b5c]
- Updated dependencies [31d59fd]
  - @caisson/platform-reads@0.2.8
  - @caisson/registry-schema@0.5.7
  - @caisson/credits@0.5.9
  - @caisson/service-license@0.0.18
  - @caisson/platform-migrations@0.2.11
  - @caisson/demo-registry@0.2.10

## 0.0.16

### Patch Changes

- Updated dependencies [bd071c9]
- Updated dependencies [cd48b89]
- Updated dependencies [bd071c9]
- Updated dependencies [c36b9e2]
- Updated dependencies [b8b14b4]
- Updated dependencies [16de8df]
  - @caisson/audit-worm@2.1.4
  - @caisson/ui@0.6.2
  - @caisson/brand@0.1.4
  - @caisson/auth@0.4.0
  - @caisson/credits@0.5.8
  - @caisson/demo-registry@0.2.9
  - @caisson/email@0.5.3
  - @caisson/kernel@0.5.3
  - @caisson/observability@0.3.4
  - @caisson/org-controls@0.3.4
  - @caisson/platform-migrations@0.2.10
  - @caisson/platform-reads@0.2.7
  - @caisson/rate-limit@0.1.7
  - @caisson/registry-schema@0.5.6
  - @caisson/tenancy-rls@0.5.5
  - @caisson/service-license@0.0.17

## 0.0.15

### Patch Changes

- Updated dependencies [098fe54]
  - @caisson/platform-reads@0.2.6
  - @caisson/service-license@0.0.16
  - @caisson/platform-migrations@0.2.9

## 0.0.14

### Patch Changes

- Updated dependencies [2229209]
- Updated dependencies [8ff4c62]
  - @caisson/registry-schema@0.5.5
  - @caisson/platform-reads@0.2.5
  - @caisson/credits@0.5.7
  - @caisson/service-license@0.0.15
  - @caisson/platform-migrations@0.2.8
  - @caisson/demo-registry@0.2.8

## 0.0.13

### Patch Changes

- Updated dependencies [fc0bb99]
- Updated dependencies [fc0bb99]
  - @caisson/kernel@0.5.2
  - @caisson/platform-reads@0.2.4
  - @caisson/service-license@0.0.14
  - @caisson/audit-worm@2.1.3
  - @caisson/auth@0.3.5
  - @caisson/credits@0.5.6
  - @caisson/email@0.5.2
  - @caisson/observability@0.3.3
  - @caisson/org-controls@0.3.3
  - @caisson/platform-migrations@0.2.7
  - @caisson/rate-limit@0.1.6
  - @caisson/tenancy-rls@0.5.4
  - @caisson/demo-registry@0.2.7

## 0.0.12

### Patch Changes

- Updated dependencies [5d03808]
- Updated dependencies [7de6fa4]
- Updated dependencies [63e9fae]
  - @caisson/registry-schema@0.5.4
  - @caisson/kernel@0.5.1
  - @caisson/platform-reads@0.2.3
  - @caisson/credits@0.5.5
  - @caisson/service-license@0.0.13
  - @caisson/audit-worm@2.1.2
  - @caisson/auth@0.3.4
  - @caisson/email@0.5.1
  - @caisson/observability@0.3.2
  - @caisson/org-controls@0.3.2
  - @caisson/platform-migrations@0.2.6
  - @caisson/rate-limit@0.1.5
  - @caisson/tenancy-rls@0.5.3
  - @caisson/demo-registry@0.2.6

## 0.0.11

### Patch Changes

- Updated dependencies [f40653b]
- Updated dependencies [4c6d3f7]
  - @caisson/registry-schema@0.5.3
  - @caisson/platform-reads@0.2.2
  - @caisson/credits@0.5.4
  - @caisson/service-license@0.0.12
  - @caisson/demo-registry@0.2.5
  - @caisson/platform-migrations@0.2.5
  - @caisson/audit-worm@2.1.1

## 0.0.10

### Patch Changes

- Updated dependencies [12182a5]
- Updated dependencies [1de88d7]
  - @caisson/platform-migrations@0.2.4
  - @caisson/audit-worm@2.1.0
  - @caisson/demo-registry@0.2.4
  - @caisson/service-license@0.0.11
  - @caisson/platform-reads@0.2.1

## 0.0.9

### Patch Changes

- Updated dependencies [5a09b01]
  - @caisson/registry-schema@0.5.2
  - @caisson/credits@0.5.3
  - @caisson/service-license@0.0.10
  - @caisson/platform-migrations@0.2.3
  - @caisson/platform-reads@0.2.1
  - @caisson/demo-registry@0.2.3

## 0.0.8

### Patch Changes

- Updated dependencies [3f05e1e]
  - @caisson/registry-schema@0.5.1
  - @caisson/credits@0.5.2
  - @caisson/service-license@0.0.9
  - @caisson/platform-migrations@0.2.2
  - @caisson/platform-reads@0.2.1
  - @caisson/demo-registry@0.2.2

## 0.0.7

### Patch Changes

- 59e1365: Drop the unused drizzle-orm dependency from apps/admin (Kickoff T task 8 non-gated leg). No admin
  source imports it; knip could not flag it because better-auth declares drizzle-orm as an optional
  peerDependency, which knip counts as a legitimate reference.
- 7e823a9: Renovate dependency pins (exact versions) across the app and service workspaces; no code change.
- Updated dependencies [ca44db5]
- Updated dependencies [baaa4fc]
- Updated dependencies [a8696cf]
- Updated dependencies [1867fa3]
- Updated dependencies [e5e4311]
- Updated dependencies [e5e4311]
- Updated dependencies [59e1365]
- Updated dependencies [59e1365]
- Updated dependencies [a0fd9b1]
- Updated dependencies [d1b4afa]
- Updated dependencies [7e823a9]
- Updated dependencies [809592d]
- Updated dependencies [809592d]
- Updated dependencies [e183860]
  - @caisson/audit-worm@2.0.0
  - @caisson/org-controls@0.3.1
  - @caisson/auth@0.3.3
  - @caisson/kernel@0.5.0
  - @caisson/email@0.5.0
  - @caisson/service-license@0.0.8
  - @caisson/brand@0.1.3
  - @caisson/demo-registry@0.2.1
  - @caisson/observability@0.3.1
  - @caisson/ui@0.6.1
  - @caisson/platform-migrations@0.2.1
  - @caisson/credits@0.5.1
  - @caisson/rate-limit@0.1.4
  - @caisson/tenancy-rls@0.5.2
  - @caisson/platform-reads@0.2.1
  - @caisson/registry-schema@0.5.0

## 0.0.6

### Patch Changes

- 5afd1da: Admin sign-in is repositioned onto in-app GitHub OAuth, replacing the edge-only Access
  gate as the control-plane's primary auth. Sign-in is restricted to a GitHub
  numeric-user-id allowlist — never a username, which is renameable/re-registerable —
  enforced both when a GitHub account first links and on every later request, so
  narrowing the allowlist takes effect immediately even against an already-signed-in
  session. Private package only; no publishable release.
- a931095: The grant-entitlement admin field now suggests known entitlement ids as you type, drawn
  from the same catalog the grant action itself validates against, so a typo is caught
  before submitting instead of after. Private package only; no publishable release.
- 60e65ef: `/healthz` now reports the baked `registry/index.json` digest (sha256 first-12-hex) and
  entry count alongside the readiness flag, mirroring the license service's own field. This
  is the admin leg of the registry index-parity probe (`registry/scripts/index-parity-probe.ts`):
  it can now confirm the admin image serves the same index as the repo and the license
  service, since `/healthz` is an unauthenticated Railway readiness route reachable without
  the operator's own session. A missing or unreadable index file omits the fields rather
  than failing readiness. Private package only; no publishable release.
- ba3bf41: Three small hardening fixes to the admin control-plane: the Business page's `?page=`
  query param is now capped so a hand-crafted huge value can't overflow the tenant list
  query and 500 the page; the overview board gains a card for the Intel section (it was
  already reachable from the top nav but missing from the home page); and the
  purchase-email resend action now throttles to one send per account per minute so a
  mis-click or scripted loop can't spam an account's inbox. Private package only; no
  publishable release.
- a931095: Admin control-plane gains an intel findings page: a read-only feed of competitor,
  compliance-framework, GitHub-traction, analytics, and error-triage findings from the
  standing intelligence daemon, with severity and source filters. Private package only; no
  publishable release.
- a931095: Admin control-plane's top nav gains a sign-out control next to the theme toggle. Private
  package only; no publishable release.
- a931095: Admin overview home now links its Ops, Business, Architecture, and Decisions cards
  instead of rendering them as unlinked placeholders — all four sections were already
  built and reachable from the top nav. Private package only; no publishable release.
- 8db39db: Added a small live production check for the admin control-plane: it confirms the deployed
  readiness endpoint reports healthy and that visiting the control-plane while signed out sends
  you to the sign-in page. It runs on demand and touches only already-public, unauthenticated
  endpoints. No product code changed, no runtime behavior change.
- a931095: Business admin's tenants table now shows each account's resolved email address, adds a
  search box that matches on account id or email, and paginates instead of loading every
  row at once. The other business tables now cap their reads to a bounded page instead of
  running unbounded. Private package only; no publishable release.
- a931095: Business admin gains a per-account view that verifies the tamper-evident audit chain
  every operator action already appends to, surfacing whether it is intact or where it
  broke. Private package only; no publishable release.
- 11cb4c3: The admin comp-grant boundary (`grantEntitlementAdmin`) now rejects an
  unresolvable entitlement id with a 400 before writing any row, instead of accepting an
  arbitrary string that would later brick the target account's entire entitlement
  expansion on its next `/issue`/dashboard read. The allowlist is derived live from
  `expandEntitlements` (bundle ids, indexed modules, reserved graduation ids, and legacy
  aliases) — never a hand-maintained list. Private packages only; no publishable release.
- 4036574: The Resend email driver gains an optional `replyTo` config field, sent as the `reply_to` field
  on the wire so replies to a transactional send land in a real inbox instead of bouncing off a
  no-reply sender. The three product senders (site magic links, license lifecycle notices, the
  admin test-send) opt in with the support inbox, and user-facing contact copy on the refunds,
  procurement, partners, and affiliates pages plus the ask-AI panel now points at the support
  address; legal pages keep the accounts contact.
- 5e9996e: Move EMAIL_SAMPLE_DATA + isEmailTemplateId into @caisson/email as public exports (single source
  for the admin catalog preview, the send-test route, and the visual harness email leg); admin
  imports repointed, app-local copy deleted.
- 55b3d48: Fix the intelligence scheduler so watcher cadences longer than about 24.8 days fire at their true interval instead of collapsing into a tight loop, and run the admin control-plane's auth-table migration at server boot — with the health check failing closed if that migration does not succeed, so a broken deploy is never marked healthy.
- a931095: Adds an admin rescue action that first-mints a license for an account that holds paid
  entitlements but never received one, for the cases where the license reissue action
  cannot help because there is no prior grant to re-serve. It mints through the same
  license-issuing path the reissue action already uses, is bounded to one account per call,
  and is fully audit-logged like every other admin action. Private package only; no
  publishable release.
- a931095: Adds an admin action that resends a purchase-confirmation-style email to an account's
  own address, carrying its current entitlements and a dashboard link, for support cases
  where a buyer needs their access back in their inbox. It is not a byte-exact copy of the
  original receipt. Audit-logged like every other admin action. Private package only; no
  publishable release.
- d5cef92: Your license now arrives on its own. After a purchase or a subscription renewal, your
  license is issued and stored automatically — no more waiting on support to run it by hand.
  Your purchase receipt now includes it directly when it's ready.

  Payment notification retries are now handled cleanly. If your payment provider redelivers a
  notification for a transaction that already went through, you will no longer see a duplicate
  receipt email, and a subscription's included-updates window can no longer be nudged forward by
  a retry that carries no new charge.

  If a subscription is canceled or a purchase is refunded and it actually removes something you
  had access to, you'll now get a short email saying so, instead of finding out only by noticing
  it missing from your dashboard.

  If your one-time purchase's included-updates window is about to lapse, you'll now get an
  advance notice by email, the same way you already do for expiring credits.

  A card dispute (chargeback) on your account no longer triggers any automatic change to your
  access — an operator reviews it and reaches out before anything changes.

  On the admin side, the process that publishes revoked-license information to the edge is now
  ordered correctly when two revokes happen close together, closing a narrow window where the
  older of the two could have briefly overwritten the newer one.

- ba04bc1: A shared platform migration chain, so the marketing/dashboard app and the operator admin app
  apply the exact same ordered database schema.

  `@caisson/platform-migrations` is a new, private, unpublished package: the ordered chain of
  platform schema migrations (credits, entitlements, licenses, usage metering, and their
  follow-on columns), plus a small helper that assembles and applies the chain against either a
  real Postgres or an in-memory PGlite double. It is the one place this chain is defined now.

  The marketing/dashboard app's deploy-time migration runner reads the chain from this new
  package instead of declaring it locally. The admin app's local development database bootstrap
  now applies the SAME chain instead of hand-copying individual schema pieces — closing off a
  class of drift where the admin app's local database could silently fall behind the real one. A
  new automated check boots the admin app's local database and confirms every cross-tenant read
  table exists with the correct row-level security in place.

- 4c141b0: Export the license and docs service request-body schemas for security schema fuzzing, and add a local admin auth harness so authed pages can be exercised without OAuth. No runtime behavior change.
- b5a3690: Repoint hand-rolled inline controls at the new kit interactive primitives: the marketplace
  facet Type/Category/Price/Media filters now use `Radio`/`Checkbox` instead of raw
  `<input>` elements, the primary-nav Editions/Marketplace/Resources disclosures now build on
  the new `Popover` primitive (removing duplicated Escape/outside-click/focus-return
  handling), the mobile hamburger nav now builds on the open `Dialog` primitive's drawer
  variant (native `<dialog>` + `showModal()`, top-edge sheet — scrim-close, focus trap, inert
  background, and focus-return are the primitive's job now), and the admin
  business-mutation panel's checkbox uses the same kit `Checkbox`.
  `@caisson/testing` gains a shared axe-core + JSDOM harness (`renderIntoJsdom`,
  `expectNoA11yViolations`/`expectNoA11yViolationsIn`) backing the new primitives' a11y
  regression tests. Private packages only; no publishable release.
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

- Updated dependencies [81223a7]
- Updated dependencies [5d60969]
- Updated dependencies [1bc677a]
- Updated dependencies [51e3ed0]
- Updated dependencies [08fd857]
- Updated dependencies [3d23da7]
- Updated dependencies [230f02a]
- Updated dependencies [b8fe873]
- Updated dependencies [11cb4c3]
- Updated dependencies [a79acb4]
- Updated dependencies [0137008]
- Updated dependencies [51e3ed0]
- Updated dependencies [9a81dd7]
- Updated dependencies [114e2a0]
- Updated dependencies [4036574]
- Updated dependencies [5e9996e]
- Updated dependencies [2b65cf3]
- Updated dependencies [2b65cf3]
- Updated dependencies [a931095]
- Updated dependencies [a931095]
- Updated dependencies [b3c5b0b]
- Updated dependencies [d5cef92]
- Updated dependencies [d9154da]
- Updated dependencies [5a8b317]
- Updated dependencies [0dd715a]
- Updated dependencies [230f02a]
- Updated dependencies [a0aa9a3]
- Updated dependencies [8253e76]
- Updated dependencies [ba04bc1]
- Updated dependencies [2b65cf3]
- Updated dependencies [2b65cf3]
- Updated dependencies [9a81dd7]
- Updated dependencies [99d665a]
- Updated dependencies [99d665a]
- Updated dependencies [ab352ab]
- Updated dependencies [f903014]
- Updated dependencies [eff7248]
- Updated dependencies [4c141b0]
- Updated dependencies [a79acb4]
- Updated dependencies [47e04fd]
- Updated dependencies [9a81dd7]
- Updated dependencies [3758b3c]
- Updated dependencies [51e3ed0]
- Updated dependencies [b5a3690]
- Updated dependencies [b5a3690]
- Updated dependencies [51e3ed0]
- Updated dependencies [c905c61]
- Updated dependencies [2c93128]
- Updated dependencies [b7e58a8]
- Updated dependencies [b43959c]
- Updated dependencies [4d85f28]
- Updated dependencies [97b0341]
- Updated dependencies [317bad5]
  - @caisson/email@0.4.0
  - @caisson/platform-migrations@0.2.0
  - @caisson/platform-reads@0.2.0
  - @caisson/audit-worm@1.0.0
  - @caisson/brand@0.1.2
  - @caisson/ui@0.6.0
  - @caisson/registry-schema@0.5.0
  - @caisson/credits@0.5.0
  - @caisson/service-license@0.0.7
  - @caisson/demo-registry@0.2.0
  - @caisson/kernel@0.4.3
  - @caisson/observability@0.3.0
  - @caisson/org-controls@0.3.0
  - @caisson/auth@0.3.2
  - @caisson/tenancy-rls@0.5.1

## 0.0.5

### Patch Changes

- 783110d: Corrected an internal code comment that undercounted the operator mutation panel's actions by one.
- Updated dependencies [b791198]
- Updated dependencies [aec9f1c]
- Updated dependencies [defb22e]
- Updated dependencies [0c883ae]
- Updated dependencies [ad02304]
- Updated dependencies [41e07b6]
- Updated dependencies [4d7eb71]
- Updated dependencies [783110d]
- Updated dependencies [ad66801]
- Updated dependencies [783110d]
- Updated dependencies [8ab8ccc]
- Updated dependencies [783110d]
- Updated dependencies [850b844]
- Updated dependencies [850b844]
- Updated dependencies [0af4dbf]
- Updated dependencies [0af4dbf]
- Updated dependencies [0af4dbf]
- Updated dependencies [783110d]
  - @caisson/audit-worm@0.2.4
  - @caisson/auth@0.3.0
  - @caisson/credits@0.4.0
  - @caisson/kernel@0.4.2
  - @caisson/observability@0.2.4
  - @caisson/platform-reads@0.1.5
  - @caisson/tenancy-rls@0.4.0
  - @caisson/ui@0.4.0
  - @caisson/brand@0.1.0
  - @caisson/org-controls@0.2.0
  - @caisson/service-license@0.0.5

## 0.0.4

### Patch Changes

- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
  - @caisson/audit-worm@0.2.3
  - @caisson/kernel@0.4.1
  - @caisson/tenancy-rls@0.3.2
  - @caisson/service-license@0.0.4
  - @caisson/auth@0.2.3
  - @caisson/credits@0.3.2
  - @caisson/observability@0.2.3
  - @caisson/platform-reads@0.1.4

## 0.0.3

### Patch Changes

- 4fc006c: Admin paid-purchase revoke. service-license: `revokePurchaseAdmin` composes the
  existing source-scoped revoke helpers with the bounded clawback (`creditsGrantedBySource -
creditsClawedForSource`) under `withAdminWrite` in one transaction, a new `purchase_revoke`
  `admin_action_log` action + CHECK migration, and a `license-revocation-store` feeding the registry's edge deny-set. admin: a paid-revoke mutation card with an impact-preview read (active sources +
  projected claw) plus type-to-confirm, and the `/api/admin/entitlement/revoke-purchase` (+
  `/preview`) routes. registry: the Worker deny-set check (`revocation-list.ts`), wired
  fail-open into `entitlement-filter.ts`/`deploy-entry.ts` so a fetch/parse failure never blocks an
  install.
- Updated dependencies [4fc006c]
- Updated dependencies [bd9a005]
- Updated dependencies [fb8d966]
  - @caisson/service-license@0.0.3
  - @caisson/ui@0.3.0
  - @caisson/kernel@0.4.0
  - @caisson/platform-reads@0.1.3
  - @caisson/audit-worm@0.2.2
  - @caisson/auth@0.2.2
  - @caisson/credits@0.3.1
  - @caisson/observability@0.2.2
  - @caisson/tenancy-rls@0.3.1

## 0.0.2

### Patch Changes

- f9d58c4: Post-wave-hardening triage Bucket B, test and proof hygiene, no
  runtime behavior change for buyers.

  - root bunfig.toml scopes bun test discovery away from stale compiled dist/
    output, plus a regression test in @caisson/testing.
  - apps/admin's PGlite bootstrap now applies the ADR-0218 line-item migrations
    (0008/0009), matching the deploy-migrate chain, plus a columns-contract-style parity test.
  - packages/field-crypto's live KMS proof schedules deletion for both throwaway
    CMKs defensively in afterAll, not just the one the last leg reached.
  - apps/admin's /business degrade path distinguishes a genuine undefined-table
    error (Postgres 42P01) from any other transient DB error before rendering the
    provisioning hint.

- Updated dependencies [b5915e0]
- Updated dependencies [e62c88d]
- Updated dependencies [ccf8b10]
- Updated dependencies [afa6070]
- Updated dependencies [95103b6]
- Updated dependencies [aaff518]
- Updated dependencies [904b15b]
- Updated dependencies [549dd4e]
- Updated dependencies [6e08cc6]
  - @caisson/tenancy-rls@0.3.0
  - @caisson/kernel@0.3.0
  - @caisson/credits@0.3.0
  - @caisson/service-license@0.0.2
  - @caisson/ui@0.2.1
  - @caisson/observability@0.2.1
  - @caisson/audit-worm@0.2.1
  - @caisson/auth@0.2.1
  - @caisson/platform-reads@0.1.2

## 0.0.1

### Patch Changes

- Updated dependencies [72ffd85]
- Updated dependencies [59d332f]
- Updated dependencies [6236f59]
- Updated dependencies [69817a1]
- Updated dependencies [9483a36]
  - @caisson/observability@0.2.0
  - @caisson/platform-reads@0.1.1
  - @caisson/kernel@0.2.0
  - @caisson/credits@0.2.0
  - @caisson/tenancy-rls@0.2.0
  - @caisson/ui@0.2.0
  - @caisson/service-license@0.0.1
