# @caisson/service-license

## 0.1.5

### Patch Changes

- ac1a1a4: The registry index digest on the license service's and the operator control-plane's health endpoints no longer depends on the edge origin-secret header. That header proves the request arrived through the front-door edge layer, not who is asking, and the edge layer injects it into every request that goes through it — so every ordinary public caller was already getting the field, and only a caller reaching the raw platform origin directly saw a bare status. The digest itself is a hash of a file the module registry already serves publicly, so there was nothing left for the header to protect. Both endpoints now return the digest and entry count to every caller whenever the underlying index file is present and readable; an unreadable or missing file is still the only reason the fields are omitted.
- 1e2f79a: Health probe paths now answer ahead of the edge origin gate. The platform healthcheck reaches each container internally and cannot carry the edge-injected origin-secret header, so arming the gate as the first check made every one of the four gated services fail its own readiness probe and froze the whole deploy path. The exemption is keyed on exact string equality against each service's configured `healthcheckPath`, never a prefix, so a trailing slash, a longer path, a differing case and a traversal segment all stay behind the gate; a per-service test pins the constant against the deployment manifest so a drift in either cannot silently re-freeze deploys.

  Because the probe path is now reachable without the secret, the responses shrink to liveness for unauthenticated callers. The docs service withholds its corpus chunk count, and the license service and the operator control-plane withhold their registry index digest and entry count, unless the caller presents a valid origin secret. Traffic arriving through the edge carries that header, so the registry index parity probe keeps reading the digest from both services; only a caller reaching a raw platform origin directly is reduced to a bare status.

- ac1a1a4: Drop the package description's reference to `resolveAccountEntitlements`, a function that no
  longer exists in this package.
- 7e11672: Upgrade runtime OS layers on pinned bases and gate fixable HIGH/CRITICAL runtime OS findings while reporting application and raw-base residuals.
- 7d39669: Report the serving revision on every deployed service.

  Each service now answers with an `x-caisson-revision` response header naming the commit its
  running image was built from, so "which code is actually live" is one request instead of an
  inference from how a route behaves.

  The kernel gains `servingRevision()` and the constants behind it on the `@caisson/kernel/node`
  entry. It reads a `.caisson-revision` carrier written into the uploaded tree at deploy time; a
  build that did not come through that path reports `unknown` rather than guessing.

  The header is deliberately not gated behind origin verification: it has to stay readable exactly
  when that gate is the thing misbehaving, which is the case it exists to diagnose.

- Updated dependencies [e211684]
- Updated dependencies [045b21e]
- Updated dependencies [7d39669]
- Updated dependencies [498b279]
- Updated dependencies [cd694f1]
- Updated dependencies [87b07c6]
- Updated dependencies [9cb7681]
- Updated dependencies [7d39669]
- Updated dependencies [69b3ba3]
- Updated dependencies [498b279]
  - @caisson/email@0.5.8
  - @caisson/audit-worm@2.2.4
  - @caisson/license-verify@0.3.10
  - @caisson/tenancy-rls@0.6.1
  - @caisson/registry-schema@0.5.12
  - @caisson/observability@0.3.9
  - @caisson/kernel@0.10.0
  - @caisson/alerting@0.3.2
  - @caisson/platform-reads@0.3.1
  - @caisson/license-issue@1.0.9
  - @caisson/billing-orchestration@0.4.2
  - @caisson/credits@0.6.3
  - @caisson/jobs@0.7.4
  - @caisson/org-controls@0.4.2
  - @caisson/rate-limit@0.2.1
  - @caisson/pricebook@0.8.5
  - @caisson/billing@0.6.9

## 0.1.4

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
- Updated dependencies [8993cf7]
- Updated dependencies [886e1e7]
- Updated dependencies [1964e9d]
- Updated dependencies [87275f6]
- Updated dependencies [2405d9e]
- Updated dependencies [c10e3b6]
- Updated dependencies [b0e66b6]
  - @caisson/kernel@0.9.0
  - @caisson/billing@0.6.8
  - @caisson/jobs@0.7.3
  - @caisson/license-issue@1.0.8
  - @caisson/pricebook@0.8.4
  - @caisson/tenancy-rls@0.6.0
  - @caisson/billing-orchestration@0.4.1
  - @caisson/registry-schema@0.5.11
  - @caisson/alerting@0.3.1
  - @caisson/audit-worm@2.2.3
  - @caisson/credits@0.6.2
  - @caisson/email@0.5.7
  - @caisson/license-verify@0.3.9
  - @caisson/observability@0.3.8
  - @caisson/org-controls@0.4.1
  - @caisson/platform-reads@0.3.0
  - @caisson/rate-limit@0.2.0

