# @caisson/site

## 0.2.9

### Patch Changes

- Updated dependencies [5d03808]
- Updated dependencies [7de6fa4]
- Updated dependencies [63e9fae]
  - @caisson/registry-schema@0.5.4
  - @caisson/kernel@0.5.1
  - @caisson/platform-reads@0.2.3
  - @caisson/ai-kit@0.5.1
  - @caisson/cli@0.7.1
  - @caisson/credits@0.5.5
  - @caisson/pricebook@0.5.6
  - @caisson/service-license@0.0.13
  - @caisson/ai-meter@1.0.5
  - @caisson/audit-worm@2.1.2
  - @caisson/auth@0.3.4
  - @caisson/billing@0.6.2
  - @caisson/email@0.5.1
  - @caisson/field-crypto@0.3.3
  - @caisson/local-store@1.0.2
  - @caisson/migrate@0.2.7
  - @caisson/observability@0.3.2
  - @caisson/org-controls@0.3.2
  - @caisson/platform-migrations@0.2.6
  - @caisson/prompt-registry@1.0.2
  - @caisson/rate-limit@0.1.5
  - @caisson/tenancy-rls@0.5.3
  - @caisson/ui-pro@0.3.1
  - @caisson/demo-registry@0.2.6

## 0.2.8

### Patch Changes

- Updated dependencies [c7476b9]
- Updated dependencies [f40653b]
- Updated dependencies [ba4f62d]
- Updated dependencies [9d50e7c]
- Updated dependencies [c3b0e41]
- Updated dependencies [4c6d3f7]
  - @caisson/ai-kit@0.5.0
  - @caisson/cli@0.7.0
  - @caisson/registry-schema@0.5.3
  - @caisson/ai-meter@1.0.4
  - @caisson/platform-reads@0.2.2
  - @caisson/credits@0.5.4
  - @caisson/pricebook@0.5.5
  - @caisson/service-license@0.0.12
  - @caisson/demo-registry@0.2.5
  - @caisson/platform-migrations@0.2.5
  - @caisson/audit-worm@2.1.1

## 0.2.7

### Patch Changes

- Updated dependencies [f844386]
  - @caisson/cli@0.6.3

## 0.2.6

### Patch Changes

