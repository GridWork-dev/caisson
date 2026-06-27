# ADR-0020 — Credit idempotency index (amends ADR-0007)

Status: proposed · 2026-06-27 (foundations track; closes the implementation-blocking gap the
docs-review flagged on ADR-0007 — ADRs are append-only, so this amends-by-superseding the
idempotency detail of ADR-0007)

ADR-0007 fixed "DB-anchored idempotency (partial unique index + 23505→idempotent mapping)" but
did not name the columns. This ADR specifies them, so the `credit_event` ledger is implementable
without a second decision.

**Two idempotency sources, two partial-unique indexes** on `credit_event`:

1. **External-event-driven** grants/debits (a Stripe webhook, a subscription allotment) carry a
   `source_event_id` (the provider event id) + an `event_type`
   (`purchase|sub_allotment|topup|codegen_debit|ai_feature_debit|...`):

   ```sql
   CREATE UNIQUE INDEX credit_event_source_uniq
     ON credit_event (source_event_id, event_type)
     WHERE source_event_id IS NOT NULL;
   ```

   Keyed on **`(source_event_id, event_type)`** — not `source_event_id` alone — because one
   provider event may legitimately produce two distinct ledger effects (e.g. a purchase that both
   grants credits _and_ records an allotment), each idempotent on its own type. A retried webhook
   re-inserting the same `(source_event_id, event_type)` raises **23505**, caught and mapped to an
   idempotent success returning the existing row.

2. **Internal/client-driven** debits with no external event (an in-app `create-stack` generation,
   an AI-feature spend) carry a caller-supplied `idempotency_key` (UUID), scoped per account:
   ```sql
   CREATE UNIQUE INDEX credit_event_idem_uniq
     ON credit_event (account_id, idempotency_key)
     WHERE idempotency_key IS NOT NULL;
   ```
   `account_id`-scoped so two tenants' keys never collide; a double-click / retried generation with
   the same key is absorbed (23505 → idempotent success).

Every `credit_event` row carries **exactly one** of `source_event_id` / `idempotency_key`
(enforced by a `CHECK (num_nonnulls(source_event_id, idempotency_key) = 1)`), so every write is
covered by exactly one of the two indexes — there is no un-idempotent insert path. The debit flow:
classify cost → `INSERT … credit_event` (debit, atomic balance check in the same txn) → on 23505
return the prior row, else proceed; empty/short balance → **402** (ADR-0019).

Rejected: idempotency on `source_event_id` alone (a multi-effect provider event could only record
one ledger row). A single global `idempotency_key` index without `account_id` (cross-tenant key
collision). App-layer dedupe without a DB constraint (races under concurrent retries — the unique
index is the only correct anchor).

Binding: `credit_event` ships both partial-unique indexes + the one-of-two `CHECK`; every grant/
debit is idempotent on `(source_event_id, event_type)` or `(account_id, idempotency_key)`; 23505
maps to idempotent success; this is asserted by an integration test (concurrent double-insert →
one row).