## 0.1.3

### Patch Changes

- Updated dependencies
  - @caisson/registry-schema@0.5.10
  - @caisson/credits@0.6.1
  - @caisson/license-issue@1.0.7
  - @caisson/pricebook@0.8.3

## 0.1.2

### Patch Changes

- Updated dependencies [98bf1f3]
- Updated dependencies [49f26a4]
- Updated dependencies [b2c8c24]
- Updated dependencies [dff76d9]
- Updated dependencies [7d74f8f]
- Updated dependencies [f3c62cc]
- Updated dependencies [742c979]
  - @caisson/observability@0.3.7
  - @caisson/alerting@0.3.0
  - @caisson/billing-orchestration@0.4.0
  - @caisson/org-controls@0.4.0
  - @caisson/kernel@0.8.0
  - @caisson/credits@0.6.0
  - @caisson/jobs@0.7.2
  - @caisson/audit-worm@2.2.2
  - @caisson/license-issue@1.0.7
  - @caisson/billing@0.6.7
  - @caisson/email@0.5.6
  - @caisson/license-verify@0.3.8
  - @caisson/pricebook@0.8.2
  - @caisson/rate-limit@0.1.10
  - @caisson/registry-schema@0.5.9
  - @caisson/tenancy-rls@0.5.8

## 0.1.1

### Patch Changes

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
- Updated dependencies [e917c52]
- Updated dependencies [e917c52]
- Updated dependencies [f2cb853]
- Updated dependencies [a5f9ea8]
  - @caisson/registry-schema@0.5.9
  - @caisson/kernel@0.7.0
  - @caisson/jobs@0.7.1
  - @caisson/alerting@0.2.6
  - @caisson/audit-worm@2.2.1
  - @caisson/billing@0.6.6
  - @caisson/billing-orchestration@0.3.6
  - @caisson/credits@0.5.11
  - @caisson/license-issue@1.0.6
  - @caisson/pricebook@0.8.1
  - @caisson/email@0.5.5
  - @caisson/license-verify@0.3.7
  - @caisson/observability@0.3.6
  - @caisson/org-controls@0.3.6
  - @caisson/rate-limit@0.1.9
  - @caisson/tenancy-rls@0.5.7

## 0.1.0

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
- Updated dependencies [31bf5f1]
- Updated dependencies [25fd03c]
- Updated dependencies [108a358]
- Updated dependencies [a00a9ef]
- Updated dependencies [6d1c805]
- Updated dependencies [6d1c805]
- Updated dependencies [96aa01d]
- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
- Updated dependencies [96aa01d]
- Updated dependencies [a21c478]
- Updated dependencies [96aa01d]
- Updated dependencies [108a358]
- Updated dependencies [fe2dfac]
  - @caisson/audit-worm@2.2.0
  - @caisson/registry-schema@0.5.8
  - @caisson/pricebook@0.8.0
  - @caisson/observability@0.3.5
  - @caisson/email@0.5.4
  - @caisson/kernel@0.6.0
  - @caisson/jobs@0.7.0
  - @caisson/rate-limit@0.1.8
  - @caisson/alerting@0.2.5
  - @caisson/license-issue@1.0.5
  - @caisson/credits@0.5.10
  - @caisson/billing@0.6.5
  - @caisson/billing-orchestration@0.3.5
  - @caisson/license-verify@0.3.6
  - @caisson/org-controls@0.3.5
  - @caisson/tenancy-rls@0.5.6

## 0.0.18

### Patch Changes

- Updated dependencies [31d59fd]
  - @caisson/registry-schema@0.5.7
  - @caisson/credits@0.5.9
  - @caisson/license-issue@1.0.4
  - @caisson/pricebook@0.7.2

## 0.0.17

### Patch Changes