- 8b01527: Sharpen the compliance and build-vs-buy copy: the compliance page now shows how the evidence
  format is proven — naming the OSCAL conformance check that runs on every push and stating exactly
  what it covers (a self-run schema check on Caisson's export format, not a third-party assessment).
  The build-vs-buy FAQ answers two questions buyers actually ask — why an AI coding assistant is not
  a substitute on the money and crypto seams, and what support and updates come with owned source
  (email and Discord support, 12 months of updates, and the perpetual license and vendor-continuity
  guarantees). The homepage compliance door claim reads segment-neutral so any audited team sees
  itself.
  - @caisson/cli@0.6.2

## 0.2.5

### Patch Changes

- d5ae100: Ask-AI: emit a PostHog `$ai_generation` LLM-observability event per model call

  The public Ask-AI route calls OpenRouter directly (it bypasses the sold `@caisson/ai-kit`
  package, which must never carry a hardcoded vendor sink), so its generations were invisible in
  PostHog — the M4 audit finding of zero `$ai_*` events in caisson-prod. The route now surfaces the
  OpenRouter usage token counts it previously discarded and, after each real model call, fires one
  fire-and-forget, fail-soft `$ai_generation` capture carrying model, provider, input/output tokens,
  total USD cost, latency, and HTTP/error status. No prompt or completion text ever leaves the box —
  `$ai_input` and `$ai_output_choices` are never sent. Config-gated on `POSTHOG_CAPTURE_KEY`; when it is
  unset there is no capture and zero behavior change.

- 12182a5: Renumber the three demo-run site-local migrations 0023-0025 → 0027-0029: the shared
  platform chain had itself grown 0023_order_record_subscription_link…0026_affiliate_code, so the
  demo entries sorted mid-chain, renumbered prod's applied positional ledger, and failed the
  caisson-license predeploy closed on checksum drift (nothing applied). The migrations have never
  been applied anywhere persistent, so the rename is safe. Adds an append-only assembled-ledger
  golden test pinning the merged chain, and updates the claimed-prefix registry note (next free:
  0030).
- d3a889a: Ship the /demo sandbox surface: a capped, Turnstile-gated demo-run that generates a visitor's own
  scaffold in-process behind atomic daily and concurrency budgets with per-IP rate limits, a shared
  prebuilt preview pane rendering a real passing install, build, and test transcript of the demo app,
  and a read-only commercial-excerpt section backed by an append-only, secret-scanned, drift-guarded
  manifest. Request bodies across the demo-run and ask-ai routes now read through a shared streaming
  size cap that a chunked or garbage content-length request cannot bypass.
- Updated dependencies [12182a5]
- Updated dependencies [1de88d7]
  - @caisson/platform-migrations@0.2.4
  - @caisson/audit-worm@2.1.0
  - @caisson/cli@0.6.2
  - @caisson/demo-registry@0.2.4
  - @caisson/service-license@0.0.11
  - @caisson/platform-reads@0.2.1

## 0.2.4

### Patch Changes

- Updated dependencies [5a09b01]
  - @caisson/registry-schema@0.5.2
  - @caisson/credits@0.5.3
  - @caisson/pricebook@0.5.4
  - @caisson/service-license@0.0.10
  - @caisson/ai-kit@0.4.4
  - @caisson/ai-meter@1.0.3
  - @caisson/platform-migrations@0.2.3
  - @caisson/platform-reads@0.2.1
  - @caisson/demo-registry@0.2.3

## 0.2.3

### Patch Changes

- Updated dependencies [3f05e1e]
- Updated dependencies [3f05e1e]
  - @caisson/ai-kit@0.4.3
  - @caisson/registry-schema@0.5.1
  - @caisson/credits@0.5.2
  - @caisson/pricebook@0.5.3
  - @caisson/service-license@0.0.9
  - @caisson/ai-meter@1.0.2
  - @caisson/platform-migrations@0.2.2
  - @caisson/platform-reads@0.2.1
  - @caisson/demo-registry@0.2.2

## 0.2.2

### Patch Changes

- 7e823a9: Renovate dependency pins (exact versions) across the app and service workspaces; no code change.
- a8d8f5e: Add a Trust page that links the public status page, gives the security contact, points to the shipped security and evidence documentation, and lists the third-party services that process data for the Caisson service. Link it from the site footer.
- Updated dependencies [93c0a78]
- Updated dependencies [ca44db5]
- Updated dependencies [baaa4fc]
- Updated dependencies [a8696cf]
- Updated dependencies [1867fa3]
- Updated dependencies [e5e4311]
- Updated dependencies [e5e4311]
- Updated dependencies [e5e4311]
- Updated dependencies [59e1365]
- Updated dependencies [59e1365]
- Updated dependencies [59e1365]
- Updated dependencies [59e1365]
- Updated dependencies [a0fd9b1]
- Updated dependencies [d1b4afa]
- Updated dependencies [7e823a9]
- Updated dependencies [809592d]
- Updated dependencies [809592d]
- Updated dependencies [e183860]
  - @caisson/ai-kit@0.4.2
  - @caisson/audit-worm@2.0.0
  - @caisson/org-controls@0.3.1
  - @caisson/auth@0.3.3
  - @caisson/kernel@0.5.0
  - @caisson/ui-pro@0.3.0
  - @caisson/email@0.5.0
  - @caisson/service-license@0.0.8
  - @caisson/brand@0.1.3
  - @caisson/demo-registry@0.2.1
  - @caisson/observability@0.3.1
  - @caisson/ui@0.6.1
  - @caisson/prompt-registry@1.0.1
  - @caisson/platform-migrations@0.2.1
  - @caisson/ai-meter@1.0.1
  - @caisson/billing@0.6.1
  - @caisson/credits@0.5.1
  - @caisson/field-crypto@0.3.2
  - @caisson/local-store@1.0.1
  - @caisson/migrate@0.2.6
  - @caisson/pricebook@0.5.2
  - @caisson/tenancy-rls@0.5.2
  - @caisson/platform-reads@0.2.1
  - @caisson/registry-schema@0.5.0

## 0.2.1

### Patch Changes

- 3ae944a: AEO program: AI-crawler robots allow group, agentic-dev FAQPage JSON-LD, three glossary explainers, and the 20-page Caisson-vs-X comparison family with hub, sitemap, and FAQ schema.
- d357ec3: The affiliate page's payout copy is now accurate: referred sales are billed and collected by
  Paddle as merchant of record, and Caisson pays commissions to affiliates directly once a sale
  clears its 14-day refund window (the page previously said commissions were paid out through
  Paddle, which isn't how a merchant of record works). Private app; no publishable release.
- e02aedd: The Ask AI widget's "Talk to the team" link now opens a direct email to the team instead of
  routing to the security/procurement page, and a question the assistant couldn't answer now
  files a support ticket automatically from the question text so a human can follow up —
  previously the widget captured the question for product analytics only, with no ticket and
  no direct contact path. A capacity-limit escalation (the daily usage cap) does not file a
  ticket, since it isn't a question a human needs to answer.
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

- 230f02a: Added a "Buy credits" button on the Credits dashboard page, so a 5,000-credit top-up pack can be
  purchased directly instead of needing to contact support. Also fixed the "Current balance" tile so
  it never overstates what you can actually spend: it now reflects your real spendable total right
  away, rather than briefly counting expired credits until the next daily cleanup runs.
- ff1d928: Add a deterministic browser end-to-end suite that runs against a local production build in CI:
  it pins the homepage code viewer's visibility and selection swap, the docs main landmark and
  skip-link focus behavior, the marketplace compare control's enlarged tap target and stacking
  above the card preview action, docs-search focus return on dismissal, and the 44px hit-area
  overlays on the docs chrome, nav cluster, and media-carousel arrows at mobile width.
- 230f02a: Add-to-cart buttons now recognize what your account already owns: an already-purchased bundle or
  module shows as "Owned" instead of letting you add and pay for it a second time. Also, if a stale
  item is ever silently dropped from your cart (for example, a retired SKU left over from an earlier
  visit), you now see a one-line notice explaining what was removed instead of the item just
  disappearing with no explanation.
- 230f02a: Fixed two checkout reliability bugs. A failed Paddle checkout load (ad-blocker, flaky network,
  misconfigured token) used to silently break checkout for the rest of your session — reloading the
  page is no longer required, and the Pay button now shows a real error message instead of just
  reverting. Also, your cart is now cleared only after a payment actually completes, not the instant
  the checkout window opens — if you open checkout to review the total and then cancel, your cart
  lines are no longer lost.
- 08ac43e: `create-caisson` now accepts the advertised quickstart form `create-caisson my-app` — a bare
  project name with no `--name` flag — matching every install command shown in the docs and the
  site. An explicit `--name` still wins if both are given.

  Fixes a real-install bug where the generator could not find its module registry once installed
  from npm outside this monorepo: the registry snapshot is now bundled into the published package,
  so a fresh `bunx create-caisson` install resolves it correctly instead of failing.

  Fixes a second real-install bug in the same generated project: the `.npmrc` file that wires up
  module installation and your license key was silently missing from every generated project once
  the CLI was installed from a real package (package registries never ship a file literally named
  `.npmrc`). The generator now writes it correctly every time.

  `--help` now names the correct license-token environment variable, `CAISSON_LICENSE_TOKEN`
  (it previously named the wrong one).

  The `create-caisson` documentation page no longer describes a lockfile or a result type the
  generator does not produce — it now matches what the tool actually writes and returns.

- 4036574: The Resend email driver gains an optional `replyTo` config field, sent as the `reply_to` field
  on the wire so replies to a transactional send land in a real inbox instead of bouncing off a
  no-reply sender. The three product senders (site magic links, license lifecycle notices, the
  admin test-send) opt in with the support inbox, and user-facing contact copy on the refunds,
  procurement, partners, and affiliates pages plus the ask-AI panel now points at the support
  address; legal pages keep the accounts contact.
- 0137008: Buyer-surface remediation (Kickoff G): fixes the /dashboard/ai-keys P0 crash by
  unifying the apps/site-local migration list (`deploy-migrate.ts` and the dev PGlite double now
  apply the SAME list, closing a prod/dev migration drift that left `byok_key_meta` never created in
  production); adds a fail-closed AI-Production entitlement gate to /dashboard/ai-keys (page load +
  every `/api/byok` action); fixes the dashboard topbar account pill clipping and adds Sign-out to
  the mobile nav drawer; fixes the login form so an invalid-submit error renders visually distinct
  from a success message; corrects purchase-row labels to the canonical bundle names and the plan
  page's "Bundles & modules" heading; and adds the EULA's Credits clause (expiry, FIFO burn order,
  rollover) — pending operator sign-off on the exact wording.
- f0ab087: The getting-started guide now covers the post-purchase flow: where the license key comes from
  (`/dashboard/license`), the `CAISSON_LICENSE_TOKEN` a generated project's `.npmrc` needs before
  `bun install`, and two ways an AI coding agent can drive Caisson — shelling out to `create-caisson`
  directly, or wiring the auth-gated `@caisson/mcp-server` for tool-native access. The stale
  positional-argument install example is replaced with the CLI's real interactive and flagged forms.
- 3da56f0: Fixes a flaky e2e test: two header-control and carousel-arrow hit-area assertions in
  `browser-audit-p1.e2e.test.ts` occasionally read `getBoundingClientRect()` as 0x0 on a slow
  CI runner, because `page.goto`'s "load" event resolves before the browser guarantees the
  next paint — an evaluate that runs immediately after can see every rect collapsed and drop
  every result (`controls.length === 0` on two consecutive main-branch runs on 2026-07-11).
  Both evaluates now go through a small bounded-retry helper that reruns the same evaluate up
  to four times with a 500ms backoff whenever it detects it read pre-paint geometry, and
  otherwise returns immediately; a genuine post-paint failure still fails loudly after the cap.
  Test-only change, no product behavior touched.
- 9a81dd7: Platform migration 0017 (renewal_extension ledger) added to the deploy assembler; members-gate denies undrained legacy edition rows after the edition-trace purge.
- 74df6fe: The production route sweep now attributes console errors to their source frame: noise the
  Cloudflare challenge platform emits by design (its token probe's expected 401 and its styled
  log lines) is dropped by origin URL, while everything from the site's own frames — and every
  page error — stays zero-tolerance. The sweep passes 18/18 against production with the
  challenge widget armed.
- e0b000b: Fixed four marketing-surface honesty gaps. The Compliance, Local-first, and Agentic-Dev bundle pages, plus the AI-Production page, no longer link a composed member module to a depth page that doesn't exist yet — a module card is only clickable once its `/marketplace/modules/<slug>` page is live, closing a set of dead links that hit the flagship Compliance page mid-evaluation. The marketplace's structured data no longer advertises purchase URLs for modules that have no page. The AI-Production bundle page now lists its full, real set of composed modules instead of an undercount. And a Discord invite link now appears in the site footer and the dashboard's Community section once the operator sets one — closing the gap where a purchase granted a Discord role in a server nobody could find a way to join.
- 20fa0dc: The marketplace media standard has arrived: every one of the 28 catalog items (22 modules + 6 bundles)
  now renders real media in the marketplace card viewer and module depth pages — closing the prior
  8/28 media gap to 28/28 on one standardized framed-slide template (a chrome bar + body mirroring the
  homepage-terminal aesthetic). Content preference per item: the actual live `@caisson/ui-pro`
  component the item ships (ui-pro's data grid + audit timeline, rendered presentationally — no slide
  pulls interactive state); the item's real depth-page code artifact (the eight modules that already
  carry one — alerting, ai-meter, ai-evals, guardrails, prompt-registry, local-store, agent-kernel,
  agent-runner — rendered through the same framed `CodeBlock` the homepage uses); or an authored
  mechanism/composition diagram for everything else. Every bundle now leads with a composition slide
  naming its own real member modules composing onto the Apache-2.0 audited base (the Everything bundle
  reuses the whole-catalog hero artifact), and eight new authored diagrams close the gap for the
  remaining concept-only modules (credits, local-sync, local-inference, local-privacy, tool-exec,
  org-controls, billing-orchestration, frameworks-pack). The single existing audit-worm Remotion video
  slide is replaced by a static code-artifact slide for uniformity — the Remotion pipeline itself is
  untouched and stays available, just unused by the marketplace launch set. A `code-artifact` slide now
  counts toward the MEDIA facet on the same footing as a diagram or a live component.
- c78123d: Rework the marketplace into a single surface. Every bundle and module now lives in one filterable grid — filter by type, category, or price, search by name, and preview each card in a unified viewer with a media carousel (authored diagrams for the top modules, the audit-worm render, and the live UI Pro demo). The former Modules and Build tabs fold in: a cart-aware "Your stack" rail shows the running total and points at the bundle that covers your picks for less, and the compare tray now spans bundles and modules together. The homepage honest-artifact section becomes an interactive, color-coded source tree that reveals the real code on click, and the evidence and dual-door proof chips get a cleaner, bolder treatment.
- ef14a65: Marketplace browsing now completes a purchase without leaving the page. The module preview grew
  into a full purchase card — media slot, definition, what-ships, code artifact, stack and bundle
  badges, a collapsed FAQ, and add-to-cart — and a matching bundle pop-out reads a new shared bundle
  content record (the five standalone bundle pages now render their hero, members, and FAQ from it,
  with the same SEO output). The ui-pro module's pop-out shows a live demo of real premium components.
  Hub bundle cards open the pop-out instead of navigating, both pop-outs are deep-linkable via a query
  param, and the standalone pages stay as spokes linked from inside each pop-out.

  The bundles nav dropdown is now a two-column panel: all six bundles on the left, the marketplace
  pages (hub, modules, build, plans, compare, and the UI Pro showcase) on the right. The cart gains a
  bundle upsell — when the modules in your cart cover most of a bundle's price, it offers the whole
  bundle in one click. The module grid adds text search, a has-a-demo filter, and a compare tray for
  viewing up to three modules side by side.

- 230f02a: Teammates invited to an Org Controls account can now actually reach it: the dashboard has a new
  account switcher for anyone who belongs to more than one account, so an invited seat is no longer
  stuck on their own personal account with no way to find the org they were added to. The Members
  page also gains a self-serve "Remove" control for the account owner — offboarding a departed
  teammate no longer requires contacting support. An owner can never accidentally remove themselves
  or another owner through this control.
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

- fb72fdd: Added the priority-support subscription SKU as a catalog entry, price-agnostic: no dollar amount and no response-time commitment are set yet, so it carries no buy button and no checkout path anywhere on the site. The response-time line reads from a single config value so it can never show two different numbers once the terms are set.
- 6d0a5c5: Research-response site wave: a new evidence-pack page presenting the already-shipped proof artifacts (OSCAL conformance in CI, the standards gate, registry provenance, test suites, WORM live proofs, threat registers) for a security reviewer; a "does it fit my stack?" adapter matrix covering ORM bridges, auth, database posture per module, WORM storage backends, AI providers, and MCP transports; a "prove fit in week one" trial path surfaced on every bundle page and in the module and bundle pop-outs; a founder-transparency block on the homepage (open Apache-2.0 base, public changelog, design partners); a pricing-page terms rework answering "what happens after 12 months?" with support-responsiveness and licensing clarity near checkout; and a quiet design-partner application page.
- 230f02a: Signing out now revokes your session on the server, not just the cookie in your browser, so a
  previously captured session token can no longer be reused after you've signed out. The sign-out
  request is also now checked to make sure it actually came from the site itself, closing off a way
  another website could have forced a visitor's browser to sign out. Separately, the Compliance
  dashboard page and its evidence-record download now correctly require the Compliance core
  entitlement (or an equivalent bundle) — previously any signed-in account could open it regardless
  of purchase status.
- e4e52e2: Both test-side mocks of `lib/auth-server.ts` now spread the real module and override only
  `getAuth`, instead of returning a partial export object. Bun's `mock.module` is process-wide and
  never torn down, so a partial factory gutted `createAuth` and `SESSION_HINT_COOKIE_NAME` for every
  later-loaded test file — `auth-server.test.ts`'s static import then failed with "Export named not
  found" on runners whose file discovery order differs from local (the first main-branch `check`
  failure after the runner migration). Test-only change; no product behavior is affected.
