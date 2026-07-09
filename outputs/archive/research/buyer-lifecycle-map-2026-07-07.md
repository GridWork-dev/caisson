---
updated: 2026-07-07
status: research
---

# Buyer-lifecycle map — end-to-end confirmed-gap audit

Scope: the full paid-buyer journey through Caisson, stage by stage, mapped against
live `main` (`a29fca09`). Every gap below survived adversarial verification against the
source — claims the verify pass refuted are in the appendix so they are not re-litigated.
Severities are the **verified** severity (several reporter calls were down/up-graded on
review); the original reporter call is noted only where it changed.

This doc feeds a picker. Forks are called out explicitly; recommendations carry a
confidence label.

---

## 1. Executive summary

### The chain

A paid buyer moves through eleven stages. File anchor = the seam that owns the stage.

1. **Discover & evaluate** — `apps/site` marketplace grid + 5 persona pages + `lib/pricing.ts` (single price SoT) + SEO/AEO surface (`sitemap.ts`, `llms.txt`, `robots.ts`). → **gaps**
2. **Cart & checkout** — `apps/site/lib/cart.ts` + `paddle-checkout.ts` + `catalog.ts` → Paddle.js overlay. → **gaps**
3. **Payment webhooks** — `services/license` `/webhook` → `parsePaddleEvent` → `applyBillingEvent` (grants + credits). → **gaps** (money math solid; buyer-side side-effects not idempotent)
4. **Account & auth** — `apps/site/lib/auth.ts` (better-auth), `packages/auth` org accounts, `custom_data.account_id` purchase linking. → **gaps**
5. **Entitlements & license** — `services/license/src/entitlement-store.ts` + `packages/license-issue`/`license-verify` + `POST /issue`. → **gaps** (engine solid; **fulfillment trigger missing — P0**)
6. **Delivery & registry** — `registry/worker` (Ed25519 gate) + `packages/cli` (`create-caisson`) + npm mirror. → **gaps** (Worker solid; **CLI distribution broken — two P0**)
7. **Post-purchase lifecycle** — renewals (`packages/pricebook/renewals.ts`), credit FIFO+expiry (`packages/credits`, `credit-expiry-scheduler.ts`). → **gaps** (data layer solid; **re-mint trigger missing — same P0 as stage 5**)
8. **Refunds & revocation** — refund webhook + admin `revokePurchaseAdmin` (ADR-0225) + CF-Worker edge deny-set. → **gaps** (two concurrency races, fix in flight)
9. **Support** — Discord bot (`services/support-bot`) + site Ask-AI (`apps/site/lib/ask-ai`). → **gaps**
10. **Dashboard (buyer)** — `apps/site/app/dashboard/**` (9 routes, real-data throughout). → **gaps** (most concentrated)
11. **Admin (operator)** — `apps/admin` (better-auth + GitHub-id allowlist, 5 dual-logged mutations). → **gaps** (core mutations solid; intel UI + support-ops surface missing)

### Headline verdict

The pattern is consistent across every stage: **the data/logic layer is solid and the gaps
cluster at (a) fulfillment triggers, (b) buyer-facing surfaces, and (c) integration edges the
unit tests never reach.** The single most consequential finding is that **nothing automated
ever calls `POST /issue`** — a buyer who completes checkout gets DB entitlement rows but no
usable license token, and a paid renewal never re-mints the token that gates registry access.
This one missing trigger is a P0 in two stages (5 and 7). The CLI has two independent P0s that
break the first-touch install command every marketing page advertises. Everything else is P1
and below.

Nothing reachable is live-customer-facing yet: the site sits behind the pre-launch CF-Access
gate and Paddle is in sandbox, so every finding is currently pre-launch-QA-facing, not
live-loss. That is the window to fix them in.

---

## 2. Per-stage detail

### Stage 1 — Discover & evaluate → **gaps**

**Implemented.** One dynamic Next app with a single price/membership SoT (`apps/site/lib/pricing.ts`,
integer USD, pinned against `@caisson/pricebook` by `pricing.test.ts`) feeding a unified marketplace
grid (6 bundles + 22 modules, filter/search/compare/preview), 5 persona bundle pages, plans page,
11 module depth pages (`lib/module-pages.ts`), 20 dated competitor comparisons (`lib/comparisons.ts`,
every claim `ACCESSED`-stamped), and an SEO/AEO surface (`sitemap.ts`, `llms.txt/route.ts`, `robots.ts`
naming 14 AI crawlers). Honesty is enforced in code, not prose: `pricing.ts` forbids fabricated
"was $X" anchors (ADR-0130, tested); `/evidence` truthfully discloses no free pre-purchase download.

**Confirmed gaps.**

- **[P1 · G5] Dead module-depth links from 3 of 5 persona pages** — `compliance/`, `local-first/`,
  `agentic-dev/` gate module cards on `MODULE_PRICES.find(id)` truthiness, not on `module-pages.ts`
  existence. 7 priced-but-pageless slugs (compliance-core, frameworks-pack, signing-primitive,
  local-sync/-inference/-privacy, tool-exec) render as clickable cards → `marketplace/modules/[slug]/page.tsx:230`
  `notFound()`. The fix pattern already exists in-repo: `provenance/page.tsx` gates on a `MEMBER_DETAIL`
  allowlist Set. `routes.test.ts` never walks member lists, so CI misses it. Hits the flagship Compliance
  wedge mid-evaluation. Introduced PR #130, unfixed through 4 merges.
- **[P2 · G17] Marketplace-hub JSON-LD advertises 11 dead module URLs** — `marketplace/(hub)/page.tsx:57`
  feeds the full 22-module list into `moduleItemList`, which sets `url` unconditionally for all 22; 11
  have no page and 404. `sitemap.ts` and `llms.txt` correctly use the 11-page set, so the structured data
  is dishonest to the exact AEO crawlers `robots.ts` courts, while the human-visible card links are
  correctly guarded (`preview-dialog.tsx` `hasDetail`). Same-page/same-catalog inconsistency.
- **[P3 · G31] ai-production persona page under-lists membership** — `bundle-pages.ts`'s hand-authored
  ai-production `members` (4 modules) omits `ai-evals`, `credits`, and `field-crypto`, which `pricing.ts`
  marks `bundles:['ai-production']` (the "membership truth"). `/ai-kit` shows 4; the homepage grid label
  and the marketplace card viewer both compute 6 via `modulesByBundle()` — the landing page contradicts
  the card that links to it. Isolated to ai-production (other 4 bundles are in sync); entitlement/delivery
  unaffected. Likely fallout of the ADR-0258 members-fold.