- Updated dependencies [bd071c9]
- Updated dependencies [c36b9e2]
  - @caisson/audit-worm@2.1.4
  - @caisson/alerting@0.2.4
  - @caisson/billing-orchestration@0.3.4
  - @caisson/billing@0.6.4
  - @caisson/credits@0.5.8
  - @caisson/email@0.5.3
  - @caisson/jobs@0.6.3
  - @caisson/kernel@0.5.3
  - @caisson/license-issue@1.0.4
  - @caisson/license-verify@0.3.5
  - @caisson/observability@0.3.4
  - @caisson/org-controls@0.3.4
  - @caisson/pricebook@0.7.1
  - @caisson/rate-limit@0.1.7
  - @caisson/registry-schema@0.5.6
  - @caisson/tenancy-rls@0.5.5

## 0.0.16

### Patch Changes

- Updated dependencies [2bda239]
  - @caisson/pricebook@0.7.0

## 0.0.15

### Patch Changes

- Updated dependencies [2229209]
  - @caisson/registry-schema@0.5.5
  - @caisson/credits@0.5.7
  - @caisson/license-issue@1.0.3
  - @caisson/pricebook@0.6.1

## 0.0.14

### Patch Changes

- Updated dependencies [6f0af8a]
- Updated dependencies [fc0bb99]
  - @caisson/pricebook@0.6.0
  - @caisson/kernel@0.5.2
  - @caisson/alerting@0.2.3
  - @caisson/audit-worm@2.1.3
  - @caisson/billing@0.6.3
  - @caisson/billing-orchestration@0.3.3
  - @caisson/credits@0.5.6
  - @caisson/email@0.5.2
  - @caisson/jobs@0.6.2
  - @caisson/license-issue@1.0.3
  - @caisson/license-verify@0.3.4
  - @caisson/observability@0.3.3
  - @caisson/org-controls@0.3.3
  - @caisson/rate-limit@0.1.6
  - @caisson/tenancy-rls@0.5.4

## 0.0.13

### Patch Changes

- Updated dependencies [5d03808]
- Updated dependencies [7de6fa4]
  - @caisson/registry-schema@0.5.4
  - @caisson/kernel@0.5.1
  - @caisson/credits@0.5.5
  - @caisson/license-issue@1.0.2
  - @caisson/pricebook@0.5.6
  - @caisson/alerting@0.2.2
  - @caisson/audit-worm@2.1.2
  - @caisson/billing@0.6.2
  - @caisson/billing-orchestration@0.3.2
  - @caisson/email@0.5.1
  - @caisson/jobs@0.6.1
  - @caisson/license-verify@0.3.3
  - @caisson/observability@0.3.2
  - @caisson/org-controls@0.3.2
  - @caisson/rate-limit@0.1.5
  - @caisson/tenancy-rls@0.5.3

## 0.0.12

### Patch Changes

- Updated dependencies [f40653b]
- Updated dependencies [c3b0e41]
  - @caisson/registry-schema@0.5.3
  - @caisson/jobs@0.6.0
  - @caisson/credits@0.5.4
  - @caisson/license-issue@1.0.1
  - @caisson/pricebook@0.5.5
  - @caisson/audit-worm@2.1.1

## 0.0.11

### Patch Changes

- Updated dependencies [1de88d7]
  - @caisson/audit-worm@2.1.0

## 0.0.10

### Patch Changes

- Updated dependencies [5a09b01]
  - @caisson/registry-schema@0.5.2
  - @caisson/credits@0.5.3
  - @caisson/license-issue@1.0.1
  - @caisson/pricebook@0.5.4

## 0.0.9

### Patch Changes

- Updated dependencies [3f05e1e]
  - @caisson/registry-schema@0.5.1
  - @caisson/credits@0.5.2
  - @caisson/license-issue@1.0.1
  - @caisson/pricebook@0.5.3

## 0.0.8

### Patch Changes

- 59e1365: Resend quota telemetry + volume-cliff ops alert (Kickoff T deliverability item). The Resend driver
  gains an optional `onQuota` observer fed from the `x-resend-monthly-quota` / `x-resend-daily-quota`
  response headers on successful sends — Resend exposes no usage API, so these headers are the only
  programmatic signal; observer errors never break a send. services/license wires the observer to a
  Discord ops alert when remaining monthly quota drops under `RESEND_QUOTA_ALERT_REMAINING` (default
  5000, "0" disables), rearming every 6h. Resend's own built-in 80%/100% quota emails remain the
  zero-code second layer.
