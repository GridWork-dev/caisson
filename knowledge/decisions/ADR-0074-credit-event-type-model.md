# ADR-0074 — Credit event-type extension model: generic feature_debit/grant + tag

Status: accepted · 2026-06-27 (Wave-1 editions session, fork lock. Resolves how an edition meters a
new action without mutating the base `credit_event` type set under ADR-0007/0024.)

The `credit_event` ledger (ADR-0007) carries a typed `event_type` whose enumerated set
(`purchase|sub_allotment|topup|codegen_debit|ai_feature_debit|...`, ADR-0024) is owned by base
`credits`. Editions (Compliance P2 evidence, AI Production Kit P3 inference, codegen P5) each need to
meter new actions, but ADR-0003/0022 forbid a package depending "up" on an edition, and an
edition cannot extend a base-owned closed enum — the `...` is a collision: every new metered action
would otherwise force a base enum change + republish.

## Decision

Base `credits` ships a **generic `feature_debit` / `feature_grant` event type** carrying a
validated, editions-supplied **`feature` tag**. Any edition meters a new action through these two
types without touching a base enum and without depending "up".

- **Base owns the typed envelope; editions own the tag value.** The `event_type` set stays
  base-closed and small; `feature_debit`/`feature_grant` are the open extension points, and the
  `feature` string is the per-action discriminator (e.g. `evidence_pack`, `inference_call`,
  `codegen_run`).
- **The tag is validated against a registered set**, not free-form — an edition registers its
  feature tags (against the `tooling/`+`registry/` seam) and the base validates the supplied tag
  with Zod `.strict()` at the debit boundary. An unregistered tag fails closed; a typo cannot mint a
  silent new meter.
- **The existing specific types remain** (`codegen_debit`, `ai_feature_debit`, `sub_allotment`,
  `purchase`, `topup`) — no migration, no rename. New per-edition metering lands on
  `feature_debit`/`feature_grant`; the legacy specifics are not retrofitted.
- **Idempotency is unchanged** — `feature_debit`/`feature_grant` index on
  `(source_event_id, event_type)` / `(account_id, idempotency_key)` exactly as ADR-0024 specifies;
  the `feature` tag is a payload column, not part of the idempotency key.
- **Amends ADR-0007/0024**; these are append-only, so this amends-by-superseding the
  base-owns-every-event-type stance — it resolves the base-enum down-only collision while keeping
  the typed-event guarantee.

## Rejected

- **Base-owned closed enum that editions PR to extend** — couples release cadence to feature
  growth: every metered action becomes a base change + republish, and the base must merge edition
  concerns it has no business knowing. Violates the composition-not-fork ethos (ADR-0003).
- **Free-form string event types** — drops the typed-event guarantee entirely; a typo becomes a
  silent new event type that no consumer expects, corrupting ledger aggregation and reporting. The
  validated-tag-on-a-typed-envelope split keeps the guarantee while opening the extension point.

## Binding

The base `credit_event` type set is closed and base-owned; editions meter new actions ONLY through
`feature_debit`/`feature_grant` carrying a `feature` tag validated against a registered set (fail-
closed on an unknown tag) — no edition adds a base enum value, and no base code imports an edition.
The existing specific event types are immutable and not retrofitted. This holds across the
fully-commercial product (ADR-0023), including the now-commercial local-ai edition (ADR-0050).
Evidence: ADR-0007 (credit ledger + integer units), ADR-0024 (`(source_event_id, event_type)`
idempotency index), ADR-0003/0022 (composable packages, no depend-up + import-boundary lint gates),
the `tooling/`+`registry/` standards seam; rationale in `outputs/research/wave1-forks.md`.
