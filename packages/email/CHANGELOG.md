# @caisson-sh/email

## 1.0.0

### Major Changes

- 0b0fbb1: Removed the purchase, renewal, subscription-payment, updates-window, access-revoked, waitlist, nurture and abandoned-checkout templates. The auth emails and the credits-expiring notice remain.

### Patch Changes

- 73bdf3c: Each package's `manifest.ts` now imports `defineModule` from the sibling `registry-schema` package instead of a monorepo-only directory, so the file resolves wherever `@caisson-sh/registry-schema` is installed next to it.
- 784a846: Each package's metadata now links to its source directory in the public repository.
- 611f1de: Package comments, tests, READMEs and generated templates now describe the reader as an adopter integrating the package into their own app, not a buyer of a Caisson product. Compliance-artifact wording that faced an adopter's own customers now says so explicitly, and internal signing-key and licensing-domain comments no longer reference a retired commercial license issuer.
- 73bdf3c: Every package is now Apache-2.0 and publishes to the public npm registry. Each package ships the Apache LICENSE file, and the registry manifest carries the same license. Nothing needs a license key or a private registry to install.
- 0b02891: Every package now publishes under the `@caisson-sh` npm scope. Update imports and dependencies to the new names; module ids in registry manifests use the same scope.
- Updated dependencies [73bdf3c]
- Updated dependencies [784a846]
- Updated dependencies [611f1de]
- Updated dependencies [73bdf3c]
- Updated dependencies [0b02891]
  - @caisson-sh/kernel@0.10.1

## 0.5.8

### Patch Changes

- e211684: Update the generated Next.js framework template and email transport to patched dependency releases. The workspace lockfile also refreshes the affected transitive security fixes without changing their declared dependency ranges.
- 69b3ba3: Routine non-major dependency refresh.

  `apps/site` picks up `@azure/identity`, `@plausible-analytics/tracker`, `motion` and
  `web-vitals` point releases (the `motion` 13.x major stays held). The CLI's
  `@modelcontextprotocol/sdk` moves to `1.30.0`, and `@caisson/ai-kit`'s own
  devDependency moves in lockstep — it imports the SDK's `Server` type directly alongside
  `@caisson/mcp-server`, a workspace sibling that shares a resolution subtree with the
  CLI, and a split version there makes the two `Server` types nominally distinct at
  typecheck. The email package's `nodemailer` moves to `9.0.5`. Root build tooling moves
  too: `@types/bun`, `dependency-cruiser` to `18.2.0` with its patch file re-cut,
  `eslint-plugin-storybook`, `knip`, `oxfmt` and `oxlint`.

  Three bumps prepared alongside these are deliberately **not** here. Each independently
  breaks something, and none is fixable by choosing a different version:

  - **`fumadocs-core` / `fumadocs-mdx` / `fumadocs-ui`.** Two separate blockers, and the
    second only appeared under the browser gate. First, the static search client's
    `initOrama` option is deprecated in favour of `initDB` and its default now builds
    against `zbsearch` rather than `@orama/orama` — that part is a _trivial_ adoption, a
    deletion: drop the hand-written init and call `oramaStaticClient()` bare, because the
    library default is already `create({ schema: { _: "string" } })` and `zbsearch`'s
    tokenizer defaults `language` to `"english"` on its own. Second, and the actual
    blocker: **16.15.1 renders two `main` landmarks on `/docs`.** The site's docs layout
    renders none of its own by design, so both come from fumadocs, and the P1 browser
    guard fails with `Expected: 1, Received: 2`. Notably the search guard
    (`P1-004`, focus return on every dismissal path) **passes** under the migration, so
    the search half is sound — the a11y regression is what holds the line.
  - **`kysely` `0.29.4` to `0.29.5`.** Only `apps/site` declares kysely, as a single exact
    pin, so there are never two copies of it. Moving it perturbs the peer-hash of
    `@better-auth/core`, and the site imports `better-auth` and
    `@better-auth/kysely-adapter` side by side; they then land on differently-hashed
    copies of the shared core whose `BetterAuthOptions` are nominally distinct under
    `exactOptionalPropertyTypes`. An override forcing one `@better-auth/core` version does
    not help — an override pins a version, not a peer-hash.
  - **A repo-wide `jose` pin.** On its own, from a clean baseline, it reproduces exactly
    the same three errors in the same file by the same mechanism. Both peer-hash items are
    tracked as backlog work; the override route is already ruled out.

  An earlier draft of this note argued the reverse of that last point: that the `jose` pin
  was load-bearing, and that dropping it would split the auth core and stop the site
  typechecking. That is backwards. Measured from `main`'s manifests as a green baseline,
  adding one group at a time: the pin alone produces the split, and `main` itself carries
  two `jose` versions and exactly one `@better-auth/core` while typechecking clean.

