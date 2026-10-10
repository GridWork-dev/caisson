# @caisson-sh/billing

## 0.6.10

### Patch Changes

- 73bdf3c: Package descriptions, READMEs and agent notes now describe what each package does, with no prices, paid tiers or license-key requirements. The standards gate fails when a published package's description or README mentions a commercial tier or a dollar price.
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

## 0.6.9

### Patch Changes

- Updated dependencies [87b07c6]
- Updated dependencies [7d39669]
- Updated dependencies [498b279]
  - @caisson/kernel@0.10.0

## 0.6.8

### Patch Changes

- 2405d9e: Remove unused dependencies and unreferenced internal helpers, relocate integration coverage to the package seams it verifies, and consolidate repeated build and test plumbing. The CLI no longer exports the obsolete minimal `defaultEngine`; use `templatesEngine` or inject a `GeneratorEngine`.
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

## 0.6.7

### Patch Changes

- Updated dependencies [7d74f8f]
  - @caisson/kernel@0.8.0

## 0.6.6

### Patch Changes

- f2cb853: `@caisson/kernel`'s main entry point is now browser-safe. Everything that needs a Node built-in — constant-time secret comparison, audit-chain hashing, migration assembly, and the SSRF guard — moved to a new `@caisson/kernel/node` entry point. The main entry keeps the error model, the strict-schema helpers, canonical serialization and the audit-chain types, the money and version types, the timeout-bounded fetch, and the event sink.

  Server-side code that used one of the moved functions changes a single import path: `@caisson/kernel/node` re-exports the main entry in full, so nothing else in that import list has to move. Nothing changed about what any of these functions do.

  This is what lets packages built on the kernel — the trust-page generator and the artifact renderer among them — be imported directly into a browser bundle. Previously any import of the kernel dragged Node's crypto and DNS modules along with it, and a front end had to keep its own hand-written copy of that logic in step by hand. `@caisson/frameworks-pack` gains a matching `@caisson/frameworks-pack/registry` entry point exposing the control model on its own, for the same reason; its main entry is unchanged.

- Updated dependencies [e917c52]
- Updated dependencies [f2cb853]
  - @caisson/kernel@0.7.0

## 0.6.5

### Patch Changes

- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
  - @caisson/kernel@0.6.0

## 0.6.4

### Patch Changes

- c36b9e2: Builds now compile with the native TypeScript 7 compiler. The emitted type declarations are unchanged in API; some inferred type members appear in a different order in .d.ts files. Aggregate compile time drops roughly sevenfold.
- Updated dependencies [c36b9e2]
  - @caisson/kernel@0.5.3

## 0.6.3

### Patch Changes

- Updated dependencies [fc0bb99]
  - @caisson/kernel@0.5.2

## 0.6.2

### Patch Changes

- Updated dependencies [7de6fa4]
  - @caisson/kernel@0.5.1

## 0.6.1

### Patch Changes

- Updated dependencies [e5e4311]
- Updated dependencies [e183860]
  - @caisson/kernel@0.5.0

## 0.6.0

### Minor Changes

- 5d60969: Affiliate program support. Paddle webhook parsing now captures `discount_id` on both
  one-time purchases and subscription invoices, and the order record stamps it via a new
  append-only platform migration. The billing provider port gains an optional
  `createDiscount` method (the Paddle implementation mints percentage discount codes; other
  drivers may omit it), and a new affiliate code registry migration carries per-code program
  parameters (discount percent, commission basis points) stamped at mint time so historical
  rows survive future parameter changes. Platform-reads test harnesses updated for the new
  order-record column.
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

## 0.5.0

### Minor Changes

- d06a9b8: The billing-orchestration carve: `@caisson/billing` narrows to the OPEN seam — raw-body HMAC webhook signature verification for all four providers (Stripe/Paddle/LemonSqueezy/Polar, the LemonSqueezy/Polar verifiers extracted into their own open verify-only files), the `BillingProvider` port + every provider's config TYPE, and the `DomainBillingEvent` schema — so apps/base's free-floor demo typechecks against open code only. The `@caisson/tenancy-rls` dependency drops (its only consumer, `idempotency.ts`, moved). New commercial `@caisson/billing-orchestration` ($99, priceCents 9900, tier `paid`, `LicenseRef-Caisson-Commercial`) holds the checkout-driver factories (`createStripeBilling`/`createPaddleBilling`/`createLemonSqueezyBilling`/`createPolarBilling`), the provider→`DomainBillingEvent` parsers (`parseStripeEvent`/`parsePaddleEvent`/`parseLemonSqueezyEvent`/`parsePolarEvent` + their envelope schemas), and the dual-layer webhook idempotency (`processEvent`/`withIdempotentSideEffect`/`PROCESSED_EVENT_SCHEMA_SQL`); deps kernel + tenancy-rls + billing (commercial→open).

### Patch Changes

