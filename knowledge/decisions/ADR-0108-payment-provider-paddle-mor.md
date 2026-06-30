# ADR-0108 — Payment provider: Paddle (Merchant of Record) supersedes Stripe-as-MoR

Status: accepted · 2026-06-30 (P6 operator-gates session, operator directive) · **supersedes the
Stripe-as-Merchant-of-Record assumption** baked into ADR-0012 (commerce model) and the B1 runbook ·
**amends ADR-0089** (X-2 cycle→grant — the event source changes from Stripe `invoice.paid` to Paddle
`transaction.completed`). Append-only; supersede with a later ADR, never edit.

> **ADR numbering (reconciled at integration merge):** the go-live operator track owns **0106–0109**
> (pricing · CF-Access · this Paddle ADR · support-bot member-management); the code track owns
> **0110–0113** (issuer · publish-readiness · MCP rate-limit · entitlement-revoke). The code-track
> issuer ADR was renumbered 0108→0110 and entitlement 0109→0113 to clear the collision at merge.

## Context

ADR-0012 specified self-serve checkout "via Merchant-of-Record," and the P6 build + the B1 runbook
assumed **Stripe + Stripe Tax** as that MoR. Stripe Tax _computes_ tax but Stripe is **not** the
merchant of record — the operator (GridWork Digital LLC) would still be the seller of record, carrying
global VAT/sales-tax **registration + remittance** + nexus tracking + chargeback liability. For a solo
founder selling a **globally-purchased** dev kit, that compliance burden is the dominant cost. The
operator chose to switch to **Paddle**, which is a true MoR.

## Decision

**Paddle Billing is the payment provider and Merchant of Record.** Paddle is the reseller/seller of
record: it collects + remits global sales tax/VAT, owns the buyer invoice, and absorbs chargeback +
fraud handling. The operator receives payouts net of Paddle's fee — no tax registration, no remittance.

### Mechanics (Paddle Billing — the current product, NOT legacy Paddle Classic)

- **Catalog:** Products + Prices created in Paddle (one-time + recurring **annual**) matching the
  ADR-0106 numbers. Each Paddle Price `id` maps to an edition/bundle/subscription SKU.
- **Checkout:** Paddle.js overlay/inline checkout on `apps/site` using a **client-side token** +
  the Price `id`s. No card data touches Caisson infra.
- **Server SDK:** `@paddle/paddle-node-sdk` (official, Apache-2.0), authenticated with a server
  **API key** (`pdl_live_*` / `pdl_sdbx_*`).
- **Webhooks:** signed with the `Paddle-Signature` header; verify with
  `paddle.webhooks.unmarshal(rawBody, webhookSecret, signature)` (replaces the Stripe HMAC raw-body
  verify). The endpoint needs the **raw** request body.
- **Grant trigger:** **`transaction.completed`** — fires on the initial purchase **and on every
  renewal payment**, carrying `items[].price.id`, the `subscription_id` (for recurring), and
  `custom_data`. This single event drives both the one-time edition/bundle grant and the X-2 **annual**
  cycle→grant (ADR-0089). Subscription lifecycle (`subscription.created` / `.activated` / `.canceled`)
  is observed for entitlement revoke-on-cancel (a deferred follow-on, B2-class).
- **Account binding via `custom_data`:** the Caisson account/tenant id is set as `custom_data` at
  checkout and **propagates** onto the transaction + subscription. This **removes the Stripe gotcha**
  (Stripe does not propagate Checkout-Session metadata onto subscription invoices, requiring a
  `subscription_data[metadata]` stamping hack — ADR-0089 / the B1 memory) — Paddle's `custom_data`
  flows through natively.

### Code-track impact (ADR-0089 rework — NOT this operator session)

- Replace `parseStripeEvent` with a Paddle event parser over `transaction.completed`; map
  `items[].price.id` → entitlements/credits via `@caisson/pricebook` (now keyed on **Paddle Price ids**,
  not Stripe price ids); read the account from `custom_data` (drop the metadata-stamping workaround).
- Swap webhook verification to `@paddle/paddle-node-sdk` `unmarshal` (raw body + `Paddle-Signature`).
- The **license issuer + verify (B4)**, the **entitlement store/resolver (ADR-0071)**, and the
  registry-Worker filter (ADR-0047) are **provider-agnostic** — unchanged by this switch.
- `@caisson/pricebook`'s `stripePriceId` field is renamed/abstracted to `providerPriceId` (or
  `paddlePriceId`); the X-2 mapper's annual-cycle logic is retained, only its event source changes.

### Env (provider creds → `~/.gridwork/env`, Railway secret store at deploy)

- `PADDLE_API_KEY` (server), `PADDLE_WEBHOOK_SECRET` (per-endpoint), `PADDLE_CLIENT_TOKEN`
  (Paddle.js, public-ish), `PADDLE_ENV` (`sandbox` | `production`). Replaces `STRIPE_SECRET_KEY` +
  `STRIPE_WEBHOOK_SECRET`.

## Rejected

- **Stripe + Stripe Tax (the prior assumption)** — operator stays seller of record: global VAT/sales-tax
  registration + remittance + nexus tracking + chargeback liability. Stripe Tax computes but does not
  remit as MoR. The dominant solo-founder cost; the reason for the switch.
- **Lemon Squeezy / other MoRs** — also MoRs, but Paddle has the more mature subscription API + the
  `custom_data` propagation that cleanly fits the entitlement-grant seam. (Operator pick: Paddle.)

## Binding

Caisson sells via Paddle Billing as Merchant of Record. Checkout = Paddle.js; grants key off
`transaction.completed` + `custom_data`; webhooks verified with the Paddle Node SDK. The license,
entitlement, and registry surfaces are unchanged. The ADR-0089 cycle→grant mapper is reworked from
Stripe events to Paddle `transaction.completed` (code track, ADR-0110+).

Evidence: developer.paddle.com (Billing — Node SDK quickstart, `transaction.completed` webhook,
`custom_data`); `@paddle/paddle-node-sdk` (PaddleHQ, Apache-2.0); ADR-0012, ADR-0089, ADR-0106; the
2026-06-30 operator directive.
