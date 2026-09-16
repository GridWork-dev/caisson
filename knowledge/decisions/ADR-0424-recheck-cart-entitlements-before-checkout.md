# ADR-0424 — Recheck cart entitlements before checkout

- Date: 2026-09-16
- Status: Accepted — operator R359 / EST-ASK-317
- Scope: site cart ownership and multi-item checkout
- Supersedes: ADR-0418 optional-hint absence short-circuit for cart ownership

## Context

CR-03 showed that a valid durable Better Auth session can outlive an independently
absent, evicted or expired hint cookie. Treating hint absence as signed-out hides active
ownership, and client-side Paddle line submission did not recheck those entitlements.

## Decision

The owned-items endpoint always resolves the real Better Auth session. Hint presence or
absence has no effect on ownership. Checkout moves to an authenticated, same-origin JSON
server endpoint. It derives account identity from that session, validates a bounded strict
list of catalog IDs, resolves current server catalog price IDs, deduplicates lines and reads
active entitlements in the same tenant scope before contacting Paddle. Already-owned exact
SKUs are removed; an all-owned cart returns 409 without creating a transaction. Failed reads
block checkout. Account IDs, prices and quantities are not accepted from the client.

The server creates an automatically collected Paddle transaction containing only retained
lines and the verified account's custom_data.account_id. Promo codes resolve to active,
checkout-enabled Paddle discounts; unknown/private codes fail without silently charging full
price. Paddle enforces expiry, applicability and redemption limits when applying the discount.
The browser opens only the returned transaction ID and tells the buyer when owned lines were
removed. It clears the cart only after checkout.completed.

## Consequences and boundaries

The site runtime requires PADDLE_API_KEY with transaction-write and discount-read permissions
for this cart path; configuration/permission errors fail closed. No credentials or deployment
are changed by this repair. PADDLE_ENV selects the same API environment as the existing cancel
path and must agree with NEXT_PUBLIC_PADDLE_ENV at deployment.

This closes the stale client ownership path for exact active SKU grants, preserving the
existing ownership semantics: implicit bundle coverage is not newly expanded. Entitlements
are checked at transaction creation, not atomically with later payment settlement. Previously
opened transactions and concurrent independent purchases remain outside this preflight's
guarantee. Subscription/single-item flows are unchanged; this lock covers the cart path in CR-03.
No live Paddle request is part of the verification; tests use real Better Auth in-memory sessions
and injected entitlement/provider seams, plus server/client binding contracts and mutations.

API references checked during implementation:

- https://developer.paddle.com/api-reference/transactions/create-transaction/
- https://developer.paddle.com/api-reference/discounts/list-discounts/
- https://developer.paddle.com/paddle-js/methods/paddle-checkout-open/
