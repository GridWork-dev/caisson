# @caisson/platform-migrations

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