- Updated dependencies [87b07c6]
- Updated dependencies [7d39669]
- Updated dependencies [498b279]
  - @caisson/kernel@0.10.0

## 0.5.7

### Patch Changes

- 87275f6: Replace ESLint and Prettier with oxlint and oxfmt.

  Linting and formatting now run on the oxc toolchain. The rule floor is unchanged: the same
  no-any, no-console, type-only-import and provider-SDK-boundary rules are enforced, at the same
  severities, and formatting keeps the settings the previous formatter used. Every package here is
  touched by the dependency removal or by the one-pass reformat, so each takes a patch bump; no
  runtime behaviour changes.

  For anyone consuming the shared configuration: the lint config package is renamed, and the lint
  and format commands changed.

- Updated dependencies [f669d4a]
- Updated dependencies [b0e66b6]
- Updated dependencies [2609293]
- Updated dependencies [87275f6]
  - @caisson/kernel@0.9.0

## 0.5.6

### Patch Changes

- Updated dependencies [7d74f8f]
  - @caisson/kernel@0.8.0

## 0.5.5

### Patch Changes

- Updated dependencies [e917c52]
- Updated dependencies [f2cb853]
  - @caisson/kernel@0.7.0

## 0.5.4

### Patch Changes

- 6d1c805: Email footer honesty fix: the shared "not a marketing message" transactional
  claim was false on the nurture-follow-up lifecycle send. `EmailLayout` now
  takes an optional `footerNote` prop (defaults to the transactional claim);
  nurture-follow-up passes its own accurate note. Every template's footer also
  now carries a support contact path (`support@caisson.sh`), which money
  receipts previously had none of.
- 6d1c805: Visual-audit tail sweep on the transactional templates: order ids, license
  tokens, and CLI commands inline in body prose (e.g. `bunx @caisson-sh/cli@latest`,
  a Paddle order id) now render through new `EmailMono`/`EmailLink` helpers on
  `EmailLayout` instead of unstyled plain text, and the EULA URL spelled out in
  several templates is now a real link. `waitlist-welcome` now passes its own
  accurate `footerNote` (it's a growth send, not a transactional one). Em dashes
  are replaced with plain punctuation across every template's body copy.
- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
  - @caisson/kernel@0.6.0

## 0.5.3

### Patch Changes

- c36b9e2: Builds now compile with the native TypeScript 7 compiler. The emitted type declarations are unchanged in API; some inferred type members appear in a different order in .d.ts files. Aggregate compile time drops roughly sevenfold.
- Updated dependencies [c36b9e2]
  - @caisson/kernel@0.5.3

## 0.5.2

### Patch Changes

- Updated dependencies [fc0bb99]
  - @caisson/kernel@0.5.2

## 0.5.1

### Patch Changes

- Updated dependencies [7de6fa4]
  - @caisson/kernel@0.5.1

## 0.5.0

### Minor Changes

- 59e1365: Resend quota telemetry + volume-cliff ops alert (Kickoff T deliverability item). The Resend driver
  gains an optional `onQuota` observer fed from the `x-resend-monthly-quota` / `x-resend-daily-quota`
  response headers on successful sends — Resend exposes no usage API, so these headers are the only
  programmatic signal; observer errors never break a send. services/license wires the observer to a
  Discord ops alert when remaining monthly quota drops under `RESEND_QUOTA_ALERT_REMAINING` (default
  5000, "0" disables), rearming every 6h. Resend's own built-in 80%/100% quota emails remain the
  zero-code second layer.

### Patch Changes

- a0fd9b1: Consolidate the deprecated @react-email/components + @react-email/render scoped packages into
  the merged react-email v6 package (same export surface).
- Updated dependencies [e5e4311]
- Updated dependencies [e183860]
  - @caisson/kernel@0.5.0

## 0.4.0

### Minor Changes

- 81223a7: Add an `abandoned-checkout` email template: a flat "your cart is still here" nudge with the
  line items and one CTA back to the cart, matching `purchase-confirmation`'s restrained tone (no
  urgency copy, no countdown). Optionally renders one plain discount sentence when both
  `discountLabel` and `discountUrl` are supplied (env-gated on the sender side); a half-set
  discount pair fails the coercer closed.
