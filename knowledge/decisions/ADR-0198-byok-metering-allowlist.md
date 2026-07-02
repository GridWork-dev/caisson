# ADR-0198 — BYOK zero-cost metering is per-action allowlisted (default metered)

**Status:** accepted · 2026-07-01 (whole-repo audit remediation — operator lock, picker round 2026-07-01).
**Relates:** ADR-0182 (BYOK free + `apps/site` edge), ADR-0089 (subscription→credit-grant), ADR-0007
(integer credit units), ADR-0134/0188 (audit harness).

## Context

ADR-0182 locked BYOK as free: a metered AI action under a tenant's own key debits 0 credits. Audit
round 2 (finding `3991eccd659c6dc4`) flagged that `resolveActionCost`
(`packages/pricebook/src/actions.ts`) implemented this as a **uniform** zero for
`keySource === "tenant"` across every action — a latent metering bypass: once non-inference actions
exist (evidence packs, compliance exports, registry ops), a tenant key would zero those too, though
the tenant's key pays for none of their cost.

## Decision

BYOK zero-cost applies **only** to actions whose cost is the model inference the tenant's key now
pays for. The action table carries an explicit per-action byok-covered marker; `resolveActionCost`
zeroes cost only when `keySource === "tenant"` **and** the action is marked covered. Any new or
unclassified action defaults to **metered** (fail-metered). Platform actions stay metered regardless
of key source. This refines ADR-0182 — it does not reverse it: inference-class actions under BYOK
remain $0.

## Rejected

- **Keep uniform zero** — silently exempts future platform actions from metering; revenue leak that
  compounds as the action table grows.
- **Runtime heuristic (infer "AI-ness" from action name/category)** — policy must be explicit
  per-action data, reviewable in a diff, not a classifier that fails open.