- b791198: Documentation and metadata cleanup plus dependency-declaration hygiene: package descriptions, READMEs, changelogs, and source comments no longer carry internal build references, and shared external dependency ranges now resolve through the workspace dependency catalog (published dependency ranges unchanged; the TypeScript devDependency floor moves to ^5.7.3).
- b674ed3: Webhook envelope validation now accepts real provider deliveries. The Paddle and Stripe
  envelope schemas rejected any notification carrying fields beyond the minimal set the
  mapper reads (a real Paddle delivery always includes `occurred_at` and `notification_id`;
  a real Stripe event includes `api_version`, `created`, and more), which surfaced as a 400
  on every live webhook. Envelopes are now validated on the fields the mapper consumes and
  tolerate documented provider-additive fields; signature verification is unchanged.
- 0af4dbf: Rewrote README, AGENTS, CHANGELOG, package.json descriptions, and inline source comments to
  read as clean, buyer-facing documentation. Removed sibling-repository provenance framing,
  internal build-phase shorthand, and bare specification-id citations that had leaked into
  shipped copy. No runtime behavior changed in any package — documentation and comments only.
- Updated dependencies [b791198]
- Updated dependencies [0af4dbf]
  - @caisson/kernel@0.4.2

## 0.4.1

### Patch Changes

- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
  - @caisson/kernel@0.4.1
  - @caisson/tenancy-rls@0.3.2

## 0.4.0

### Minor Changes

- fb8d966: Dual-layer billing-webhook idempotency. New exports:
  `PROCESSED_EVENT_SCHEMA_SQL` (a `billing_processed_event` claim table — tenant-owned FORCE-RLS,
  non-blank account guard, shipped as a new checksum-pinned platform migration string, never an edit to
  a shipped one); `processEvent(tx, sourceEventId, fn)` (OUTER layer — claim the whole event once via
  `INSERT ... ON CONFLICT DO NOTHING RETURNING`, so a re-delivery skips the grant AND leaves no granted
  entitlements to trigger the post-commit Discord push, so a re-delivered event cannot re-fire it); and
  `withIdempotentSideEffect(tx, sourceEventId, sideEffect, fn)` (PER-SIDE-EFFECT layer). Both run inside
  the caller's `withTenant` tx so the claim commits atomically with the grant. The credit ledger stays
  the idempotent inner backstop; adds `@caisson/tenancy-rls` as a dependency.

### Patch Changes

- cc7cb8b: Live-verification harness: self-skipping `live/` proofs for the
  five production-wired external seams, run after a launch key rotation to prove the rotated
  credentials work end-to-end. Test files + `test:live` scripts only — no product code changed.

  billing carries seam 1's `live/paddle-webhook.live.test.ts` (a webhook simulator plus Playwright legs
  against the real Paddle surface); the other four seams live under `services/*` and `apps/*`
  (exempt) plus the support-bot pytest `live` marker. No runtime behavior change for buyers.

- Updated dependencies [fb8d966]
  - @caisson/kernel@0.4.0
  - @caisson/tenancy-rls@0.3.1

## 0.3.0

### Minor Changes

- aaff518: Paddle per-line partial refund — per-line entitlement revoke + per-line credit clawback (ADR-0218,
  supersedes the ADR-0113 full-refund-only clause). Refunding ONE line of a multi-item Paddle cart is
  no longer a full no-op.

  `@caisson/billing`: the shared `DomainBillingEvent` gains provider-agnostic per-line refund shape
  (fork D-2 shape / D-1 population). `purchase.completed.lineItems[]` carries each line's `itemId`
  (Paddle `txnitm_…` join key from `details.line_items[].id`) + `chargedAmount` (the proportional-
  refund divisor); `refund.completed` gains `adjustmentId` (the per-line clawback idempotency anchor)
  and an `items[]` per-line array. The Paddle mapper populates them (correlates `items[]` with
  `details.line_items[]` by order; parses a partial adjustment's `data.items[]`, skipping Paddle-
  generated `tax`/`proration` items); Stripe/Polar/LemonSqueezy one-entry-wrap with empty sentinels
  (no real per-line refund data).

  `@caisson/credits`: `grant` accepts a per-line `lineItemId` + `lineChargedAmount`; `clawback`
  accepts a per-line `lineItemId` + rounding provenance; new `lineCreditLedger` reads a line's
  granted/clawed/charged totals so a per-line refund never over-claws past that line's grant onto
  other lines' fungible balance. New `CREDIT_LINE_ITEM_MIGRATION_SQL` adds the nullable
  `line_item_id` / `line_charged_amount` columns (fork C-b) and folds `COALESCE(line_item_id, '')`
  into `credit_event_source_uniq` so a multi-item cart's N per-line `purchase` rows stay distinct
  (integer money + round-down provenance per ADR-0007/0212).

### Patch Changes