**Risk fold.** The plans-page CTA hardcodes `bunx @caisson-sh/cli@latest`, which 404s today (npm publish
gated behind manual `confirm=publish`); true only because the site is still CF-Access-gated and the go-live
runbook fires publish before the gate drops — a load-bearing ordering with no code guard. ADR-0290 (locked
today) documents 20/28 catalog cards as brand-mark placeholders and commits to an all-static rework — **now
implemented on PR #165, open + mergeable** (see appendix); the media state described here is superseded imminently.

### Stage 2 — Cart & checkout → **gaps**

**Implemented.** localStorage cart (`lib/cart.ts` + `cart-provider.tsx`), `catalog.ts` price-ids matching
`pricebook/purchases.ts` byte-for-byte for all 6 bundles + 22 modules, `pruneCart` drops retired SKUs
pre-checkout, multi-item Paddle.js overlay stamps `account_id` for tenant resolution. Webhook fulfillment
grants every line with per-line refund/clawback.

**Confirmed gaps.**

- **[P1 · G4] `/dashboard/plan` lists 5 archived edition-era Paddle rows as live Buy buttons** (reporter
  P0 → verified P1). `purchases.ts:92-116` keeps 5 real (non-PLACEHOLDER) rows keyed by archived edition
  price-ids; `dashboard/plan/page.tsx:23-27` `realEntries()` filters only on the substring `PLACEHOLDER`,
  so they render as full Buy cards next to the canonical `*_bundle` rows with near-identical labels
  ("Compliance" vs "Compliance bundle"). Permanently nav-linked, untested. ADR-0270's purge only verified
  `lib/catalog.ts` (which correctly maintains a `LIVE_PRICE_IDS` allowlist) — this surface reads PURCHASE_BOOK
  directly and was never touched. Not P0 because repointed entitlements are byte-identical, so no wrong grant
  can result; it is a money-path UX/hygiene defect contradicting the locked purge.
- **[P1 · G6] Paddle.js load/init failure is silently swallowed and poisons checkout for the session** —
  `paddle-checkout.ts:32-40` memoizes `paddleInitPromise` with no `.catch()` and no reset; a Promise is truthy
  regardless of settled state, so a single load failure (ad-blocker, network, bad token) permanently returns
  the rejected promise. `cart-checkout-panel.tsx` `pay()` is `try/finally` with no `catch` → unhandled rejection,
  button flashes "Opening…" and reverts with zero user feedback, and unlike `plan-purchase-row.tsx` it has no
  `isPaddleConfigured()` guard at all. No test covers `paddle-checkout.ts`.
- **[P2 · G16] Add-to-cart has zero ownership awareness** — `add-to-cart-button.tsx` checks only already-IN-CART;
  `marketplace-surface.tsx` has no session/entitlement read. Only `dashboard/plan/page.tsx` computes an `owned`
  flag, wired to a different flow. A signed-in owner can re-add and re-pay for an owned SKU; webhook idempotency
  only dedups payment-id retries, so a genuine second transaction grants redundantly. Backstopped only by the
  EULA's 14-day money-back guarantee, not prevented at point of sale.
- **[P3 · G32] Stale/retired cart lines silently pruned on hydration** — `cart-provider.tsx:58-68` runs
  `pruneCart` on mount with no toast/banner (no toast library exists in the app). Correctly prevents the
  ADR-0238 fail-closed-webhook scenario, but the buyer sees items vanish with no explanation.

### Stage 3 — Payment webhooks → **gaps** (money core solid)

