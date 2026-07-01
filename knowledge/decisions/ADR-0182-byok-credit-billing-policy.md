# ADR-0182 — BYOK credit-vs-BYOK billing policy

**Status:** accepted · 2026-07-01 (edition seam-completion, operator-locked) · resolves the question
**ADR-0162** §Decisions point 6 explicitly punted ("whether a BYOK lane should debit credits at all… is a
pricebook/policy decision, out of scope here"). Relates **ADR-0162** (BYOK mechanism), **ADR-0007** (integer
credits), **ADR-0137**/**ADR-0106** (pricing), **ADR-0183** (BYOK edge). Append-only; supersede with a later
ADR, never edit. **Tags:** `billing`, `pricebook`.

## Context

Server-side BYOK is built: both the env-pointer and per-tenant lanes run through the identical
`reserve()`→`reconcile()`→cap flow, debiting internal `ai-meter` pricebook credits. ADR-0162 held metering
orthogonal to key source and deferred the pricing question. This is the gate-holding fork — the buyer UI and
the pricebook `keySource` discriminator can't be built until it's locked. The BYOK research brief finds clear
industry consensus: BYOK separates _token billing_ (the provider bills the tenant directly) from _platform
billing_ (flat subscription / seat fee for routing, observability, governance); none of Portkey / Helicone /
LiteLLM meter-and-charge token usage when the tenant's own key is in play, but **all still meter internally**
for rate-limiting, abuse detection, and dashboards.

## Decision

**Free.** When a tenant supplies their own provider key, a metered AI action debits **$0 credits**. Internal
metering (`reserve`/`reconcile`/cap) still runs — it is the spend-cap / abuse mechanism — but it is **not**
the billing signal. Platform value is billed as the edition / subscription fee, which the ADR-0137/0106
anchors already cover.

This matches every gateway example in the research (Portkey/Helicone/LiteLLM = 0% token markup under BYOK).
The integer-credit invariant (ADR-0007) is preserved — 0 is an integer.

## Consequences

- The pricebook gains a `keySource: "env" | "tenant"` discriminator; `computeCost()` returns a 0 debit for
  the tenant lane. Metering (`reserve`/`reconcile`/cap) is untouched.
- The BYOK key form (ADR-0183) shows "$0 credits — you pay {provider} directly"; no cost preview for the
  tenant lane.
- The platform must stand on its subscription/edition price, not per-action credits under BYOK — confirmed
  covered by the ADR-0137/0106 pricing.
