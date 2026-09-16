# @caisson/billing-orchestration

## 0.4.2

### Patch Changes

- Updated dependencies [498b279]
- Updated dependencies [87b07c6]
- Updated dependencies [7d39669]
- Updated dependencies [498b279]
  - @caisson/tenancy-rls@0.6.1
  - @caisson/kernel@0.10.0
  - @caisson/billing@0.6.9

## 0.4.1

### Patch Changes

- 2609293: Consolidation wave one: the eighteen refutation-verified cuts from the August consolidation audit.

  New public API: `@caisson/kernel` gains the narrow `./crypto` subpath (node:crypto-only graph,
  so a Cloudflare Worker can import the timing-safe compare without the wide `./node` barrel's
  `node:dns` reach), and `@caisson/tenancy-rls` exports `createPgTransactor(pool)` — the canonical
  node-postgres BEGIN/COMMIT/best-effort-ROLLBACK/release adapter previously copy-pasted across the
  site, admin, the license deploy entry, the CLI, and the generated Next starter (which also gains
  the best-effort rollback it lacked). Everything else is deletion or internal consolidation with
  behavior pinned by tests: dead marketplace/build residue and dead nav derivation out of the site,
  the unused account-entitlement resolver and 111 unreachable barrel exports out of the license
  service, the orphan EU AI Act manifest out of compliance (it was being packed while unreachable),
  an unused trust-page devDependency, shared task-registry lookup across the five jobs drivers,
  shared exact byte-identical parser readers in billing-orchestration, the kernel browser-graph
  walker folded onto the shared testing module-graph, the intel OpenRouter transport shared between
  enrichment and its eval judge, license scheduler test fixtures consolidated, the dependency graph
  guard moved into standards-gate ownership (its test now runs in the package suite), the Better
  Stack adapter's unauthenticated dev bypass deleted and its secret compare folded onto the kernel
  primitive, and one boundary-policy data source feeding ESLint, dependency-cruiser, and the
  standards gate — closing a drifted cruiser hand-copy that had silently stopped guarding the five
  current bundle roots.

- 87275f6: Replace ESLint and Prettier with oxlint and oxfmt.

  Linting and formatting now run on the oxc toolchain. The rule floor is unchanged: the same
  no-any, no-console, type-only-import and provider-SDK-boundary rules are enforced, at the same
  severities, and formatting keeps the settings the previous formatter used. Every package here is
  touched by the dependency removal or by the one-pass reformat, so each takes a patch bump; no
  runtime behaviour changes.

  For anyone consuming the shared configuration: the lint config package is renamed, and the lint
  and format commands changed.

- Updated dependencies [f669d4a]
- Updated dependencies [2405d9e]
- Updated dependencies [b0e66b6]
- Updated dependencies [2609293]
- Updated dependencies [87275f6]
  - @caisson/kernel@0.9.0
  - @caisson/billing@0.6.8
  - @caisson/tenancy-rls@0.6.0

## 0.4.0

### Minor Changes

- b2c8c24: Billing orchestration gains a browser-safe `./browser` entry point carrying the pure claim-key half
  of the webhook idempotency layer: the fail-closed source event id guard and the per-effect composite
  key derivation, which now live in their own module with no database or Node dependencies. The claim
  itself is unchanged and stays on the main entry, since it runs as an insert inside your tenant
  transaction. Both guards are also exported from the main entry, which keeps the complete surface, and
  `processEvent` and `withIdempotentSideEffect` delegate to them, so the key rules have exactly one
  implementation and every thrown message is what it always was. The site's billing-orchestration
  interactive demo now runs those shipped guards instead of a hand-maintained copy.

### Patch Changes

- Updated dependencies [7d74f8f]
  - @caisson/kernel@0.8.0
  - @caisson/billing@0.6.7
  - @caisson/tenancy-rls@0.5.8

## 0.3.6

### Patch Changes

- a5f9ea8: The figure behind an upgrade credit can now be read net of refunds: a partial refund is subtracted from what the buyer was charged, a charge in another currency can no longer outrank a dollar one on its raw number alone, and the read is checked against the licensing service's own arithmetic so the two cannot drift apart. What buyers are credited today is unchanged.

  A refund notice that names the same purchased line twice is now rejected outright instead of being partly applied. Only the first mention was ever recorded, which quietly left the buyer holding more credit than their refund had left them; the provider is now asked to send the notice again rather than have it half-recorded.