- 7e823a9: Renovate dependency pins (exact versions) across the app and service workspaces; no code change.
- Updated dependencies [ca44db5]
- Updated dependencies [baaa4fc]
- Updated dependencies [a8696cf]
- Updated dependencies [1867fa3]
- Updated dependencies [e5e4311]
- Updated dependencies [e5e4311]
- Updated dependencies [59e1365]
- Updated dependencies [a0fd9b1]
- Updated dependencies [d1b4afa]
- Updated dependencies [e183860]
  - @caisson/audit-worm@2.0.0
  - @caisson/org-controls@0.3.1
  - @caisson/billing-orchestration@0.3.1
  - @caisson/kernel@0.5.0
  - @caisson/email@0.5.0
  - @caisson/observability@0.3.1
  - @caisson/alerting@0.2.1
  - @caisson/billing@0.6.1
  - @caisson/credits@0.5.1
  - @caisson/jobs@0.5.1
  - @caisson/license-issue@1.0.1
  - @caisson/license-verify@0.3.2
  - @caisson/pricebook@0.5.2
  - @caisson/rate-limit@0.1.4
  - @caisson/tenancy-rls@0.5.2
  - @caisson/registry-schema@0.5.0

## 0.0.7

### Patch Changes

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
- 2b65cf3: Both services now alert on background-job/watcher failures: `service-license` threads an
  `alerting` port into the credit-expiry pg-boss scheduler (a sweep/notice/tick task failure or a
  pg-boss connection error notifies the operator, then the original failure still propagates
  unchanged); `service-intel` alerts when a watcher tick fails. Both fan out to an operator Discord
  channel when `DISCORD_OPS_WEBHOOK_URL` is configured; absent it, behavior is unchanged from
  before. No public API changes.
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
- b3c5b0b: Documentation-only: an outdated code comment describing the first-cycle subscription race as an open gap now reflects the shipped fix (the cancel tombstone and grant-time liveness check). No behavior change.
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