- 2ddcc2d: Make `lib/auth.test.ts` deterministic under any test-file load order. It now declares its own
  `./auth-server.ts` mock so `getAuth()` returns null (the "sign-in runtime unavailable" state it
  asserts), instead of relying on the real `getAuth()` reading unset env. Bun's `mock.module` is
  process-wide and never torn down, so the sibling `auth-account.test.ts` (which mocks the same
  module to a fixed signed-in session) leaked into this file whenever Bun loaded it first, and file
  discovery order is not stable across machines. That surfaced as a `check`-job failure when the CI
  runner changed. Test-only change; no product behavior is affected.
- cebc7f0: The Turnstile challenge widget and dashboard product analytics now actually arm in
  production: their public configuration values are baked into the client bundle at image
  build time (they were previously set on the service but never reached the build, so both
  features silently no-opped). The production route sweep also drops its tolerance for the
  Cloudflare-injected analytics beacon — the zone-level injection is disabled at the source,
  so any beacon reappearing is flagged as a regression.
- 5e9996e: Add the verified multi-tenant build-cost fact to the build-in-house comparison page and extend the
  visual harness to a categorized, prod-capable sweep (pages, emails, interactions) with viewport ×
  theme coverage.
- b9a56df: Marketing copy: a buyer-research ROI frame beside the price (home how-to-buy footnote and the compliance pricing-card footnote) and a reactive "war-room" cost card on the compliance page. Content only, no behavior change.
- 74a82de: Site/copy wave: /compare/delve reworked to the
  own-vs-verify frame with the dated 2026 fabricated-reports allegations (the "often paired"
  recommendation removed) and a sourced ownership-line paragraph added to the Compliance page;
  a new /compare/auditkit page built from the AuditKit parity research (per-record `accessed`
  date override added to the comparison registry); /partners now publishes the locked design-partner
  terms (5 partners, 40% off, 12-month reverting, case-study contingent on conversion); an EU AI
  Act Article 50 set — enforcement-date section on the frameworks page, a standalone
  /frameworks/eu-ai-act/article-50 explainer, and a 36th glossary term — plus stale "Compliance
  edition" vocabulary fixed to bundle; the MCP-server copy reframed from "we have one" to the
  governed-surface story (base-substrate tile, Agentic-Dev lede); and the per-org
  license advantage line landed across the plans FAQ, cart trust note, and the two mid-tier
  bundle FAQs. Private app; no publishable release.
