# ADR-0063 — AI-Kit guardrails: moderation, PII redaction, enforcement points

Status: accepted · 2026-06-27 (Wave-1 editions session, fork lock. Resolves the AI-Kit guardrail
forks P3-20/21/22 layered on the metered-inference gateway.)

The AI Production Kit must moderate content and strip PII without hardwiring one vendor, leaking
content on a moderator outage, or re-inventing the per-tenant crypto the substrate already ships.
This ADR locks where guardrails run, how the backend swaps, how PII is handled, and the failure
policy.

## Decision

Guardrails are layers on the single metered-inference gateway (ADR-0059), enforced at its **input
and output points** — input-moderate + PII-redact before egress to the provider, output-moderate
before the response returns.

- **Moderation backend is a pluggable `Moderator` port** — a provider moderation API, a local/
  embedded model, OR a custom buyer policy, selected in `forge.config`. Same port-swap ethos as the
  `BillingProvider` (ADR-0017) and provider-agnostic ai-config (ADR-0011): no vendor type leaks past
  the port; a new backend is a new driver, not a fork.
- **PII detection/redaction is an engine with a redaction action** (mask / hash / reversible
  tokenize). Where a PII value must be **retained encrypted** — reversible tokenize-and-restore,
  swap a placeholder to the provider, decrypt on return — it **reuses field-crypto (ADR-0055)**
  `sealField`/`openField`, never a bespoke crypto path.
- **Enforcement is FAIL-CLOSED by default for hard policies** — a guardrail error or moderator
  timeout **blocks the call**, with a **documented per-policy `failOpen` opt-in** for soft policies
  that prefer availability. Order cheap regex/structured checks before model-based checks to bound
  the latency stack.
- **New kernel error `GuardrailError` (HTTP 422)** is added for guardrail blocks (amends the
  ADR-0019 hierarchy) so a block propagates with a stable `code` and a redaction-safe envelope like
  every other `CaissonError`.
- **Guardrail blocks emit to the audit/observability surface (ADR-0075)** on a typed event bus —
  the Compliance edition subscribes; the base guardrail package never imports an edition (ADR-0003).

Composes with the ADR-0059 gateway (the one enforcement chokepoint) and field-crypto (ADR-0055, the
sole PII-encryption path) — neither is duplicated here.

## Rejected

- **A single hardwired moderation vendor** — fast to ship, but no provider-agnosticism; egresses
  user content to one third party (an EU / air-gap / regulated non-starter) and contradicts the
  provider-agnostic doctrine (ADR-0011). Rejected for the `Moderator` port.
- **Fail-open by default** — better UX/availability, but a moderator outage then passes unmoderated
  traffic straight through — wrong for the compliance _hero_ brand. Fail-open survives only as an
  explicit, documented per-policy opt-in.
- **A bespoke PII-encryption path** — duplicates the per-tenant AEAD field-crypto already shipped
  (ADR-0055); two crypto paths is two attack surfaces and a second thing to audit. Reuse, not
  rebuild.

## Binding

Guardrails run only at the ADR-0059 gateway input/output points; the moderation backend is a
`Moderator` port (provider | local | custom) with no vendor type past the seam; PII that must be
retained encrypted goes through field-crypto (ADR-0055) `sealField`/`openField` and nowhere else;
hard policies fail closed and any fail-open is a documented per-policy opt-in; a guardrail block
throws `GuardrailError` (422, in the ADR-0019 hierarchy) and emits to the ADR-0075
audit/observability surface via a typed bus, never an up-import of an edition (ADR-0003). Backend
and PII-engine dependencies stay inside the fully-commercial SPDX allowlist (ADR-0023, with the
local-ai edition now commercial under ADR-0050) — no AGPL/GPL moderation or NER lib contaminates a
shipped module. Evidence: `outputs/research/wave1-forks.md` P3-20/P3-21/P3-22 (pluggable port,
field-crypto reuse, fail-closed + `GuardrailError`); ADR-0019 typed error hierarchy; ADR-0011
provider-agnostic ai-config; ADR-0017 `BillingProvider` port precedent; field-crypto `column.ts`
`sealField`/`openField`.
