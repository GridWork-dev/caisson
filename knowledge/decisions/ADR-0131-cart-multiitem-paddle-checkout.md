# ADR-0131 — On-site cart + single multi-item Paddle checkout

Status: accepted · 2026-06-30 (pricing + store-rework grill session, round 2 lock #5) · **EXTENDS
ADR-0116** (Paddle retained as the platform Merchant of Record) · composes ADR-0129 (the 12-module +
5-edition price catalog this cart sells) · composes ADR-0089/0098/0113 (the existing grant/clawback
webhook mechanics, unchanged by this lock) · carries one unresolved technical verification (§2).
Append-only; supersede with a later ADR, never edit.

## Context

ADR-0129 expands the storefront from 5 edition-level SKUs to a 17-SKU catalog (5 editions + 12
à la carte modules). A buyer composing a custom purchase — say, three à la carte Compliance modules
instead of the full edition — needs one checkout for multiple line items. No prior ADR covers a
cart; ADR-0017/0108/0116 cover the payment **provider** (Stripe → Paddle MoR), not the **purchase
flow** shape.

## Decision

1. **Custom site-side cart.** Cart state lives in the Next app (`apps/site`), holding a set of
   selected module/edition price ids. Each catalog item is a one-time, qty-1 line (no quantity
   stepper — a buyer either has a module in the cart or doesn't); "add/remove" is the only cart
   interaction.
2. **PRIMARY checkout path: one multi-item Paddle Checkout session** — every cart line item carried
   into a single Paddle transaction, one payment, one webhook. **This requires verification before
   building**: confirm Paddle's Checkout API actually supports multiple one-time-price line items in
   one session (not yet verified as of this ADR).
3. **FALLBACK (only if §2's verification fails):** sequential single-item Paddle Checkout overlays —
   one Paddle session per cart line, chained client-side behind a single "complete your purchase"
   flow so the buyer-facing experience still reads as one cart/one purchase, even though the
   underlying transactions and webhooks are N separate ones (not a regression in entitlement
   correctness — each line still grants independently and idempotently per ADR-0089/0113's existing
   per-event idempotency keys).
4. **Entitlement wiring (extends ADR-0071/0047, not a fork of it):** every module/edition price id
   gets its own `PURCHASE_BOOK` row mapping to `["@caisson/<slug>"]`; the registry index's
   per-package entitlement-expansion (the resolver behind ADR-0071) already expands a set of
   purchased ids, so a multi-line cart purchase is just a larger purchased-id set into the same
   resolver — no resolver change, only catalog-row growth. Round-trip test (price id ↔ entitlement
   set, both directions) for every new row.
5. **Grant mechanics unchanged.** Whichever checkout path is used, the existing webhook-bound grant
   flow (ADR-0089 `invoice.paid`/transaction-paid → credit + entitlement grant, idempotent on the
   provider event id, fail-closed; ADR-0113's revoke/clawback) is reused as-is — this ADR changes
   only the front-end cart/checkout shape and the catalog row count feeding it, not the grant or
   clawback semantics.

## Why

- **Stay on the one MoR.** ADR-0108/0116 already closed the "which payment provider" fork in favor
  of Paddle; introducing a second checkout surface (e.g. a custom multi-vendor cart) to dodge a
  multi-item-Checkout limitation would re-open that fork for no reason — the fallback (§3) solves
  the same problem without a second provider.
- **A real cart matches the "live self-serve store" posture** ADR-0082 §1 already committed to
  (reaffirmed by ADR-0130) — once the catalog has 12 standalone modules, forcing a buyer through N
  separate single-SKU checkouts for a 3-module à la carte purchase is a worse UX than the
  edition-only storefront it's replacing.
- **The fallback is specified now, not deferred,** so the build is never blocked on Paddle's API
  surface — whichever path ships, the buyer-facing "one cart" promise holds.

## Confidence + verification gate

**MEDIUM.** The multi-item-Paddle-Checkout assumption (§2) is **unverified** as of this ADR — it
must be confirmed against Paddle's current Checkout API/docs before the primary path is built.
Switching from primary (§2) to fallback (§3), or back, if Paddle's supported shape changes, does
**not** require a new ADR — only an implementation note in `docs/build-state.md` recording which
path shipped.

## Rejected

- **A separate cart/checkout-aggregation service** — rejected; the cart is pure client-side price-id
  state with no inventory, shipping, or tax logic of its own (Paddle owns tax as MoR per
  ADR-0017/0108) — a dedicated service is unwarranted infrastructure.
- **No cart — one SKU per checkout, status quo** — rejected; breaks the multi-module à la carte
  experience the moment ADR-0129's 12-module catalog goes live.
- **A second payment provider for multi-item carts only** — rejected; re-opens the closed
  payment-provider fork (ADR-0108/0116) and fragments the entitlement-grant webhook surface for no
  benefit over the §3 fallback.

## Downstream (code track wires; this ADR only locks the shape)

- `PURCHASE_BOOK` catalog rows for all 12 new modules (extends `services/license`'s existing
  edition-row set).
- The verification of §2 itself (a build-time spike against Paddle's Checkout API), recorded as a
  build-state note, not a new ADR.
- `apps/site` cart UI + checkout-trigger component (design/code track).

## Binding

The storefront sells through one cart, one checkout action, primarily as a single multi-item Paddle
Checkout session; if Paddle does not support that shape, sequential single-item Paddle overlays are
the sanctioned fallback with no ADR change required. Every catalog item from ADR-0129 gets its own
entitlement-mapped price row. Introducing a second payment provider, or a standalone cart service,
requires a superseding ADR.

Evidence: `pricing-and-store-rework-plan.md` lock #5 + "Store-rework build scope" §1-2;
`knowledge/decisions/ADR-0108`, `ADR-0116`, `ADR-0071`, `ADR-0047`, `ADR-0089`, `ADR-0113`.