- add7b4c: Marketplace: the retention-runner media slot now shows a bespoke erasure diagram — one
  validated request fanning out to every registered target with per-target error isolation,
  then exactly one reason-tagged audit row — instead of borrowing the audit-worm evidence
  lifecycle. Docs: the `vec0` table name and the guardrails timeout default move into inline
  code so the zero glyph renders unambiguously. The visual harness's login and carousel
  interactions now genuinely exercise the invalid-submit error state and a multi-slide
  carousel.
- 70607f6: Dual-door hero, honest-artifact bento, diagram pair, homepage calculator embed, public affiliates page, Paddle verification readiness copy (refund policy, MoR disclosure, Caisson Software LLC entity, EU VAT-ID field).
- 9e34e86: The EULA gains a vendor-continuity and self-maintenance section: a defined Continuity Event
  (discontinuation, a 12-month unremediated-vulnerability patch lapse, insolvency, or an
  unassumed acquisition) that never diminishes the perpetual license and grants self-help rights —
  self-maintenance on the software as delivered, internal continuity copies, and self-hosting of
  delivery — with U.S. Bankruptcy Code §365(n) licensee protection, prospective-only cure
  semantics, and a new Affiliate definition; Last-updated bumped to 10 July 2026. Docs pages now
  emit full canonical/OG/Twitter metadata like every marketing page. The visual-regression harness
  stubs the session probe on signed-out screenshots so a full sweep no longer trips the auth-route
  rate limit. Private app; no publishable release.