- Updated dependencies [e917c52]
- Updated dependencies [f2cb853]
  - @caisson/kernel@0.7.0
  - @caisson/billing@0.6.6
  - @caisson/tenancy-rls@0.5.7

## 0.3.5

### Patch Changes

- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
  - @caisson/kernel@0.6.0
  - @caisson/billing@0.6.5
  - @caisson/tenancy-rls@0.5.6

## 0.3.4

### Patch Changes

- c36b9e2: Builds now compile with the native TypeScript 7 compiler. The emitted type declarations are unchanged in API; some inferred type members appear in a different order in .d.ts files. Aggregate compile time drops roughly sevenfold.
- Updated dependencies [c36b9e2]
  - @caisson/billing@0.6.4
  - @caisson/kernel@0.5.3
  - @caisson/tenancy-rls@0.5.5

## 0.3.3

### Patch Changes

- Updated dependencies [fc0bb99]
  - @caisson/kernel@0.5.2
  - @caisson/billing@0.6.3
  - @caisson/tenancy-rls@0.5.4

## 0.3.2

### Patch Changes

- Updated dependencies [7de6fa4]
  - @caisson/kernel@0.5.1
  - @caisson/billing@0.6.2
  - @caisson/tenancy-rls@0.5.3

## 0.3.1

### Patch Changes

- a8696cf: Remove redundant assignments and retain original errors when wrapping failures under the ESLint 10 recommended rules.
- Updated dependencies [e5e4311]
- Updated dependencies [e183860]
  - @caisson/kernel@0.5.0
  - @caisson/billing@0.6.1
  - @caisson/tenancy-rls@0.5.2

## 0.3.0

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

- a79acb4: Test-only: pin that Paddle dunning/past-due event types (`transaction.payment_failed`,
  `subscription.past_due`, `subscription.paused`, `subscription.resumed`) parse to a safe no-op
  today, so a future change to the event-type switch is a deliberate decision rather than an
  accidental drop. No behavior change; the released artifact is byte-identical (tests are excluded
  from the tarball).
- 2b65cf3: Fix the Paddle simulator live proof for an upstream API drift: a notification setting must now
  opt in with `traffic_source: "simulation"`, or simulation runs abort against it with
  "Notification setting cannot be used for 'simulation' traffic". Live-test-only change — no
  runtime code path is affected.
- Updated dependencies [5d60969]
- Updated dependencies [2b65cf3]
- Updated dependencies [d5cef92]
- Updated dependencies [8253e76]
  - @caisson/billing@0.6.0
  - @caisson/kernel@0.4.3
  - @caisson/tenancy-rls@0.5.1

## 0.2.1

### Patch Changes

- Updated dependencies [8c53ca3]
- Updated dependencies
  - @caisson/tenancy-rls@0.5.0

## 0.2.0

### Minor Changes

- d06a9b8: The billing-orchestration carve: `@caisson/billing` narrows to the OPEN seam — raw-body HMAC webhook signature verification for all four providers (Stripe/Paddle/LemonSqueezy/Polar, the LemonSqueezy/Polar verifiers extracted into their own open verify-only files), the `BillingProvider` port + every provider's config TYPE, and the `DomainBillingEvent` schema — so apps/base's free-floor demo typechecks against open code only. The `@caisson/tenancy-rls` dependency drops (its only consumer, `idempotency.ts`, moved). New commercial `@caisson/billing-orchestration` ($99, priceCents 9900, tier `paid`, `LicenseRef-Caisson-Commercial`) holds the checkout-driver factories (`createStripeBilling`/`createPaddleBilling`/`createLemonSqueezyBilling`/`createPolarBilling`), the provider→`DomainBillingEvent` parsers (`parseStripeEvent`/`parsePaddleEvent`/`parseLemonSqueezyEvent`/`parsePolarEvent` + their envelope schemas), and the dual-layer webhook idempotency (`processEvent`/`withIdempotentSideEffect`/`PROCESSED_EVENT_SCHEMA_SQL`); deps kernel + tenancy-rls + billing (commercial→open).

### Patch Changes

- Updated dependencies [b791198]
- Updated dependencies [b674ed3]
- Updated dependencies [d06a9b8]
- Updated dependencies [0c883ae]
- Updated dependencies [0af4dbf]
  - @caisson/billing@0.5.0
  - @caisson/kernel@0.4.2
  - @caisson/tenancy-rls@0.4.0