- d9154da: Bound the post-commit license mint (fired synchronously in the Paddle webhook response path) with
  a 5-second deadline. A hung signer — the local Ed25519 signer never blocks, but a future KMS-backed
  one could — now times out cleanly instead of hanging forever, preserving the never-5xx contract;
  the mint failure is logged and the receipt simply omits the token, same as any other mint failure
  (the buyer's next grant/renewal, or the admin first-mint lever, recovers it). This bounds the hang;
  it does not guarantee staying inside Paddle's own webhook timeout on a slow signer, since the
  deadline stacks on top of the grant transaction that already ran — a redundant, idempotent retry
  from Paddle may still occur.
- 99d665a: Add an integration test proving `resolveAccountEntitlements` never fails closed for an account
  that holds the priority-support subscription alongside a real software entitlement — the exact
  brick risk the non-module entitlement reservation in `@caisson/registry-schema` closes.
  No behavior change. Private package only; no publishable release.
- 4c141b0: Export the license and docs service request-body schemas for security schema fuzzing, and add a local admin auth harness so authed pages can be exercised without OAuth. No runtime behavior change.
- a79acb4: Route the refund webhook (whole-transaction and per-line branches) and the admin purchase-revoke
  action's credit clawback through the shared `outstandingClaw` guard in `@caisson/credits`, closing
  a read-then-claw race where two differently-keyed clawback attempts against the same purchase
  could drain an unrelated purchase's unspent credits out of the shared wallet. The Developer-plan
  owned-coverage re-grant now shares an account-scoped advisory lock with the refund sweep via a new
  `grantOwnedCoverageMirrors` function, so a coverage-mirror grant and a concurrent refund reconcile
  for the same account can no longer interleave out of order — and every billing mutation path
  (invoice grant, cancel revoke, both refund branches, admin revoke) now acquires that account lock
  FIRST via `acquireAccountBillingLock`, one canonical order that removes advisory-lock deadlocks
  between racing deliveries. Tests pin the lock order on every path, the one-time refund's scoping
  boundary (a sibling subscription grant's credits and entitlement stay untouched), the actual
  behavior of a refund keyed to a subscription cycle's transaction id (the cycle's own unspent
  credits are clawed, bounded to that cycle's grant; the entitlement survives until cancellation),
  and today's safe no-op on dunning and past-due event types.
- 317bad5: Add a verified, time-boxed evaluation-license flow. An applicant is scored on their
  work-email domain — free-mail and disposable domains are rejected outright, and a hybrid
  risk score (mail-exchange presence, domain age, an optional enrichment lookup) routes the
  rest to auto-approve, an operator review queue, or auto-reject, with every uncertain signal
  widening toward review rather than approval. An approved, card-validated applicant can then
  be issued a short-lived license that carries its own expiry: it unlocks the evaluated modules
  for the window and falls back to the free tier automatically when the window ends or the
  evaluation is revoked. The service health response also gains an index digest + entry count
  so a drift probe can confirm the deployed registry-index copies agree. Private package only;
  no publishable release.
- Updated dependencies [81223a7]
- Updated dependencies [5d60969]
- Updated dependencies [1bc677a]
- Updated dependencies [a79acb4]
- Updated dependencies [2b65cf3]
- Updated dependencies [3d23da7]
- Updated dependencies [230f02a]
- Updated dependencies [b8fe873]
- Updated dependencies [a79acb4]
- Updated dependencies [2b65cf3]
- Updated dependencies [9a81dd7]
- Updated dependencies [9a81dd7]
- Updated dependencies [114e2a0]
- Updated dependencies [4036574]
- Updated dependencies [5e9996e]
- Updated dependencies [317bad5]
- Updated dependencies [a0aa9a3]
- Updated dependencies [2b65cf3]
- Updated dependencies [1bc677a]
- Updated dependencies [d5cef92]
- Updated dependencies [0dd715a]
- Updated dependencies [230f02a]
- Updated dependencies [a0aa9a3]
- Updated dependencies [8253e76]
- Updated dependencies [2b65cf3]
- Updated dependencies [99d665a]
- Updated dependencies [99d665a]
- Updated dependencies [ab352ab]
- Updated dependencies [9a81dd7]
- Updated dependencies [4d85f28]
- Updated dependencies [97b0341]
  - @caisson/email@0.4.0
  - @caisson/billing@0.6.0
  - @caisson/billing-orchestration@0.3.0
  - @caisson/audit-worm@1.0.0
  - @caisson/registry-schema@0.5.0
  - @caisson/credits@0.5.0
  - @caisson/alerting@0.2.0
  - @caisson/jobs@0.5.0
  - @caisson/pricebook@0.5.1
  - @caisson/license-verify@0.3.1
  - @caisson/kernel@0.4.3
  - @caisson/license-issue@1.0.0
  - @caisson/observability@0.3.0
  - @caisson/org-controls@0.3.0
  - @caisson/rate-limit@0.1.3
  - @caisson/tenancy-rls@0.5.1

## 0.0.6

### Patch Changes

- Internal hygiene wave: the standards gate's locked-price table moved the Compliance bundle to its
  current price and gained rows for the two retired alias packages; the four private reference apps
  and the root manifest now carry an explicit license field; the license service applies the new
  Developer-plan coverage semantics when computing signed license claims.
- Updated dependencies [8c53ca3]
- Updated dependencies [8170382]
- Updated dependencies
- Updated dependencies
- Updated dependencies [8c53ca3]
- Updated dependencies
- Updated dependencies [8170382]
  - @caisson/audit-worm@0.3.0
  - @caisson/registry-schema@0.4.0
  - @caisson/license-issue@0.0.6
  - @caisson/pricebook@0.5.0
  - @caisson/tenancy-rls@0.5.0
  - @caisson/credits@0.4.1
  - @caisson/billing-orchestration@0.2.1
  - @caisson/jobs@0.4.1
  - @caisson/org-controls@0.2.1
  - @caisson/rate-limit@0.1.2

## 0.0.5

### Patch Changes

- 850b844: Moved the per-account throttle store out of the commercial license service and into the
  new shared, freely licensed rate-limiting package. The open reference application now
  composes this shared store directly for its buyer-facing throttling instead of depending
  on the commercial license service to get it. Buyer-visible throttling behavior is
  unchanged; this only changes where the code lives and removes an unnecessary dependency
  from the open reference application.
- 850b844: Added a new shared rate-limiting package with an in-memory per-client-IP throttle for
  surfaces with no signed-in identity yet. The docs and license services now both import
  this shared limiter instead of each keeping a separate copy of the same logic. The
  internal licensing-boundary check also now recognizes the new package as part of the
  open, freely licensed base set. Buyer-visible throttling behavior, including the limits,
  the retry timing, and which header is trusted for the client IP, is unchanged; this only
  changes where the code lives.
- Updated dependencies [b791198]
- Updated dependencies [aec9f1c]
- Updated dependencies [b674ed3]
- Updated dependencies [d6cc28e]
- Updated dependencies [d06a9b8]
- Updated dependencies [0c883ae]
- Updated dependencies [ad02304]
- Updated dependencies [2834c3f]
- Updated dependencies [41e07b6]
- Updated dependencies [4d7eb71]
- Updated dependencies [90b6dc1]
- Updated dependencies [850b844]
- Updated dependencies [f178f9a]
- Updated dependencies [9efcff2]
- Updated dependencies [4d7eb71]
- Updated dependencies [e784af1]
- Updated dependencies [4d7eb71]
- Updated dependencies [31d6a41]
- Updated dependencies [850b844]
- Updated dependencies [850b844]
- Updated dependencies [0af4dbf]
- Updated dependencies [0af4dbf]
- Updated dependencies [0af4dbf]
- Updated dependencies [4d7eb71]
  - @caisson/audit-worm@0.2.4
  - @caisson/billing@0.5.0
  - @caisson/credits@0.4.0
  - @caisson/jobs@0.4.0
  - @caisson/kernel@0.4.2
  - @caisson/license-issue@0.0.5
  - @caisson/license-verify@0.3.0
  - @caisson/observability@0.2.4
  - @caisson/pricebook@0.4.0
  - @caisson/rate-limit@0.1.1
  - @caisson/registry-schema@0.3.0
  - @caisson/tenancy-rls@0.4.0
  - @caisson/billing-orchestration@0.2.0
  - @caisson/org-controls@0.2.0

## 0.0.4

### Patch Changes

- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
  - @caisson/audit-worm@0.2.3
  - @caisson/kernel@0.4.1
  - @caisson/tenancy-rls@0.3.2
  - @caisson/billing@0.4.1
  - @caisson/credits@0.3.2
  - @caisson/license-issue@0.0.4
  - @caisson/license-verify@0.2.3
  - @caisson/observability@0.2.3
  - @caisson/pricebook@0.3.2

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
- Updated dependencies [3a7a4fd]
- Updated dependencies [cc7cb8b]
- Updated dependencies [fb8d966]
- Updated dependencies [fb8d966]
  - @caisson/pricebook@0.3.1
  - @caisson/billing@0.4.0
  - @caisson/kernel@0.4.0
  - @caisson/audit-worm@0.2.2
  - @caisson/credits@0.3.1
  - @caisson/license-issue@0.0.3
  - @caisson/license-verify@0.2.2
  - @caisson/observability@0.2.2
  - @caisson/tenancy-rls@0.3.1

## 0.0.2

### Patch Changes

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
- 904b15b: Post-merge consolidation sweep: repo links repointed to caisson-sh/caisson (site footer, JSON-LD, docs edit-links, llms.txt blob URLs), the audit-harness design-ui domain re-globbed from the removed apps/studio to the apps/admin design gallery, and stale SigNoz naming updated to the Grafana Cloud fleet sink (ADR-0177/0207). Docs/comments only apart from the design-ui glob fix; no behavior change to any runtime path.
- Updated dependencies [b5915e0]
- Updated dependencies [b5915e0]
- Updated dependencies [20d5ab0]
- Updated dependencies [e62c88d]
- Updated dependencies [ccf8b10]
- Updated dependencies [afa6070]
- Updated dependencies [52c6738]
- Updated dependencies [95103b6]
- Updated dependencies [aaff518]
- Updated dependencies [904b15b]
- Updated dependencies [549dd4e]
  - @caisson/registry-schema@0.2.1
  - @caisson/tenancy-rls@0.3.0
  - @caisson/billing@0.3.0
  - @caisson/kernel@0.3.0
  - @caisson/credits@0.3.0
  - @caisson/pricebook@0.3.0
  - @caisson/observability@0.2.1
  - @caisson/license-issue@0.0.2
  - @caisson/audit-worm@0.2.1
  - @caisson/license-verify@0.2.1

## 0.0.1

### Patch Changes

- Updated dependencies [72ffd85]
- Updated dependencies [59d332f]
- Updated dependencies [6236f59]
- Updated dependencies [69817a1]
- Updated dependencies [5b57c78]
- Updated dependencies [9483a36]
  - @caisson/billing@0.2.0
  - @caisson/pricebook@0.2.0
  - @caisson/observability@0.2.0
  - @caisson/registry-schema@0.2.0
  - @caisson/kernel@0.2.0
  - @caisson/credits@0.2.0
  - @caisson/license-verify@0.2.0
  - @caisson/tenancy-rls@0.2.0
  - @caisson/license-issue@0.0.1
