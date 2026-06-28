# ADR-0060 — AI-Kit token metering, spend caps, and circuit breaker

Status: accepted · 2026-06-27 (Wave-1 editions session, fork lock. Meters the AI Production Kit's
buyer-app AI usage behind the ADR-0059 gateway, on the ADR-0007/0024 credit ledger.)

The AI Production Kit meters a buyer's shipped app's own AI spend, but token cost is only known
_after_ the provider responds — while ADR-0007's debit-before-spend forbids spending on an empty
wallet, and the market's named gap is exactly the missing circuit-breaker on runaway agent loops.
This resolves how to meter post-hoc provider cost without reopening that overspend gap. (Edition
code, so commercial: ADR-0023; ADR-0050 brought the local-ai edition under commercial too.)

## Decision

An **estimate → reserve → reconcile** flow against the append-only `credit_event` ledger
(ADR-0007/0024), behind the ADR-0059 gateway:

- **Pre-call reserve** — a token-estimator/tokenizer estimates input + max-output tokens and writes
  a **reservation debit** (a normal `credit_event`, atomic balance check in the same txn) _before_
  the provider call. This **preserves debit-before-spend**: an empty/short wallet returns **402**
  and the call never fires.
- **Post-call reconcile** — a second `credit_event` trues the reservation up to **actual** provider
  usage (refund the over-reserve or debit the shortfall). Both legs are idempotent on the ADR-0024
  `(account_id, idempotency_key)` index — a retried call settles once.
- **PG-atomic running-spend total under concurrency** — the per-tenant spend total mutates only via
  an atomic `UPDATE … RETURNING` (or a pg advisory lock), never read-modify-write, so concurrent
  calls on one tenant cannot race the cap check.
- **Multi-provider cost normalized** through the AI SDK's `usage` shape against a **price book**
  (per-provider, per-model) into **integer credit units — never floats** (ADR-0007/0002).
- **Spend caps** — per-tenant, configurable **unit · scope · window**; **soft** (warn) vs **hard**
  (block). A hard cap **trips a circuit breaker** whose state lives in the metering store; the
  breaker is checked _before_ every reserve, and an open breaker returns **402** and stops — closing
  the runaway-loop gap ADR-0007 named.
- **New metered actions use the generic `feature_debit` event type (ADR-0074)** — never a new base
  enum value.

## Rejected

- **Debit-after-spend** (pure spend-then-reconcile, no reservation) — reopens the runaway-loop gap:
  an unbounded agent loop overspends before the first reconcile ever lands. The pre-call reserve is
  what closes it; rejected.
- **Float credit math** for normalized cost — an ADR-0007/0002 violation (rounding + audit drift).
  Cost is rounded into integer credit units against the price book.
- **Per-edition spend-event enums** — a **down-only violation**: the base `credit_event` enum is
  closed, and editions reuse the generic `feature_debit` (ADR-0074) rather than extending it.

## Binding

Every metered AI call **reserves before** the provider call and **reconciles to actual after**; the
per-tenant running-spend total mutates only via an atomic `UPDATE … RETURNING` / advisory lock;
provider cost is normalized through the price book into **integer credit units**; a hard per-tenant
cap **trips a circuit breaker whose stored state is the gate checked before every reserve** (open →
402); and metered actions ride the generic `feature_debit` event type, never a new base enum. The
credit ledger stays the append-only billing source of truth. Evidence: ADR-0007 (debit-before-spend
ledger + the named circuit-breaker gap), ADR-0024 (the `credit_event` idempotency indexes), ADR-0059
(the AI gateway this meters), ADR-0074 (generic `feature_debit` event type), ADR-0050 (local-ai →
commercial); research artifact `outputs/research/wave1-forks.md`.
