# @caisson/platform-migrations

## 0.3.5

### Patch Changes

- Updated dependencies [ac1a1a4]
- Updated dependencies [1e2f79a]
- Updated dependencies [ac1a1a4]
- Updated dependencies [7e11672]
- Updated dependencies [87b07c6]
- Updated dependencies [7d39669]
- Updated dependencies [498b279]
  - @caisson/service-license@0.1.5
  - @caisson/kernel@0.10.0
  - @caisson/ai-meter@1.1.3
  - @caisson/auth@0.4.5
  - @caisson/billing-orchestration@0.4.2
  - @caisson/credits@0.6.3
  - @caisson/migrate@0.2.14

## 0.3.4

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
  - @caisson/ai-meter@1.1.2
  - @caisson/billing-orchestration@0.4.1
  - @caisson/service-license@0.1.4
  - @caisson/auth@0.4.4
  - @caisson/credits@0.6.2
  - @caisson/migrate@0.2.13

## 0.3.3

### Patch Changes

- @caisson/credits@0.6.1
- @caisson/service-license@0.1.3
- @caisson/ai-meter@1.1.1

## 0.3.2

### Patch Changes

- Updated dependencies [b2c8c24]
- Updated dependencies [e19da1d]
- Updated dependencies [7d74f8f]
- Updated dependencies [f3c62cc]
  - @caisson/billing-orchestration@0.4.0
  - @caisson/ai-meter@1.1.0
  - @caisson/kernel@0.8.0
  - @caisson/credits@0.6.0
  - @caisson/service-license@0.1.2
  - @caisson/auth@0.4.3
  - @caisson/migrate@0.2.12

## 0.3.1

### Patch Changes

- f2cb853: `@caisson/kernel`'s main entry point is now browser-safe. Everything that needs a Node built-in — constant-time secret comparison, audit-chain hashing, migration assembly, and the SSRF guard — moved to a new `@caisson/kernel/node` entry point. The main entry keeps the error model, the strict-schema helpers, canonical serialization and the audit-chain types, the money and version types, the timeout-bounded fetch, and the event sink.

  Server-side code that used one of the moved functions changes a single import path: `@caisson/kernel/node` re-exports the main entry in full, so nothing else in that import list has to move. Nothing changed about what any of these functions do.

  This is what lets packages built on the kernel — the trust-page generator and the artifact renderer among them — be imported directly into a browser bundle. Previously any import of the kernel dragged Node's crypto and DNS modules along with it, and a front end had to keep its own hand-written copy of that logic in step by hand. `@caisson/frameworks-pack` gains a matching `@caisson/frameworks-pack/registry` entry point exposing the control model on its own, for the same reason; its main entry is unchanged.

- 894fc27: Partial refunds now reduce what a purchase counts as paid.

  The amount recorded against a purchase was stamped once and never revisited, so after a partial
  refund an upgrade quote could still credit the full original charge. Refunded amounts are now
  tracked alongside the original charge, and the paid figure an upgrade credit reads is the two
  netted together, floored at zero. The original charge itself is never rewritten, so the record of
  what was billed stays intact.

  Receiving the same refund notification more than once no longer counts it twice. Each refund is
  recorded against the adjustment that caused it, so a repeated delivery is ignored while two
  genuinely separate partial refunds on the same line both apply.

  A purchase whose amount could not be attributed to a single item continues to be treated as
  unknown rather than as zero, and still credits at the full list price.

  Adds one database migration. Existing rows are unaffected until a refund is recorded against them.

- Updated dependencies [e917c52]
- Updated dependencies [f2cb853]
- Updated dependencies [a5f9ea8]
- Updated dependencies [894fc27]
  - @caisson/kernel@0.7.0
  - @caisson/migrate@0.2.11
  - @caisson/billing-orchestration@0.3.6
  - @caisson/service-license@0.1.1
  - @caisson/credits@0.5.11
  - @caisson/ai-meter@1.0.11
  - @caisson/auth@0.4.2

## 0.3.0

### Minor Changes

- 96aa01d: Record what a buyer paid for each entitlement, and use it as the floor on an upgrade credit.

  An upgrade credit is the retail of each owned item the buyer is trading in. That understates the
  credit for anyone who bought before a price cut: they paid more than the item now lists for, and the
  old behaviour credited them the lower number. The credit now takes whichever is greater, the item's
  retail or what the buyer actually paid.

  Paying for that needs the buyer's own price, which was never stored. It has always been on the
  provider event, one charge per line, but only the whole transaction's total was persisted, and a
  total cannot be split across a multi-item cart afterwards. A new nullable column on the entitlement
  grant records the line's charge and currency at grant time.

  The amount is recorded only when the line's charge is genuinely one item's price. A line bought at
  quantity two charges twice for a single entitlement, and a provider that reports no per-line figure
  sends zero. Both leave the column empty, which reads as unknown and credits at retail, rather than
  inventing a per-item split.

  The quote function takes the paid amounts as an argument, so the pricebook stays free of database
  access and the tenant-scoped read stays with the caller. Each one is an amount together with its
  currency, never a bare integer: a charge of 29900 is $299 in one currency and roughly twice that in
  another, and the two cannot be told apart from the number alone. A charge in a currency the catalog
  does not price in credits at retail rather than being converted, because converting it would mean
  inventing an exchange rate.

### Patch Changes

- fe2dfac: Persist each renewal's month tenor and reverse the full stored interval on refund, with legacy rows defaulting to twelve months.
- Updated dependencies [96aa01d]
- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
- Updated dependencies [96aa01d]
- Updated dependencies [fe2dfac]
  - @caisson/service-license@0.1.0
  - @caisson/kernel@0.6.0
  - @caisson/ai-meter@1.0.10
  - @caisson/credits@0.5.10
  - @caisson/auth@0.4.1
  - @caisson/billing-orchestration@0.3.5
  - @caisson/migrate@0.2.10