- 7df836a: The Ask-AI grounding probes (insufficient-context sentinel, injection leak-guard, and
  citation-fidelity checks across both answer lanes) now also run in the dedicated `eval`
  task, so the AI-regression lane covers the site's grounded-answer pipeline directly.
- acf3ce0: Login and dashboard pages no longer throw hydration errors caused by edge-injected
  analytics scripts: the web-analytics site is now managed declaratively with auto-injection
  disabled, so the rendered page matches what the server sent. Module pages gain annotated
  walkthroughs of their real source snippets, the agentic-dev page documents the MCP tool
  discovery sequence, and the /ui gallery renders from the shared component demo registry
  instead of a hand-maintained copy.
- 7a52027: Marketplace and hero visual fixes. Marketplace cards no longer clip their kind pill into the neighbouring card when a demo badge is present — the header row splits into a lead cluster (kind + demo) and a right-aligned controls cluster that wraps instead of overflowing. The marketplace hero's blank right half now carries a self-contained, brand-styled diagram of the six bundles composing onto one Apache-2.0 audited base. On the homepage the install column is balanced against the cross-tenant psql terminal with a filled proof panel (fixing a proof chip that stretched full-width), and the honest-artifact code card header reads as a clean file path instead of a long label-plus-path string. The primary-nav disclosure now renders identical markup on the server and client — removing a hydration mismatch — and the immutable static-asset cache is scoped to production so development always serves fresh chunks.
- 6731e06: Marketplace media full-depth: every catalog module's media carousel now carries all applicable slide kinds. Live-component slides are added for the modules that genuinely ship a showable @caisson/ui surface: audit-worm (ChainViewer), ai-meter (UsageChart), prompt-registry (PromptBrowser), and local-store (StoreSearch) render their own embeddable /ui component, and credits renders the buyer-dashboard ledger surface (LedgerList/MetricStat). The component slide leads each carousel, ahead of the existing code-artifact and mechanism-diagram slides. Every slide depicts shipped behaviour under the honest-artifact floor - concept-only modules stay diagram-only, and ui-pro (the 22nd module) stays component-only. Private package only; no publishable release.
- 8db39db: Added a Playwright-based production verification harness: a real browser drives every major
  site route (home, marketplace, pricing, updates, docs, legal pages, sign-in, a sample of module
  pages) and the signed-in buyer dashboard, checking that each page renders cleanly with no
  console errors. It runs on demand against the live site to catch a deploy-time regression before
  a buyer hits it — no product code changed, no runtime behavior change for buyers.
