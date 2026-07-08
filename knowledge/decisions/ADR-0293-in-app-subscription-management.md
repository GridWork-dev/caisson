# ADR-0293 — In-app subscription management: native status, cancel, and invoices

**Status:** accepted · 2026-07-07 (operator-locked, eleventh-sitting picker over the
buyer-lifecycle audit `outputs/research/buyer-lifecycle-map-2026-07-07.md` gaps G13/G14/G26).
Append-only; supersede with a later ADR, never edit. **Tags:** `billing`, `frontend`.

## Context

The buyer dashboard has no subscription visibility: `/dashboard/plan` hardcodes
`owned = false` (a subscribed buyer is offered a second subscribe), there is no self-serve
cancel or manage-billing surface, and no invoice/order history. The audit recommended linking
Paddle's hosted customer portal (high confidence, least work); the operator chose the in-app
build instead.

## Decision

- **Build native in-app subscription management** in the buyer dashboard:
  - **Status:** `/dashboard/plan` computes `owned` from real subscription state (the
    subscription-sourced entitlement grants plus, where a plan grants no rows — Developer —
    a subscription-status signal recorded at webhook time), ending the double-subscribe trap.
  - **Cancel / manage billing:** a self-serve cancel flow calling the Paddle API server-side;
    cancellation truth still arrives via the `subscription.canceled` webhook (the app never
    revokes locally on click).
  - **Invoices:** an in-app order/invoice history view fed from recorded transactions.
- Archived/legacy plan rows never render as live Buy buttons (`realEntries()` filtered against
  the live-price allowlist) — the G4 fix rides this same surface.

## Consequences

- A new money-adjacent surface (server-side Paddle API calls, transaction display) — fable
  audit lane at SHIP, Zod-strict at the app boundary, no client-side Paddle credentials.
- More work than the hosted-portal alternative, in exchange for a fully-owned UX; the portal
  option remains available as a fallback if the in-app cancel proves brittle against Paddle's
  API semantics.
- Invoice history may require persisting order rows the webhook already sees but does not
  store; any schema addition is append-only per ADR-0006.