- b8fe873: Commerce-lifecycle email templates and a live updates-window read.

  `@caisson/email` gains two registered transactional templates: `purchase-confirmation`
  (post-purchase receipt: buyer, order id, per-line labels, integer-cent total, dashboard
  link) and `renewal-confirmation` (renewed entitlement lines with their new updates-window
  end dates). Both mirror the existing branded layout and coerce through the same
  fail-soft template registry.

  `@caisson/platform-reads` gains `readUpdatesWindows(tx, accountId)` — the
  per-purchased-entitlement updates-window fold (one-time-sourced grants only,
  most-favorable bound per id) as a live read for buyer-facing surfaces, mirroring the
  license service's `computeUpdatesWindows` semantics without importing its runtime.

- 114e2a0: Dark-mode support for every transactional template via the hybrid technique: the light
  palette retuned off pure-white/near-black extremes (survives Gmail-style forced inversion),
  plus `color-scheme`/`supported-color-schemes` metas and a `prefers-color-scheme: dark`
  palette (`BRAND_COLOR_DARK`, keyed off explicit layout classes with `!important`) for
  clients that honor author dark styles. All color styling stays in the shared layout —
  no template changes.
- 4036574: The Resend email driver gains an optional `replyTo` config field, sent as the `reply_to` field
  on the wire so replies to a transactional send land in a real inbox instead of bouncing off a
  no-reply sender. The three product senders (site magic links, license lifecycle notices, the
  admin test-send) opt in with the support inbox, and user-facing contact copy on the refunds,
  procurement, partners, and affiliates pages plus the ask-AI panel now points at the support
  address; legal pages keep the accounts contact.
- 5e9996e: Move EMAIL_SAMPLE_DATA + isEmailTemplateId into @caisson/email as public exports (single source
  for the admin catalog preview, the send-test route, and the visual harness email leg); admin
  imports repointed, app-local copy deleted.
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

- 9a81dd7: Add a `subscription-payment-received` email template: a dedicated recurring-payment
  receipt for subscription-cycle charges, distinct from the first-purchase `purchase-confirmation`.
  Shares the purchase-confirmation prop shape; only the copy differs.
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
- Updated dependencies [2b65cf3]
- Updated dependencies [8253e76]
  - @caisson/kernel@0.4.3

## 0.3.0

### Minor Changes

- 783110d: Transactional emails now render as branded HTML with a plain-text fallback instead of plain text,
  and a new dev-only preview route shows every template with sample data. The buyer sign-in page
  also gains an email-and-password option alongside the existing magic link, with account
  verification and a forgot/reset password flow.
- 4d7eb71: Add the `credits-expiring` T-30d expiry notice — the first
  transactional/billing template. The template registry is now keyed by a per-template
  `TemplateDataMap` (the three auth templates keep their `{ url }` shape; `credits-expiring` takes
  `{ credits, expiresOn, url }` and renders a dynamic subject). `tryRenderEmailTemplate` coerces
  free-form driver data per template and still falls back to `null` on a shape mismatch, so every
  driver's generic mapping is unchanged.

### Patch Changes

- b791198: Documentation and metadata cleanup plus dependency-declaration hygiene: package descriptions, READMEs, changelogs, and source comments no longer carry internal build references, and shared external dependency ranges now resolve through the workspace dependency catalog (published dependency ranges unchanged; the TypeScript devDependency floor moves to ^5.7.3).
- 0af4dbf: Rewrote README, AGENTS, CHANGELOG, package.json descriptions, and inline source comments to
  read as clean, buyer-facing documentation. Removed sibling-repository provenance framing,
  internal build-phase shorthand, and bare specification-id citations that had leaked into
  shipped copy, and corrected a couple of stale cross-package dependency and usage claims to
  match the shipped code. No runtime behavior changed in any package — documentation and
  comments only.
- Updated dependencies [b791198]
- Updated dependencies [0af4dbf]
  - @caisson/kernel@0.4.2

## 0.2.3

### Patch Changes

- Updated dependencies [cf66d65]
  - @caisson/kernel@0.4.1

## 0.2.2

### Patch Changes

- Updated dependencies [fb8d966]
  - @caisson/kernel@0.4.0

## 0.2.1

### Patch Changes

- Updated dependencies [e62c88d]
- Updated dependencies [ccf8b10]
- Updated dependencies [549dd4e]
  - @caisson/kernel@0.3.0

## 0.2.0

### Minor Changes

- 9483a36: Initial public release (0.1.0) — publish-readiness flip (ADR-0111). The open Base substrate (Apache-2.0, tier `oss`) publishes to public npm; the commercial editions/primitives/generator (tier `paid`) publish to GitHub Packages restricted. Versions were aligned to 0.1.0 in lockstep with the registry ledger; this changeset records the 0.1.0 release and seeds the changeset-presence gate (ADR-0021).

### Patch Changes

- Updated dependencies [69817a1]
- Updated dependencies [9483a36]
  - @caisson/kernel@0.2.0