- afd0294: Site catalog and copy remainder: an "open base" tile grid on the marketplace, placed under the
  bundle prices, showing the six batteries-included capabilities of the free Apache-2.0 foundation
  every bundle sits on. Plus a copy sweep that moves every remaining hardcoded price into the pricing
  source of truth (the plans, AI-Production, and modules pages), and corrects a stale base-package
  list — the plans and modules pages described the paid credits module as part of the free base and
  omitted rate limiting; a single shared package list now feeds every surface that names the base.
- a259db3: Trust and copy wave: a qualitative weeks-saved ROI framing and a
  sum-of-parts "why the price looks low" trust note on the plans page, a one-clear-surface
  distinction between what renewal buys (the updates window) and what support is (Discord +
  docs bot, included), perpetual-ownership anti-lock-in foregrounded in the hero proof chips
  and a new EULA continuity-clause deep link on the homepage and plans page, and a new
  theme-aware architecture-fit integration diagram on the homepage showing how the module
  layer lands on a Postgres instance you already run, with offline license verification and
  OTLP observability export.
- 4c8daa9: New /ui component gallery: live, interactive demos of every @caisson/ui-pro component, driven by realistic ops and compliance sample data. Each demo pairs with its ships-in-the-registry framing and an add-to-cart CTA, and the page carries the workspace dependency on the pro kit plus its transpile wiring.
- 47e04fd: Typography: every sans-serif zero now renders as a plain oval — a single-glyph companion
  face (Mona Sans, subset to the one character) sits in front of the body font, whose only
  zero is barred and read ambiguously in prose. Docs: the eleven pages that hedged "this
  reference is still expanding" now carry complete API references documenting each package's
  real exported surface, with two stale auth claims corrected along the way. Marketplace:
  diagram slides drop the duplicated chrome-bar sentence in favor of a short artifact label;
  the carousel caption remains the single visible narration. Compare pages: the two value
  columns no longer squeeze the Detail column to a sliver on phones.
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

- d50a052: Compliance copy wave: PCI DSS and GDPR named alongside SOC 2/HIPAA in the hero
  door claim and the compliance page (true-to-built via the frameworks-pack crosswalks; ISO
  27001 deliberately not claimed), support-included language surfaced at the offer level, a
  one-time cadence marker on the hero price chip, a renewal-justification line on the plans
  renewal card, and marketplace live-component emphasis in the built-in-the-open section.
- Updated dependencies [81223a7]
- Updated dependencies [5d60969]
- Updated dependencies [1bc677a]
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
- Updated dependencies [329150a]
- Updated dependencies [679cce6]
- Updated dependencies [1bc677a]
- Updated dependencies [5a8b317]
- Updated dependencies [0dd715a]
- Updated dependencies [230f02a]
- Updated dependencies [a0aa9a3]
- Updated dependencies [8253e76]
- Updated dependencies [ba04bc1]
- Updated dependencies [2b65cf3]
- Updated dependencies [2b65cf3]
- Updated dependencies [9a81dd7]
- Updated dependencies [2b65cf3]
- Updated dependencies [99d665a]
- Updated dependencies [99d665a]
- Updated dependencies [99d665a]
- Updated dependencies [1bc677a]
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
- Updated dependencies [b5a3690]
- Updated dependencies [b43959c]
- Updated dependencies [4d85f28]
- Updated dependencies [4d85f28]
- Updated dependencies [4c8daa9]
- Updated dependencies [97b0341]
- Updated dependencies [317bad5]
  - @caisson/email@0.4.0
  - @caisson/billing@0.6.0
  - @caisson/platform-migrations@0.2.0
  - @caisson/platform-reads@0.2.0
  - @caisson/ai-meter@1.0.0
  - @caisson/audit-worm@1.0.0
  - @caisson/brand@0.1.2
  - @caisson/ui@0.6.0
  - @caisson/registry-schema@0.5.0
  - @caisson/credits@0.5.0
  - @caisson/service-license@0.0.7
  - @caisson/demo-registry@0.2.0
  - @caisson/pricebook@0.5.1
  - @caisson/kernel@0.4.3
  - @caisson/local-store@1.0.0
  - @caisson/observability@0.3.0
  - @caisson/org-controls@0.3.0
  - @caisson/auth@0.3.2
  - @caisson/migrate@0.2.5
  - @caisson/tenancy-rls@0.5.1
  - @caisson/ui-pro@0.2.0
  - @caisson/prompt-registry@1.0.0
  - @caisson/ai-kit@0.4.1
  - @caisson/field-crypto@0.3.1

## 0.2.0

### Minor Changes

- 9ca1282: Glossary batches 2 and 3: all 32 locked terms are now live (20 new pages across the
  security, licensing, and AI-infrastructure clusters), with curated cross-links backfilled
  on the batch-1 pilot terms and a glossary section added to llms.txt.

### Patch Changes

- 783110d: Transactional emails now render as branded HTML with a plain-text fallback instead of plain text,
  and a new dev-only preview route shows every template with sample data. The buyer sign-in page
  also gains an email-and-password option alongside the existing magic link, with account
  verification and a forgot/reset password flow.