**Implemented.** HMAC-SHA256 verify (Paddle's scheme, 5s tolerance), deliberately non-strict Zod envelope
(after the 2026-07-04 strict-schema-400'd-every-delivery incident), exactly 5 subscribed event types
cross-verified 1:1 against the launch runbook, dual-layer idempotency (outer `event_id` claim + inner credit
ledger unique index on `(source_event_id, event_type, line_item_id)`), full multi-item fulfillment with
fail-closed FIFO line-item join, and whole+per-line refund/clawback bounded to unspent credits.

**Confirmed gaps.**

- **[P1 · G7] Buyer-facing side-effects fire on the idempotent no-op path** — `applyBillingEvent` discards the
  `{idempotent}`/touched-count returns from `grant()`/`grantEntitlements()`/`upsertSubscriptionGrants()` and
  builds `grantedEntitlements`/`skuLines` from the input event. The outer dedup keys on `event_id`, but a
  Paddle dashboard **"Resend" mints a fresh event_id for the same business event** (the repo's own test
  models exactly this: `apply-billing-event.integration.test.ts:214` — but asserts only on the credit
  ledger). On that resend the DB writes correctly no-op, yet `app.ts` re-fires a Discord role push, a second
  PostHog `purchase` event (`revenue` double-counted), and a second confirmation email. The
  `withIdempotentSideEffect` primitive built for this (SPEC wave6a / ADR-0229) is grep-confirmed unused.
- **[P2 · G18] Coverage-mirror horizon extension has no per-invoice idempotency key** — `upsertSubscriptionGrants`
  ON-CONFLICT target omits `source_event_id`; DO-UPDATE recomputes `updates_expires_at = GREATEST(existing,
now()+cadence)`. A resent `invoice.paid` (fresh event_id, same invoiceId) recomputes `now()` later, so
  GREATEST ratchets the buyer's signed updates-window forward by the wall-clock gap, for free. Contrast the
  one-time path's `grantEntitlements` (ON CONFLICT DO NOTHING, genuinely idempotent). Trigger is a support
  resend, not attacker-controlled, magnitude bounded to one resend's lateness.
- **[P3 · G33] PostHog capture has no first-purchase-vs-renewal flag** — `PurchaseCapture` lacks the
  `subscriptionCycle` field the sibling email path computes, so every Developer-plan (`coversOwnedEntitlements`)
  renewal re-lists the buyer's whole owned set as newly "granted" with full cycle revenue. Analytics-only;
  SKU attribution stays correct.

### Stage 4 — Account & auth → **gaps**

**Implemented.** Self-hosted better-auth (magic-link primary, password verification-gated, env-gated OAuth)
behind Secure/HttpOnly/SameSite=Strict cookies. `getSession`/`requireDashboardSession` resolve a verified
`SessionContext`, never trusting client input. D4 org accounts (ADR-0176): `account_member` + dual-GUC RLS,
idempotent personal account on zero memberships. **Purchase-to-account linking is by server-verified
`accountId` stamped into `custom_data.account_id`, never email** — architecturally immune to the "different
checkout email" failure class. Admin surface (ADR-0283): own better-auth instance, GitHub-only, fail-closed
numeric-id allowlist checked at link-time and every request, own Postgres DB, live-verified.

**Confirmed gaps.**

- **[P1 · G8] Invited org seats can never reach the account they were added to** — `selectActiveAccount` always
  falls back to the caller's personal account when `requestedAccountId` is absent, and `auth.ts:69` (the only
  caller) never passes one. No switcher UI / active-account cookie exists anywhere. An owner buys Org Controls
  ($249), invites a teammate by raw user-id; on the teammate's next sign-in they resolve to their own unentitled
  personal account every time, silently. ADR-0176 committed to the switcher + invite/accept as launch scope; the
  Stream-D SWEEP deferred it, then the "D4 ACTIVATED" integration silently dropped it. Total block on the paid
  module's entire value prop; no security exposure (RLS holds).
- **[P2 · G19] Sign-out clears the cookie but never revokes the server session row** — `api/auth/sign-out/route.ts`
  is a literal Next segment that shadows better-auth's own revoking `/sign-out` in the `[...all]` catch-all; it
  only deletes cookies (header comment: "the DB session row expires on its own"). No `expiresIn`/`updateAge`
  override, so the row lives the full default lifetime. A captured raw token stays valid past logout. Narrowed by
  HttpOnly+Secure+SameSite=Strict.
- **[P3 · G34] apps/admin has no sign-out mechanism at all** — the bare better-auth client exposes `.signOut()`
  but nothing calls it; no sign-out control in `admin-nav`. Single-operator, allowlist-of-one, so access
  revocation already exists via allowlist narrowing — a convenience gap, not an auth hole.
- **[P3 · G35] Cart cleared the instant the Paddle overlay opens, before payment** — `cart-checkout-panel.tsx:39`
  calls `clear()` on `openCartCheckout` returning `true` (overlay requested), with no `eventCallback`. A buyer
  who opens the overlay to review the total then cancels loses their cart. Deliberate anti-double-submit
  tradeoff per the code comment; no money/data loss.

### Stage 5 — Entitlements & license → **gaps** (P0)

**Implemented.** Reference-counted grant junction with idempotent grants, soft-revokes, coverage-mirror
reconciliation, per-pair updates-window/entitledSince. `resolve-entitlements.ts` + `registry-schema/entitlements.ts`
expand purchased ids (bundles, bare slugs, reserved slugs) with fail-closed TM-E throw on the unrecognized. Ed25519
issuer signs `canonicalize(claims)`; `license-verify` verifies fully offline against a baked prod key, fail-safe to
community. Revocation is a CRL-style deny-set (DB table written atomically with the admin revoke, republished whole
to R2, read through a fail-open TTL cache).

**Confirmed gaps.**

- **[P0 · G1] No live caller ever triggers first license issuance after a purchase** — the webhook/`applyBillingEvent`
  path grants `entitlement_grant` rows + credits but never calls `issueLicense`/`POST /issue`. The only live
  `issueLicense(` call sites are the `/issue` route (bearer-gated server-to-server, unreachable by a browser) and
  the admin `reissueLicenseAdmin`, which **404s when no prior grant exists** ("v1 re-serves an existing token only") —
  it structurally cannot first-mint. The dashboard's own EmptyState promises "A license is issued automatically the
  first time you complete a purchase" — false against the code. The only path that mints is a manual operator curl
  against `LICENSE_ISSUE_TOKEN`, documented as a launch-verification step. Registry + buyer-MCP gate on the signed
  token, so a real buyer has no product-reachable way to obtain what they paid for. **Same root cause as G1 in stage 7.** Not acknowledged in any ADR / outstanding-work row.

**Risk fold.** `RESERVED_MODULE_ENTITLEMENT_IDS` + `LEGACY_ENTITLEMENT_ALIASES` are a manually-disciplined single
point, not CI-enforced — a future rename that forgets an alias makes `expandEntitlements` fail-closed-throw a
buyer's _entire_ purchased set. Worth operator attention at every catalog change.

### Stage 6 — Delivery & registry → **gaps** (two P0)

**Implemented.** The CF Worker is thorough: offline Ed25519 verify, entitlement expansion, ADR-0251/0255
updates-window fold, ADR-0257 snapshot-at-sale member filter, operator deny-set, same-origin npm packument + R2
tarballs — all through one `resolveGate`, fail-closed on entitlement, fail-open only on availability. Heavily
golden-fixture tested at unit level.

**Confirmed gaps.**

- **[P0 · G2] `create-caisson`'s argv parser rejects the exact quickstart command** — `bun run src/cli.ts my-app`
  → `unknown argument: "my-app"` (exit 1) empirically. `parseArgs` recognizes only `--name/--edition/--deploy/
--framework/--module`; a bare positional throws, and it throws _before_ the interactive-wizard TTY branch (via
  `resolveLicensed` → `parseArgs` unconditionally at `cli.ts:318`), so a real terminal session breaks too. The
  broken `bunx @caisson-sh/cli@latest my-app` is the literal copy-paste on `getting-started.mdx:20`,
  `create-caisson.mdx:18/35`, and `trial-path.tsx:16/53`. The marketed "prove fit in week one" first-touch command.
- **[P0 · G3] `resolveIndexPath()` resolves only inside the monorepo checkout** — it computes
  `../../../registry/index.json` from `import.meta.url`; a real install lands at `node_modules/registry/index.json`
  (nonexistent), and `package.json` `files` never bundles `registry/` (which sits 3 levels above the package
  anyway). `loadRegistryIndexFromFile` is a plain `readFileSync` with no fallback. Hit unconditionally by the
  interactive wizard, the licensed path, and `--demo`; only `--sample` avoids it. The public-mirror export
  pipeline doesn't fix the depth or `files` array. This is research fork P5-23 ("bundle + refresh"), never
  implemented. `publish-smoke.test.ts` stops at `node --check`, so nothing catches it. npm publish is armed
  pending only the manual `confirm=publish`.
- **[P2 · G28] `--help` names the wrong env var for the license token** — HELP says add `NODE_AUTH_TOKEN`; the
  generated `.npmrc` reads `${CAISSON_LICENSE_TOKEN}` (the README is correct). A buyer trusting `--help` over the
  README sends no bearer and gets 401'd on every commercial module. Leftover from the ADR-0223 GitHub-Packages →
  registry.caisson.sh flip; recurs in `meter.ts:9` comment. Mitigated: the post-generation `printNextSteps`
  points at the correct README, so only a `--help`-first buyer hits it.
- **[P3 · G36] The `create-caisson` doc fabricates a lockfile and an MCP result type** — `create-caisson.mdx`
  shows `caisson.lock (pinned module versions) written` and imports `type { GenerateResult }`; neither exists
  (no lockfile is written — versions pin inline in package.json; the real return is `GenerationOutcome`, the MCP
  hook returns `{generationId}`). A buyer/agent following it literally imports a nonexistent type.

### Stage 7 — Post-purchase lifecycle → **gaps** (P0 = G1)

**Implemented.** FIFO credit expiry with a `grant_consumption` join (ADR-0252), a daily pg-boss sweep
live-armed on Railway (`CREDIT_EXPIRY_SCHEDULE="0 6 * * *"`), a T-30d expiry email + dashboard badge, a
renewal-window extension formula (documented erratum fix, fail-closed throw-on-no-grant), a `renewal_extension`
ledger for idempotent un-extend-on-refund (whole + per-line), an alias-group fold for legacy grants, and a
coherent D/E snapshot-vs-window split wired through the Worker's `resolveGate`. RENEWAL_BOOK coverage verified
complete (all 6 bundles + 22 modules).

**Confirmed gaps.**

- **[P0 · G1] No automated trigger re-mints the token after a renewal (or first purchase)** — the same missing
  `POST /issue` caller as stage 5, viewed from the renewal path. A buyer clicks "Renew updates — $79/yr", pays,
  gets `updates_expires_at` extended in the DB and a renewal-confirmation email, and the dashboard's "Updates"
  card shows the correct new date (live DB read) — but `license-token-card.tsx` still shows the **old** token,
  whose `updatesUntil` the Worker enforces per-version. The buyer's `.npmrc` keeps getting 404'd for
  post-window versions they just paid to unlock, until an operator manually curls or clicks admin reissue. A
  textbook silent-failure at the "month 13" moment; every surrounding signal reads success.
- **[P1 · G9] The $49/5,000-credit top-up pack has no buyer-facing purchase entry point** — `purchases.ts`
  defines the live price row (`pri_01kwj71ae0g946ztm4sej7bq76`, entitlements: []); its own comment says it is
  "not surfaced in `catalog.ts`". Repo-wide grep for top-up/credit-pack CTA returns zero. ADR-0245 commits to
  "top-ups anytime"; a month-13 buyer whose pooled credits ran low has no self-serve path. Admin has only a
  manual credit-adjust route (ops workaround, not self-serve). Independently observed in catalog-doctrine research;
  not in the operator-owed backlog.
- **[P3 · G37] Dashboard "Current balance" can overstate spendable credits ~24h** — the balance tile reads the
  raw `credit_wallet.balance` aggregate, decremented only by the once-daily 6am sweep, while `debit()`'s FIFO
  walk already excludes expired grants at spend time. Between a grant's expiry and the next sweep, the tile shows
  more than is spendable; a debit 402s with a lower figure than the tile. No overdraw. The fix pattern
  (sweep-before-read) is already used in `admin-mutations.ts:483`.

**Risk fold.** Renewal display price (`renewalAmount()`, ADR-0260 §5 40%-X9) is computed off the _current_ list
amount, not a price frozen at original purchase — a future list-price increase silently raises the renewal shown
to existing buyers too. Matches ADR-0260 §5's plain wording, tension with ADR-0106's price-lock framing — worth an
explicit operator call (see refuted #10 for why grandfathering itself is not a gap).

### Stage 8 — Refunds & revocation → **gaps**

**Implemented.** Paddle `refund.completed` (whole + per-line) soft-revokes the backing grants and claws back
only unspent credits, bounded two ways (never below zero, never re-claw a sibling's claw). Admin `revokePurchaseAdmin`
(ADR-0225): DB-only, source-scoped, dual-logged (queryable + WORM), opt-in bounded claw, opt-in edge deny-set to R2
(fail-open, 60s TTL, live since 2026-07-05). ADR-0269 coverage-mirror reconcile sweeps subscription mirror grants when
their one_time backing is refunded.

**Confirmed gaps.**

- **[P1 · G10] Credit clawback read-then-claw race can drain an unrelated purchase's credits** —
  `remaining = granted − alreadyClawed` is computed via unlocked SELECTs before `clawback()`, whose own
  `SELECT ... FOR UPDATE` bounds only the wallet to non-negative, not this purchase's share. Two concurrent
  triggers on the same purchase (admin revoke racing the per-line refund webhook — _different_ idempotency keys,
  so no dedup) each read stale `alreadyClawed=0` and each claw the full remainder, draining a sibling purchase's
  unspent credits from the fungible wallet. **Fix already coded on `fix/billing-clawback-concurrency-adr0269` /
  open PR #164** (advisory-lock `outstandingClaw()`), unmerged. Linear CAISSON-20/25.
- **[P1 · G11] Coverage-mirror grant/reconcile race lets a refunded buyer keep subscription-sourced access** —
  the Developer-plan `coversOwnedEntitlements` re-grant and the refund's `reconcileCoverageGrants` both do
  unlocked read-then-write over "which ids does this account own" under READ COMMITTED with no advisory lock. A
  cycle `invoice.paid` racing a refund reads "owned" before the revoke commits, then writes a fresh mirror grant
  for the just-refunded id, and nothing re-sweeps a mirror after reconcile ran once. Flows through `/issue` → the
  Worker → real registry access. The direct answer to "can a refunded buyer keep access": yes, via a narrow
  interleave. **Same PR #164** (`coverageLockKey` + `grantOwnedCoverageMirrors`), Linear CAISSON-25a.
- **[P2 · G20] Chargebacks are neither subscribed to nor handled** (reporter P1 → verified P2). Caisson subscribes
  only to `adjustment.updated` (Paddle: refunds only); a chargeback fires `adjustment.created action:'chargeback'`,
  absent from the subscription list and with no switch case (`default: return null`, silent 2xx). ADR-0225 names
  "a chargeback already lost at the bank" as a case its manual revoke lever exists for — so a manual remediation
  path exists, only automated detection/alerting is missing. Downgraded to P2 because Paddle is Merchant-of-Record
  (absorbs chargeback handling) and its own dashboard/email is the standard notice channel; the gap is "no in-app
  detection to shrink the notice-to-action window," not "chargebacks unhandled."
- **[P3 · G38] Last-write-wins race in the edge deny-set publish step** — two concurrent revokes for _different_
  accounts each read their own point-in-time deny-set snapshot inside their tx and PUT it post-commit; out-of-order
  network completion lets the earlier smaller snapshot overwrite the later larger one, transiently un-denying the
  second account at the edge until the next revoke republishes. Self-healing; DB stays truth. Operator-only,
  low-volume, no CAS on the PUT.

### Stage 9 — Support → **gaps**

**Implemented.** Grounded RAG with prompt-injection defenses, timing-safe billing-grant auth, fail-closed escalation,
a live purchase→Discord-role pipeline for the bundles, and PR #162 (open) closing the priority-support entitlement
brick risk. Two answer surfaces: the Discord bot (`/ask`) and the site Ask-AI widget.

**Confirmed gaps.**

- **[P1 · G12] No discoverable path anywhere to join the Discord server the purchase grants a role in** —
  repo-wide grep for `discord.gg`/`discord.com/invite` returns zero. The footer has no support/Discord entry;
  `discord-connect.tsx` only does an OAuth identity `linkSocial` (no `guilds.join`); `billing_grant.py`'s
  `find_member` 404s if the buyer isn't already in the guild; no purchase email mentions Discord. Meanwhile the
  marketing pricing FAQ promises "Support is email and Discord … included with every license" in three places with
  no link. The tested role-grant pipeline is unreachable for any buyer without an out-of-band invite. Not tracked
  as operator-owed.
- **[P2 · G21] Site Ask-AI escalation CTA routes to a compliance/procurement page and files no ticket** (reporter
  P1 → verified P2). All six escalation reasons render a static `<Link href="/procurement">Talk to the team</Link>`;
  `/procurement` is "Security & procurement," framed for security teams, mailto at the bottom. No IssueTracker/
  ChatPlatform port in the site handler — no ticket/thread parity with the Discord bot's auto-thread + Linear
  Triage. Downgraded: a working manual email fallback exists and the question text _is_ server-captured (ADR-0236
  `logQuestion`), so it is a UX/parity/routing defect, not a data-losing dead end; ADR-0234's own rider even calls
  the fallback a "contact/Discord CTA" the shipped code doesn't match.
- **[P2 · G22] docs-service per-IP rate limit is one shared bucket for the whole Discord community** — the limiter
  keys on `X-Real-IP` = the bot container's egress IP for all server-to-server calls, so the 20/min budget is shared
  across every Discord user; `docs_client.py` raises on any non-200 (429 included, no Retry-After) and `rag.py`
  unconditionally escalates. Any burst >20/min community-wide funnels legitimate questions into "I couldn't answer
  that" instead of answers. Cheap fix: retry-once-with-backoff or a bot-specific lane. The per-IP design was reasoned
  around anonymous public callers, not the bot's aggregation.
- **[P3 · G39] Admin `/grant-role` picker still has no priority-support entry** — `_EDITION_ROLE_ATTR` (backing the
  picker choices) has no `priority-support` key; PR #162 extends only the automated `/billing-grant` push. If the
  automated push fails, the operator's only manual recourse for priority-support is the raw `/role-add` needing the
  exact role object. Priority-support isn't purchasable yet (PLACEHOLDER), so zero near-term exposure.

### Stage 10 — Dashboard (buyer) → **gaps** (most concentrated)

**Implemented.** 9 real-data routes (overview, license, credits, activity, plan, members, ai-keys, compliance, cart);
every page reads `entitlement_grant`/`license_grant`/`credit_wallet`/`usage_event` via tenant-RLS-scoped reads.
Live per-entitlement updates-windows with renewal CTA, full credits ledger + 30-day expiry badge, metered activity,
BYOK, org seats (add-only), compliance attestations. Commerce email is a real 4-template system fired detached/
never-throw from the webhook + credit-expiry scheduler.

**Confirmed gaps.**

- **[P1 · G13] Plan page hardcodes `owned=false` on every subscription row** — the Subscriptions section maps
  `PLAN_BOOK` with `owned={false}` unconditionally (the Purchases section 25 lines above correctly checks
  `activeIds`). A buyer already paying Developer/Compliance-Updates sees a live Buy button on their own subscription
  and can open a second checkout. Structural wrinkle: `entitlement_grant` is keyed by entitlement_id + subscription_id,
  the read layer doesn't select `subscription_id`, and the Developer plan grants zero entitlement rows — so there is
  no current DB signal that distinguishes "subscribed" from "never." **Needs a subscription-status signal decided.**
- **[P1 · G14] No subscription-lifecycle visibility or self-serve cancel/manage-billing** — `EntitlementGrantRow`
  carries no subscriptionId / next-bill / portal link (though the table stores subscription_id). No cancel/portal
  route anywhere. ADR-0225 R-3 makes cancel an operator-driven Paddle-dashboard act. Two live annual subscriptions
  are being prepped for production. **Fork.**
- **[P1 · G15] No self-serve remove-member** (reporter P2 → verified P1). `@caisson/org-controls` exports
  `addAccountMember`/`listAccountMembers`/`assertCanManageMembers` — no remove/revoke anywhere in the repo (admin app
  has no member routes either). The schema GRANTs DELETE on `account_member` but no code issues it. The members page
  copy tells non-owners "Only the account owner can add or **remove** seats" — false. A departed teammate keeps full
  tenant-scoped read access indefinitely on a paid $249 module whose whole value is member management.
- **[P2 · G23] Commerce emails silently no-op if `RESEND_API_KEY` is unset on `caisson-license`** (reporter P1 →
  verified P2). `resolveEmailer()` reads the key from the license service's own env and falls back to an in-memory
  capture driver on absence; docs record Resend as SET only on `caisson-site`, and `caisson-license`'s railway.toml
  omits it. **Not confirmed mis-provisioned — a launch-checklist verification item.** Downgraded because boot logs a
  visible `RESEND_API_KEY unset` line (same accepted pattern as SUPPORT_BOT_URL/POSTHOG), the grant path is
  unaffected, and the site is pre-launch with zero live buyers. Operator-owed: `railway variables -s caisson-license
| grep RESEND`.
- **[P2 · G24] No proactive updates-window-expiring notice** (reporter P1 → verified P2). The pg-boss scheduler
  only enqueues the credit-expiry notice; no equivalent for `updates_expires_at`. A one-time buyer discovers a lapsed
  window only by visiting `/dashboard/license` and seeing a passive "Lapsed" pill. Downgraded: pre-launch, zero live
  renewal-eligible buyers today. Bump to P1 once they exist.
- **[P2 · G25] `/dashboard/compliance` + its API are ungated by entitlement** (reporter P1 → verified P2). No
  entitlement check anywhere (contrast `members/page.tsx`'s `accountHoldsOrgControls` gate); the API checks only
  `session !== null`. Any signed-in account, zero purchases, can fill SOC2/HIPAA/EU-AI-Act attestations and GET the
  OSCAL JSON. Downgraded: what's exposed is the buyer's own typed notes (tenant-isolated), not the sold
  validate-conformant signed evidence-pack generator (that runs in the buyer's own infra); the same session-only
  pattern also affects `ai-keys` (BYOK) — a systemic "dashboard utilities are session-gated not entitlement-gated"
  pattern. ADR-0204 security-reviewed this exact page for owner-vs-seat authz but never the entitlement dimension.
- **[P2 · G26] No in-app invoice/order-history view** — no invoices/receipts route; `entitlement_grant` has no
  price/currency/order-id column, so there's no backing data even to build one. The buyer's only record is the
  (possibly undelivered, G23) email. Tempered by Paddle-MoR sending its own receipts. **Fork:** build in-app vs link
  Paddle's hosted portal.
- **[P2 · G27] Subscription cancel/refund fires zero buyer-facing notification** — the `subscription.canceled` and
  `refund.completed` branches revoke grants but return NO_EFFECT, and `app.ts`'s three notification blocks gate on
  `granted/renewed.length>0`, so no email/Discord/PostHog fires on a pure revoke. No revoke/refund template exists in
  the 10-template email package. The buyer finds entitlements silently gone on next dashboard load. The
  credit-expiry T-30d email proves the infra exists. Tempered by Paddle's generic payment-receipt email (not a
  Caisson which-entitlements-lost explanation).

### Stage 11 — Admin (operator) → **gaps** (core mutations solid)

**Implemented.** Next 16 control-plane gated by better-auth + GitHub-id allowlist (ADR-0283), per-route re-verification.
Five real, dual-logged (`admin_action_log` + WORM chain) mutations: grant/revoke entitlement, adjust credits, reissue
license, revoke-purchase (mandatory impact preview + type-to-confirm). Ops renders live Grafana Tempo traces;
`/healthz` fails closed on boot-migration failure (CAISSON-48, fixed). Edge deny-set live since 2026-07-05.

**Confirmed gaps.**

- **[P2 · G29] No account/customer lookup by email; no search/filter/pagination on any table** — `business-reads.ts:47`
  comment: "email enrichment is a DEPLOY follow-up" — never implemented; no email column in any row type; reads run
  unbounded `ORDER BY` with no LIMIT/WHERE; `business/page.tsx` has no search input. An operator resolving
  "user@x.com paid but has no access" cannot find the account id in-app and must go to Paddle or SQL. Grows worse with
  tenant count. Not tracked anywhere.
- **[P2 · G30] No WORM audit-chain integrity verification in the admin app** — `AuditChainStore.verify()` and the
  `ChainViewer` component both exist and are production-quality, but the only in-`apps/admin` usage is a design-catalog
  demo with hardcoded fake entries. `.append()` is wired (dual-log write) but `.verify()` is never called on real
  tenant data anywhere in `apps/admin`. The operator has no in-app way to confirm the audit chain — the product's core
  evidentiary primitive — hasn't been tampered with.
- **[P3 · G40] No in-app resend of a real transactional email to a customer** — the only admin email route sends a
  fixed sample template to an env-pinned operator address. `notifyPurchaseEmail` (which resolves the real buyer email)
  is wired only into the webhook path; no admin-triggered call site. Reissue re-serves the token as JSON for manual
  hand-off, never emails it. No "resend receipt/license" lever.
- **[P3 · G41] Overview home renders 4 shipped sections as unlinked "soon" cards** — `page.tsx` hardcodes
  `state:"soon"` (no href) for Ops, Business, Architecture, Decisions, all of which are fully built and linked from
  the top nav. Two later commits (incl. today's PR #153) touched the file without updating these flags. Cosmetic;
  the nav already works. One-line-per-row fix.
- **[P3 · G42] Grant-entitlement input is free-text with no catalog autocomplete** — a plain comma-separated text
  input; a typo surfaces only after submit via the server-side `assertGrantableEntitlementIds` rejection
  (non-destructive, but a wasted round trip with no in-UI valid-id hinting). Single-operator, GitHub-gated.

**Risk fold.** The GitHub-id allowlist is env-only (adding a second admin needs a redeploy). The `/architecture`
topology is baked at build time and can drift from the live fleet. WORM Object-Lock default is documented GOVERNANCE
while the runbook intended COMPLIANCE — an open posture question affecting how tamper-evident the trail actually is.

---

## 3. Ranked confirmed-gap table

Fix class: **CF** = code-fixable now · **OP** = operator-owed (env/config/manual act) · **FORK** = needs a decision
before build. Confidence on recommendations noted inline.

| id  | stage                        | sev | title                                                                                      | fix direction                                                                                                                                                                                   | class |
| --- | ---------------------------- | --- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| G1  | entitlements + post-purchase | P0  | Nothing automated calls `POST /issue` — first license never minted, renewals never re-mint | Call the issuer from the webhook grant/renewal path (or lazy-issue on dashboard read). **Fork (low-stakes):** webhook-push vs dashboard-pull trigger — recommend webhook-push, high confidence. | CF    |
| G2  | delivery-registry            | P0  | `create-caisson` argv rejects the advertised `bunx … my-app` positional                    | Accept a leading positional as `--name` in the argv loop                                                                                                                                        | CF    |
| G3  | delivery-registry            | P0  | `resolveIndexPath` resolves only inside the monorepo — real install ENOENTs                | Bundle `index.json` into the CLI package + fix `files`/relative depth (research fork P5-23 "bundle + refresh")                                                                                  | CF    |
| G4  | cart-checkout                | P1  | `/dashboard/plan` shows 5 archived edition rows as live Buy buttons                        | Filter `realEntries()` against a live-id allowlist (reuse `catalog.ts` `LIVE_PRICE_IDS`)                                                                                                        | CF    |
| G5  | discover-evaluate            | P1  | Dead module links from 3 persona pages incl. flagship Compliance                           | Gate the member `<Link>` on `module-pages.ts` existence (reuse `provenance` `MEMBER_DETAIL` pattern); add a CI walk                                                                             | CF    |
| G6  | cart-checkout                | P1  | Paddle.js init failure silently swallowed, poisons checkout for the session                | Add `.catch()` that resets `paddleInitPromise` + surfaces a user-facing error; add `isPaddleConfigured()` guard to the cart panel                                                               | CF    |
| G7  | payment-webhooks             | P1  | Notification resend (fresh event_id) double-fires buyer email + doubles PostHog revenue    | Fire side-effects only when the grant/credit write reported non-idempotent (wire the existing `withIdempotentSideEffect`)                                                                       | CF    |
| G8  | account-auth                 | P1  | Invited org seats can never reach their account (no switcher)                              | Build the ADR-0176-committed account switcher + pass `requestedAccountId`; **recommend an active-account cookie**, high confidence                                                              | CF    |
| G9  | post-purchase                | P1  | $49/5,000 credit top-up has no buyer-facing purchase entry                                 | Add a "Buy credits" CTA on `/dashboard/credits` wired to the existing price-id                                                                                                                  | CF    |
| G10 | refunds-revocation           | P1  | Credit clawback read-then-claw race drains an unrelated purchase's credits                 | Merge PR #164 (`outstandingClaw()` under advisory lock)                                                                                                                                         | CF    |
| G11 | refunds-revocation           | P1  | Coverage-mirror race lets a refunded buyer keep subscription access                        | Merge PR #164 (`coverageLockKey` + `grantOwnedCoverageMirrors`)                                                                                                                                 | CF    |
| G12 | support                      | P1  | No discoverable path to join the Discord server a purchase grants a role in                | Add a permanent invite to footer + purchase email + `/dashboard`; **OP step:** generate the invite                                                                                              | CF+OP |
| G13 | dashboard-buyer              | P1  | Plan page hardcodes `owned=false` — accidental double-subscribe                            | Compute `owned` from active subscription status. **Fork:** no subscription-status signal exists (Developer plan grants no entitlement rows) — needs a status source decided                     | FORK  |
| G14 | dashboard-buyer              | P1  | No subscription visibility or self-serve cancel/manage-billing                             | **Fork:** build self-serve vs link Paddle's hosted customer portal — **recommend link the portal**, high confidence (lazy + correct for MoR)                                                    | FORK  |
| G15 | dashboard-buyer              | P1  | No self-serve remove-member (org-controls offboarding never shipped)                       | Add `removeAccountMember` (schema already GRANTs DELETE) + a members-UI remove control                                                                                                          | CF    |
| G16 | cart-checkout                | P2  | Add-to-cart has zero ownership awareness — owner can re-buy                                | Cross-check `session.accountId` entitlements in add-to-cart / cart panel (reuse `dashboard/plan` `owned` logic)                                                                                 | CF    |
| G17 | discover-evaluate            | P2  | Marketplace JSON-LD advertises Offer URLs for 11 modules that 404                          | Filter `moduleItemList` input to `MODULE_PAGES` (mirror `sitemap.ts`)                                                                                                                           | CF    |
| G18 | payment-webhooks             | P2  | Coverage-mirror horizon has no per-invoice idempotency key — resend ratchets window        | Add `source_event_id` to the ON-CONFLICT key or guard on the credit-grant idempotent return                                                                                                     | CF    |
| G19 | account-auth                 | P2  | Sign-out never revokes the server session row                                              | Call `auth.api.signOut`/`deleteSession` in the sign-out route (or drop the shadow route so better-auth's own handler runs)                                                                      | CF    |
| G20 | refunds-revocation           | P2  | Chargebacks neither subscribed nor handled — zero automated detection                      | **Fork:** subscribe `adjustment.created`/chargeback + alert, vs accept Paddle-MoR + dashboard notice — **recommend a lightweight alert-only**, medium confidence                                | FORK  |
| G21 | support                      | P2  | Site Ask-AI escalation routes to procurement, files no ticket                              | Point the CTA at a real contact/Discord surface + file a ticket from the captured question (ADR-0236)                                                                                           | CF    |
| G22 | support                      | P2  | docs-service per-IP rate limit is one shared bucket for the whole Discord community        | Retry-once-with-backoff honoring Retry-After, or a bot-specific higher-budget lane                                                                                                              | CF    |
| G23 | dashboard-buyer              | P2  | Commerce emails silently no-op if `RESEND_API_KEY` unset on `caisson-license`              | Set + verify the var on the service (unconfirmed in docs)                                                                                                                                       | OP    |
| G24 | dashboard-buyer              | P2  | No proactive updates-window-expiring notice (only credits get one)                         | Extend the credit-expiry scheduler pattern to `updates_expires_at`                                                                                                                              | CF    |
| G25 | dashboard-buyer              | P2  | `/dashboard/compliance` + API ungated by entitlement — paid feature free                   | Add an entitlement gate mirroring `members-gate.ts`; **also covers `ai-keys` (same pattern)**                                                                                                   | CF    |
| G26 | dashboard-buyer              | P2  | No in-app invoice/order-history view                                                       | **Fork:** build in-app (needs a price/order-id column added) vs link Paddle portal — **recommend Paddle portal**, high confidence                                                               | FORK  |
| G27 | dashboard-buyer              | P2  | Subscription cancel/refund fires zero buyer-facing notification                            | Add a revoke/refund email template + fire it from the revoke branches                                                                                                                           | CF    |
| G28 | delivery-registry            | P2  | `create-caisson --help` names the wrong env var (`NODE_AUTH_TOKEN`)                        | One-line text fix in HELP + the `meter.ts:9` comment                                                                                                                                            | CF    |
| G29 | admin-operator               | P2  | Business admin: no email lookup, no search/filter/pagination                               | Join the better-auth user table for email + add a search box + LIMIT/paginate                                                                                                                   | CF    |
| G30 | admin-operator               | P2  | No WORM chain-integrity verification in the admin app                                      | Wire the existing `AuditChainStore.verify()` + `ChainViewer` to a per-tenant admin view                                                                                                         | CF    |
| G31 | discover-evaluate            | P3  | ai-production persona page under-lists membership (4 vs 6)                                 | Pin `bundle-pages.ts` members against `modulesByBundle()` (add the test other bundles have)                                                                                                     | CF    |
| G32 | cart-checkout                | P3  | Stale cart lines silently pruned on hydration, no notice                                   | Detect a diff on prune + show a one-line banner                                                                                                                                                 | CF    |
| G33 | payment-webhooks             | P3  | PostHog capture has no first-purchase-vs-renewal flag                                      | Thread the `subscriptionCycle` flag (already computed for email) into `PurchaseCapture`                                                                                                         | CF    |
| G34 | account-auth                 | P3  | apps/admin has no sign-out mechanism                                                       | Add a sign-out control calling the existing `adminAuthClient.signOut()`                                                                                                                         | CF    |
| G35 | account-auth                 | P3  | Cart cleared the instant the Paddle overlay opens, before payment                          | Clear on `checkout.completed` via `eventCallback` instead of on open                                                                                                                            | CF    |
| G36 | delivery-registry            | P3  | Doc fabricates a `caisson.lock` + `GenerateResult` type                                    | Fix `create-caisson.mdx` to the real output/return shape                                                                                                                                        | CF    |
| G37 | post-purchase                | P3  | Dashboard balance overstates spendable credits ~24h post-expiry                            | Sweep-before-read, or read the FIFO remaining-sum (as `admin-mutations.ts` already does)                                                                                                        | CF    |
| G38 | refunds-revocation           | P3  | Last-write-wins race in the edge deny-set publish                                          | Conditional/CAS write on the R2 PUT, or a periodic republish                                                                                                                                    | CF    |
| G39 | support                      | P3  | Admin `/grant-role` picker has no priority-support entry                                   | Add the key to `_EDITION_ROLE_ATTR`                                                                                                                                                             | CF    |
| G40 | admin-operator               | P3  | No in-app resend of a real transactional email to a customer                               | Add a "resend receipt/license" admin action calling `notifyPurchaseEmail`                                                                                                                       | CF    |
| G41 | admin-operator               | P3  | Overview home renders 4 shipped sections as unlinked "soon" cards                          | Flip `state` + add `href` per row                                                                                                                                                               | CF    |
| G42 | admin-operator               | P3  | Grant-entitlement input is free-text with no catalog autocomplete                          | Add a datalist from the registry index                                                                                                                                                          | CF    |

**Tally:** 3 P0 · 12 P1 · 15 P2 · 12 P3 = 42 gaps. 33 code-fixable now · 2 operator-owed (G12 has a small OP leg, G23 pure OP) · 5 need a fork decision (G13, G14, G20, G26 + G1's low-stakes trigger fork).

---

## 4. Admin dashboard improvement candidates

The operator asked for this list explicitly. It collects the admin-operator stage material plus the admin levers
that other stages' P0/P1 gaps depend on. Ranked by operator value.

1. **Admin intel findings page** (deferred, not a gap per appendix #16). The `services/intel` daemon is deployed,
   healthy, and actively writing findings to the admin Postgres `intel` schema — but no route/page reads it, so
   every finding is invisible without SQL. ADR-0286 explicitly sequenced the page after the OAuth + catalog merge
   queue drains; that queue has drained. Highest value, already-decided, just build it.
2. **Account/customer lookup by email + search/filter/pagination on business tables (G29).** The single biggest
   day-to-day support-ops friction: an operator cannot resolve "user@x.com" to an account id in-app. Join the
   better-auth user table for email enrichment (the "DEPLOY follow-up" comment that never shipped), add a search
   box, LIMIT the unbounded reads.
3. **First-mint / "Issue license" admin lever (ties to G1).** Until auto-issue on purchase ships, the operator's
   only first-mint path is a raw curl against `LICENSE_ISSUE_TOKEN`; admin reissue 404s on no-prior-grant. An
   admin action that calls `POST /issue` for an account with entitlements but no license_grant is the operational
   rescue for the P0 and a permanent support tool for edge cases.
4. **WORM chain-integrity verification view (G30).** `verify()` and `ChainViewer` both exist and are
   production-quality; only the wiring to real tenant data is missing. This is the one integrity-check path for the
   product's core evidentiary claim — cheap to surface, disproportionate trust value.
5. **`purchase_unrevoke` mutation + resend-transactional-email (G40).** ADR-0225 already queued `purchase_unrevoke`
   so reversing a mistaken edge deny isn't a raw-SQL-against-prod act; pair it with a "resend receipt/license"
   action so support can recover a buyer without hand-copying tokens out of band.

Further admin candidates (lower value, mostly one-liners): flip the stale Overview "soon" cards (G41);
grant-entitlement catalog autocomplete (G42); move the GitHub-id allowlist off env-only so adding an admin doesn't
need a redeploy; make the `/architecture` topology read live fleet state instead of build-time manifests; resolve
the WORM Object-Lock GOVERNANCE-vs-COMPLIANCE posture question.

---

## 5. Refuted claims (do not re-litigate)

1. **Marketplace media 20/28 placeholder** — accurate as of `a29fca09`, but the ADR-0290 fix is already built on
   `feature/marketplace-media-standard` / **open, mergeable PR #165** (28/28 static slides, video removed). A
   same-session in-flight fix, not an open backlog item.
2. **No purchase-completion confirmation UX** — Paddle.js shows its own success screen by default and emails a
   receipt; Caisson also fires a branded confirmation email server-side with a dashboard link. Real confirmation
   exists, just not custom-built. (The narrow cancel-loses-cart residual survives as G35.)
3. **No EULA/Terms link in the cart/checkout UI** — the `(marketing)` layout wraps `/cart` with `SiteFooter`, which
   links `/legal/eula` + `/legal/terms`. Only the final `/dashboard/cart` payment page lacks a proximate link (a
   narrow notice-proximity residual, not "nowhere").
4. **Asymmetric `PADDLE_ENV` default (client sandbox / server production)** — real in code but functionally inert
   (`config.env` is used only in the never-called `createCheckout`, not the webhook path), documented as a
   load-bearing runbook gotcha with explicit set-both commands, and slotted into the operator-owed pre-launch sweep.
5. **Adjustment item with an out-of-enum `type` dropped without onWarn** — deliberate + tested: Paddle's item
   `type` is a closed enum; tax/proration are expected skips (ADR-0218), with three tests pinning exactly this.
6. **`POST /issue` idempotent re-serve ignores tier/expiry drift** — accurate but unreachable: both live callers pass
   the stored values back (admin) or `expiry:null` (runbook curl); tier is a documented non-access-control label; the
   omission is self-documented as intentional.
7. **Eval-access issuance has no site proxy** — deliberately staged: ADR-0274/Track-E2, called out in `trial-path.tsx`'s
   own comment and the in-flight tracker; not a gap.
8. **Live registry ui-pro/analytics tarballs missing** — accurate but the whole R2 upload + first-publish sits behind
   the operator-owed `confirm=publish` gate, and `ci-publish-step.ts` already backfills missing sidecars on the flip
   (regression-tested). Operator-owed-by-design.
9. **Public npm publish hasn't fired** — a deliberately accepted operator bet (decisions-and-forks fifth sitting),
   tracked in outstanding-work §1, currently inert behind CF-Access; not an unaccounted gap.
10. **Grandfathering policy undecided for the six-bundle catalog** — locked and re-affirmed into the bundle era
    (ADR-0106/0129/0227, and ADR-0288 today invokes it for a bundle-era SKU); enforced by the append-only versioned
    pricebook. The stale "still open" line predates the tenth-sitting entry that drops it.
11. **No admin un-revoke path** — technically true but a documented, deliberately-accepted pre-launch gap with a named
    queued `purchase_unrevoke` mutation and the impact-preview/type-to-confirm mitigation (ADR-0225). Surfaced as an
    admin candidate above, not a gap.
12. **Discord role not auto-removed on refund/cancel** — an explicit locked non-goal (ADR-0203: "automate only if
    refund volume warrants"). Product/registry access itself revokes correctly.
13. **Priority-support SLA has no enforcement** — the deliverable was scoped (ADR-0278/0288) as a priority lane +
    stated commitment held by the single operator monitoring Linear Triage; automated compliance-tracking was never
    in scope. (One stale docstring in `escalation.py` is a comment nit, not a gap.)
14. **License reissue is re-serve-only (no key rotation)** — explicitly deferred v1 behavior (ADR-0220 AM-5,
    ADR-0225 R-4=C); a compromised token is killable today via `purchase_revoke` + the edge deny-set.
15. **Admin intel findings page never built** — deliberately sequenced-after-the-merge-queue (ADR-0286, decided the
    same day); on-plan, surfaced as admin candidate #1, not a gap.
