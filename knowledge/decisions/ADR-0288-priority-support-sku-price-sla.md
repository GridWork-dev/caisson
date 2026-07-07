# ADR-0288 — Priority-support SKU: price + SLA lock

**Status:** accepted · 2026-07-07 (operator-locked, ninth-sitting picker over the deferred-item
round of `outputs/research/admin-intel-catalog-roadmap-memo-2026-07-07.md`). Executes ADR-0278
(which created the priority-support SKU + fail-closed role→entitlement plumbing, PR #145).
Append-only; supersede with a later ADR, never edit. **Tags:** `billing`.

## Context

ADR-0278 shipped the priority-support subscription SKU with the entitlement plumbing built but
dark (fail-closed): the role→entitlement wire-up waits on exactly two operator values — a price
and an SLA. The roadmap memo ranked setting them top-3 leverage (two config values flip a live
revenue surface). No direct WTP data exists on support; grandfathering (ADR-0106/0129) already
covers early buyers if the price rises later, so setting it now is low-regret.

## Decision

- **Price: $999/yr.** Sits between the Developer plan ($499/yr) and Compliance-Updates
  ($1,499/yr) — the standard ~2× Developer-plan anchor for priority support.
- **SLA: next-business-day first response.** A commitment a single operator can hold without a
  follow-the-sun rotation; the enterprise 4-business-hour tier is deliberately NOT taken (a hard
  intraday SLA is a real solo-operator liability, revisit only for a named enterprise deal).
- **Grandfathering:** forward-only per ADR-0106 — early priority-support buyers hold their price.

## Consequences

- The `[Ops] Support-SKU role→entitlement wire-up` Linear issue is unblocked: wire the SKU to its
  entitlement, set the Paddle SANDBOX price to 99900 (integer cents, ADR-0007), and surface the
  SLA copy on the pricing/support surface. The Paddle production price is set with the rest of the
  catalog after the D2/D3 quant picker (the production-catalog-recreation act).
- MEDIUM confidence on the number (no support-specific WTP); the price is a first-mover anchor,
  not a validated point — the grandfather policy is what makes raising it later safe.
- Does not touch the still-open D2/D3 bundle price levels (held for the Cookiy quant close).