- 783110d: Cleaned up site copy flagged in a visual audit: dashes used as sentence connectors are now
  commas, colons, semicolons, or periods, matching how the rest of the site already reads.
  Rewrote a cluster of module and pricing descriptions that had fallen into the same "it does
  X, not Y" rhythm on every line, so the marketplace, module, and AI Production Kit pages read
  like they were written section by section instead of from one template. Also thinned out a
  few repeated section labels that were adding a small uppercase tag above nearly every block on
  the module and glossary pages, kept where they carry real information, dropped where the
  heading right below already said the same thing.

  No prices, claims, or page structure changed. This is a copy and typography pass only.

- 783110d: Gave the buyer dashboard's post-purchase pages (license, credits, AI keys, compliance,
  members, activity, plan, overview) a visual polish pass. Forms now share one consistent
  label-and-field look across the dashboard, empty and owner-only states read calmly instead
  of as a stray line of text, the compliance page's three frameworks are now visually
  separated instead of running together, the members "add a seat" field explains that
  invite-by-email isn't available yet, and the activity page now says when it's showing
  credit-ledger history instead of per-call usage detail. No data, permissions, or purchase
  flows changed — this is a presentation-only update.
- 783110d: Fixed two glossary page issues found in a visual audit. The "Related terms" links at the
  bottom of each glossary term page now render in the site's accent link color instead of
  plain body text, so they read as clickable. And the "Definition" section no longer repeats
  the term name a second time right under the page title — it was showing the exact same
  heading twice with no new information.
- 783110d: Added a persistent price and purchase bar pinned to the bottom of the screen on mobile for module
  pages. Previously, on a phone the price and "Add to cart" button could end up far down the page,
  past the full feature list and FAQ, before a visitor found them. Now the price and purchase button
  stay visible at every scroll position on small screens, while the full purchase card — with edition
  bundling and related reading — still appears in its usual place further down the page. Desktop
  layouts are unchanged.
- 3a6f5f1: Platform migration 0013 re-creates every platform tenant-isolation policy with an
  empty-string guard on the session GUC read: a pooled connection whose tenant setting was
  reset to an empty string now always denies instead of coincidentally matching rows. The
  platform migration package is also exported for read-only ledger drift audits.
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
- 783110d: Fixed five small display bugs found in a visual audit of the marketing site:

  - The Agent runner module card showed a broken glyph instead of its icon on the modules page.
  - The Alerting module's pricing description had an awkward, hard-to-read sentence.
  - On mobile, three-digit module prices in the stack builder's example (like $199) were cut off to
    two digits (like $19) — a real trust problem on a pricing surface.
  - The glossary's "AI & agent infrastructure" heading rendered with the word gap almost invisible
    on wide screens.
  - The docs sidebar's "Base substrate" section repeated its own name as its only link's label
    instead of a distinct label.

- Updated dependencies [b791198]
- Updated dependencies [b674ed3]
- Updated dependencies [783110d]
- Updated dependencies [dec93f3]
- Updated dependencies [d06a9b8]
- Updated dependencies [defb22e]
- Updated dependencies [0c883ae]
- Updated dependencies [ad02304]
- Updated dependencies [2834c3f]
- Updated dependencies [41e07b6]
- Updated dependencies [4d7eb71]
- Updated dependencies [4d7eb71]
- Updated dependencies [4d7eb71]
- Updated dependencies [783110d]
- Updated dependencies [ad66801]
- Updated dependencies [850b844]
- Updated dependencies [aec9f1c]
- Updated dependencies [783110d]
- Updated dependencies [8ab8ccc]
- Updated dependencies [e784af1]
- Updated dependencies [4d7eb71]
- Updated dependencies [783110d]
- Updated dependencies [850b844]
- Updated dependencies [850b844]
- Updated dependencies [0af4dbf]
- Updated dependencies [0af4dbf]
- Updated dependencies [0af4dbf]
- Updated dependencies [0af4dbf]
- Updated dependencies [783110d]
  - @caisson/ai-kit@0.3.1
  - @caisson/ai-meter@0.3.3
  - @caisson/auth@0.3.0
  - @caisson/billing@0.5.0
  - @caisson/credits@0.4.0
  - @caisson/email@0.3.0
  - @caisson/field-crypto@0.2.4
  - @caisson/kernel@0.4.2
  - @caisson/migrate@0.2.4
  - @caisson/observability@0.2.4
  - @caisson/platform-reads@0.1.5
  - @caisson/pricebook@0.4.0
  - @caisson/tenancy-rls@0.4.0
  - @caisson/ui@0.4.0
  - @caisson/billing-orchestration@0.2.0
  - @caisson/brand@0.1.0
  - @caisson/org-controls@0.2.0
  - @caisson/service-license@0.0.5

## 0.1.3

### Patch Changes

- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
  - @caisson/field-crypto@0.2.3
  - @caisson/kernel@0.4.1
  - @caisson/ai-kit@0.3.0
  - @caisson/tenancy-rls@0.3.2
  - @caisson/service-license@0.0.4
  - @caisson/ai-meter@0.3.2
  - @caisson/auth@0.2.3
  - @caisson/billing@0.4.1
  - @caisson/credits@0.3.2
  - @caisson/email@0.2.3
  - @caisson/migrate@0.2.3
  - @caisson/observability@0.2.3
  - @caisson/pricebook@0.3.2
  - @caisson/platform-reads@0.1.4

## 0.1.2

### Patch Changes