## 0.2.11

### Patch Changes

- @caisson/credits@0.5.9
- @caisson/service-license@0.0.18
- @caisson/ai-meter@1.0.9

## 0.2.10

### Patch Changes

- c36b9e2: Builds now compile with the native TypeScript 7 compiler. The emitted type declarations are unchanged in API; some inferred type members appear in a different order in .d.ts files. Aggregate compile time drops roughly sevenfold.
- Updated dependencies [c36b9e2]
- Updated dependencies [b8b14b4]
  - @caisson/ai-meter@1.0.8
  - @caisson/auth@0.4.0
  - @caisson/billing-orchestration@0.3.4
  - @caisson/credits@0.5.8
  - @caisson/kernel@0.5.3
  - @caisson/migrate@0.2.9
  - @caisson/service-license@0.0.17

## 0.2.9

### Patch Changes

- @caisson/service-license@0.0.16

## 0.2.8

### Patch Changes

- @caisson/credits@0.5.7
- @caisson/service-license@0.0.15
- @caisson/ai-meter@1.0.7

## 0.2.7

### Patch Changes

- Updated dependencies [fc0bb99]
  - @caisson/kernel@0.5.2
  - @caisson/service-license@0.0.14
  - @caisson/ai-meter@1.0.6
  - @caisson/auth@0.3.5
  - @caisson/billing-orchestration@0.3.3
  - @caisson/credits@0.5.6
  - @caisson/migrate@0.2.8

## 0.2.6

### Patch Changes

- Updated dependencies [7de6fa4]
  - @caisson/kernel@0.5.1
  - @caisson/credits@0.5.5
  - @caisson/service-license@0.0.13
  - @caisson/ai-meter@1.0.5
  - @caisson/auth@0.3.4
  - @caisson/billing-orchestration@0.3.2
  - @caisson/migrate@0.2.7

## 0.2.5

### Patch Changes

- Updated dependencies [9d50e7c]
  - @caisson/ai-meter@1.0.4
  - @caisson/credits@0.5.4
  - @caisson/service-license@0.0.12

## 0.2.4

### Patch Changes

- 12182a5: Renumber the three demo-run site-local migrations 0023-0025 → 0027-0029: the shared
  platform chain had itself grown 0023_order_record_subscription_link…0026_affiliate_code, so the
  demo entries sorted mid-chain, renumbered prod's applied positional ledger, and failed the
  caisson-license predeploy closed on checksum drift (nothing applied). The migrations have never
  been applied anywhere persistent, so the rename is safe. Adds an append-only assembled-ledger
  golden test pinning the merged chain, and updates the claimed-prefix registry note (next free:
  0030).
  - @caisson/service-license@0.0.11

## 0.2.3

### Patch Changes

- @caisson/credits@0.5.3
- @caisson/service-license@0.0.10
- @caisson/ai-meter@1.0.3

## 0.2.2

### Patch Changes

- @caisson/credits@0.5.2
- @caisson/service-license@0.0.9
- @caisson/ai-meter@1.0.2

## 0.2.1

### Patch Changes

- Updated dependencies [a8696cf]
- Updated dependencies [e5e4311]
- Updated dependencies [59e1365]
- Updated dependencies [7e823a9]
- Updated dependencies [e183860]
  - @caisson/auth@0.3.3
  - @caisson/billing-orchestration@0.3.1
  - @caisson/kernel@0.5.0
  - @caisson/service-license@0.0.8
  - @caisson/ai-meter@1.0.1
  - @caisson/credits@0.5.1
  - @caisson/migrate@0.2.6

## 0.2.0

### Minor Changes

- 5d60969: Affiliate program support. Paddle webhook parsing now captures `discount_id` on both
  one-time purchases and subscription invoices, and the order record stamps it via a new
  append-only platform migration. The billing provider port gains an optional
  `createDiscount` method (the Paddle implementation mints percentage discount codes; other
  drivers may omit it), and a new affiliate code registry migration carries per-code program
  parameters (discount percent, commission basis points) stamped at mint time so historical
  rows survive future parameter changes. Platform-reads test harnesses updated for the new
  order-record column.
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

### Patch Changes

- 2b65cf3: Append the order-record subscription-link migration to the shared platform chain: subscription
  order rows now carry their backing subscription id and a coverage-stamped bit, so the refund-time
  horizon rollback targets exactly the refunded subscription (never re-derived by a shareable price
  id) and skips invoices that stamped no coverage.
- Updated dependencies [5d60969]
- Updated dependencies [1bc677a]
- Updated dependencies [a79acb4]
- Updated dependencies [2b65cf3]
- Updated dependencies [230f02a]
- Updated dependencies [11cb4c3]
- Updated dependencies [a79acb4]
- Updated dependencies [4036574]
- Updated dependencies [2b65cf3]
- Updated dependencies [2b65cf3]
- Updated dependencies [a931095]
- Updated dependencies [a931095]
- Updated dependencies [b3c5b0b]
- Updated dependencies [d5cef92]
- Updated dependencies [d9154da]
- Updated dependencies [8253e76]
- Updated dependencies [99d665a]
- Updated dependencies [4c141b0]
- Updated dependencies [a79acb4]
- Updated dependencies [317bad5]
  - @caisson/billing-orchestration@0.3.0
  - @caisson/ai-meter@1.0.0
  - @caisson/credits@0.5.0
  - @caisson/service-license@0.0.7
  - @caisson/kernel@0.4.3
  - @caisson/auth@0.3.2
  - @caisson/migrate@0.2.5