- 20d5ab0: Stripe webhook envelope hardening (ADR-0210): `provider.ts`'s Stripe driver used to trust
  the raw webhook body via a bare `JSON.parse(rawBody) as StripeEvent` cast — a type-level
  assertion with no runtime shape check. Signature verification already ran first, but a
  validly-signed, malformed-envelope delivery (missing/wrong-typed `id`, or an unexpected
  top-level field) flowed straight into the mapper. `StripeEventSchema` (`strictObject`,
  mirroring `PaddleEventSchema`) is now wired into `verifyAndParse` via `parseStrict`, closing
  the gap Paddle/LemonSqueezy/Polar already closed — all four `BillingProvider` drivers now
  parse through a strict envelope schema before their mapper runs. `data.object` stays a loose
  `Record<string, unknown>` (the existing `read*` helpers are the defensive layer for it,
  unchanged). No change to `verifyAndParse`'s call order, the `BillingProvider` port shape, or
  Stripe driver activation state (ADR-0200: still dormant). New export: `StripeEventSchema`.
- 95103b6: Money-path hardening. `parsePaddleEvent` now correlates
  `items[]` to `details.line_items[]` by their shared `price_id` instead of array position, and fails
  closed on a duplicate non-empty per-line join id; a malformed adjustment item now signals through an
  optional `onWarn` callback, threaded all the way from `PaddleConfig` through `verifyAndParse` and
  wired to `services/license`'s stderr telemetry, instead of a silent skip. `@caisson/credits` gains
  `creditsClawedForSource`, which `services/license`'s `applyBillingEvent` uses to bound BOTH a
  whole-transaction `type:full` refund claw AND a per-line partial claw to the purchase's
  granted-minus-already-clawed remainder regardless of delivery order, never spilling onto another
  purchase's credits. `@caisson/tenancy-rls` gains `buildAdminSelectPolicySql`, a SELECT-only
  cross-tenant policy variant; `services/license`'s admin mutation surface now uses it (rather than the
  write variant) for its read-only `account_member` existence check, and (`grantEntitlementAdmin` /
  `adjustCreditsAdmin`) fails closed with a 404 on a nonexistent target account, rolling back the whole
  transaction before any entitlement or credit row commits.
- 549dd4e: Security hardening pass. kernel: new shared SSRF guard (`ssrf.ts`) — literal denylist + async DNS resolve-recheck of every resolved IP, defending against DNS rebinding. alerting + ai-kit: dedupe onto the kernel guard and resolve-recheck at the outbound-fetch seam (alerting per fetch; ai-kit via an injected guarded `fetch` for custom provider baseUrls). billing: `purchase.completed` carries `lineItems: {priceId, quantity}[]` so a multi-item cart fulfills every paid line, not just the first, plus a `subscription_update` regression test guarding against a proration event being credited as a full purchase.
- Updated dependencies [e62c88d]
- Updated dependencies [ccf8b10]
- Updated dependencies [549dd4e]
  - @caisson/kernel@0.3.0

## 0.2.0

### Minor Changes

- 9483a36: Initial public release (0.1.0) — publish-readiness flip (ADR-0111). The open Base substrate (Apache-2.0, tier `oss`) publishes to public npm; the commercial editions/primitives/generator (tier `paid`) publish to GitHub Packages restricted. Versions were aligned to 0.1.0 in lockstep with the registry ledger; this changeset records the 0.1.0 release and seeds the changeset-presence gate (ADR-0021).

### Patch Changes

- 72ffd85: Whole-repo audit remediation (rounds 1+2, ledger 2026-07-01): LemonSqueezy credit-grant idempotency keys off the stable resource composite (never webhook_id); BYOK zero-cost gated to a per-action allowlist, default metered (ADR-0198); AWS KMS driver honors per-tenant CMKs and refuses keyId-less crypto-shred (ADR-0197); BYOK baseUrl SSRF guard (https-only, private/metadata ranges rejected); request-span low-cardinality span names + scrubbed http.route; field-crypto-policy evidence collector emits sorted arrays (deterministic canonical body); entitlements free-view docstring corrected to ADR-0136.
- 5b57c78: Fold in the 2026-07-01 Paddle-docs adversarial verification (all claims checked against
  developer.paddle.com): the signature timestamp tolerance now matches Paddle's documented SDK default
  of 5 seconds (was Stripe's 300s, a silent 5-minute replay envelope); transaction `origin` maps
  correctly — `web`/`api` = the subscription's first charge → `subscription_create`,
  `subscription_recurring` → `subscription_cycle`, and `subscription_charge` (a MID-CYCLE one-time
  charge, not the first charge) is now non-granting, closing an over-grant of a full cycle allotment;
  the cycle idempotency anchor is the transaction id (Paddle documents `invoice_id` as deprecated and
  scheduled for removal).
- Updated dependencies [69817a1]
- Updated dependencies [9483a36]
  - @caisson/kernel@0.2.0
