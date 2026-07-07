# ADR-0278 — Priority-support SKU: paid support subscription with a response-time commitment

**Status:** accepted · 2026-07-07 (operator-locked, fourth picker round — frame locked; price
and SLA numbers stay operator-owned). Grounded in the Cookiy deep analysis (the accuracy
critic surfaced support responsiveness as a distinct axis, ~19–39/40, separate from the
patch-entitlement/abandonware frame). Append-only; supersede with a later ADR, never edit.
**Tags:** `billing`.

## Context

Buyers gate on "someone answers when it breaks" separately from "patches keep coming". The
Developer updates plan answers patch continuity (ADR-0272 §5, ADR-0276); nothing in the
catalog sells responsiveness. The support-bot + Linear Triage sink (ADR-0206 lineage) already
exist as the operational substrate.

## Decision

Add a **priority-support subscription SKU** to the catalog: Paddle subscription product +
entitlement + a priority lane through the existing support surfaces (support-bot priority
routing → Linear Triage escalation) with a stated response-time commitment.

- **Price and SLA numbers are operator-owned** and set at Paddle-catalog time, like every
  price (ADR-0012 lineage); this ADR locks the frame, not the numbers.
- The SLA commitment must be honest for a one-person operation: response-time (not
  resolution-time), business-days phrasing, and volume caps if needed — copy laws apply.

## Consequences

- New commercial surface: catalog row, pricebook entry, entitlement id, dashboard visibility,
  and lifecycle emails follow the existing subscription patterns (X-2/ADR-0116 lineage).
- The support-bot gains priority routing keyed on the entitlement — a bounded change on an
  existing seam.
- The pricing page's support-responsiveness line (ADR-0272 §5) gets a real SKU to point at
  once this ships; until then the line describes the included support tier only.
