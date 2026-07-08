# ADR-0294 — Chargeback posture: subscribe + alert-only

**Status:** accepted · 2026-07-07 (operator-locked, eleventh-sitting picker over the
buyer-lifecycle audit `outputs/research/buyer-lifecycle-map-2026-07-07.md` gap G20).
Append-only; supersede with a later ADR, never edit. **Tags:** `billing`, `observability`.

## Context

Chargeback/dispute events are neither subscribed on the Paddle webhook nor handled in code —
zero automated detection. Paddle as merchant of record absorbs the dispute financially, but a
charged-back buyer silently keeps entitlements, credits, and license access.

## Decision

- **Subscribe the chargeback/dispute adjustment events and alert the operator** (Discord/admin
  surface). No automated revocation: the operator handles each case manually with the existing
  admin revoke action (which already claws credits and publishes the edge deny-set).
- Full automated chargeback revocation is deliberately NOT built pre-launch: disputes are
  sometimes reversed, and auto-punishing a legitimate buyer on a hostile-path event is a worse
  failure than a manual delay.

## Consequences

- The webhook's event parser gains chargeback event types that resolve to an ALERT effect, not
  a grant/revoke effect — the fail-closed `default: return null` posture for everything else is
  unchanged.
- Revisit toward automation only with real dispute volume; the alert gives the data.