- Updated dependencies [4fc006c]
- Updated dependencies [3a7a4fd]
- Updated dependencies [cc7cb8b]
- Updated dependencies [bd9a005]
- Updated dependencies [fb8d966]
- Updated dependencies [fb8d966]
  - @caisson/service-license@0.0.3
  - @caisson/pricebook@0.3.1
  - @caisson/billing@0.4.0
  - @caisson/ui@0.3.0
  - @caisson/kernel@0.4.0
  - @caisson/platform-reads@0.1.3
  - @caisson/ai-kit@0.2.2
  - @caisson/ai-meter@0.3.1
  - @caisson/auth@0.2.2
  - @caisson/credits@0.3.1
  - @caisson/email@0.2.2
  - @caisson/field-crypto@0.2.2
  - @caisson/migrate@0.2.2
  - @caisson/observability@0.2.2
  - @caisson/tenancy-rls@0.3.1

## 0.1.1

### Patch Changes

- 4287ce5: Legal pages carry the Paddle MoR reseller sentence and refund copy grounded in shipped billing behavior.
- 904b15b: Post-merge consolidation sweep: repo links repointed to caisson-sh/caisson (site footer, JSON-LD, docs edit-links, llms.txt blob URLs), the audit-harness design-ui domain re-globbed from the removed apps/studio to the apps/admin design gallery, and stale SigNoz naming updated to the Grafana Cloud fleet sink (ADR-0177/0207). Docs/comments only apart from the design-ui glob fix; no behavior change to any runtime path.
- Updated dependencies [b5915e0]
- Updated dependencies [5fd31fe]
- Updated dependencies [44a6414]
- Updated dependencies [959e555]
- Updated dependencies [20d5ab0]
- Updated dependencies [e62c88d]
- Updated dependencies [ccf8b10]
- Updated dependencies [afa6070]
- Updated dependencies [081a1d8]
- Updated dependencies [52c6738]
- Updated dependencies [95103b6]
- Updated dependencies [aaff518]
- Updated dependencies [904b15b]
- Updated dependencies [f9d58c4]
- Updated dependencies [549dd4e]
- Updated dependencies [6e08cc6]
  - @caisson/tenancy-rls@0.3.0
  - @caisson/ai-kit@0.2.1
  - @caisson/ai-meter@0.3.0
  - @caisson/billing@0.3.0
  - @caisson/kernel@0.3.0
  - @caisson/credits@0.3.0
  - @caisson/pricebook@0.3.0
  - @caisson/field-crypto@0.2.1
  - @caisson/service-license@0.0.2
  - @caisson/ui@0.2.1
  - @caisson/observability@0.2.1
  - @caisson/auth@0.2.1
  - @caisson/platform-reads@0.1.2
  - @caisson/email@0.2.1
  - @caisson/migrate@0.2.1

## 0.1.0

### Minor Changes

- 16526fa: Site marketplace rework (ADR-0189–0196): split the overloaded `/pricing` into three rooms
  — `/pricing` (editions + bundle), `/modules` (faceted à-la-carte catalog), and `/build`
  (compose-a-stack configurator with an honest upgrade nudge). Fold the four editions behind
  a WAI-ARIA Disclosure in the nav and fix the "Get started" label→destination. Differentiate
  the cart drawer (glance) from the rich `/cart` (review), sharing one line-item + one bundle
  -math function, with the drawer rebuilt on a native `<dialog>` for a real focus contract.
  Single "Add to cart" buy verb sitewide; Martian Mono as the sole monospace; a sitewide ⌘K
  search trigger; module `ItemList` structured data; and flat edition prices (drop the
  misleading "from" prefix — the only purchasable price is exactly the number shown).

### Patch Changes

- 84052aa: Backlog P3 defense-in-depth (all private apps, no publish):

  - `@caisson/site`: `AddMemberInput` gains `.strict()` for boundary-schema floor consistency (behavior
    unchanged — the parse object is hand-built, owner-gated, RLS-scoped, parameterized).
  - `@caisson/local-ai-app` + `@caisson/app-compliance`: the demo field-crypto paths (`demoProvider` /
    `createLegHarness`) now **fail closed under `NODE_ENV=production`** instead of silently using the fixed
    demo key vector. Neither app is a deployed service and both handle only synthetic data, so this never
    fires today (tests run under `NODE_ENV=test`; the compliance leg is golden-deterministic so `fromEnv`
    is deliberately NOT used) — pure defense-in-depth against a future deploy routing real data through.

- Updated dependencies [22077d1]
- Updated dependencies [33bee35]
- Updated dependencies [72ffd85]
- Updated dependencies [59d332f]
- Updated dependencies [57170c5]
- Updated dependencies [6236f59]
- Updated dependencies [69817a1]
- Updated dependencies [5b57c78]
- Updated dependencies [a07feb0]
- Updated dependencies [9483a36]
  - @caisson/auth@0.2.0
  - @caisson/ai-meter@0.2.0
  - @caisson/ai-kit@0.2.0
  - @caisson/billing@0.2.0
  - @caisson/pricebook@0.2.0
  - @caisson/field-crypto@0.2.0
  - @caisson/observability@0.2.0
  - @caisson/platform-reads@0.1.1
  - @caisson/kernel@0.2.0
  - @caisson/credits@0.2.0
  - @caisson/email@0.2.0
  - @caisson/migrate@0.2.0
  - @caisson/tenancy-rls@0.2.0
  - @caisson/ui@0.2.0
  - @caisson/service-license@0.0.1
