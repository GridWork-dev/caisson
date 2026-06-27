# ADR-0007 — Credit wallet + metering model

Status: proposed · 2026-06-27 (Phase 5 spec; pending Gate 4)

Credits are the universal meter (← gridwork's credit quad, rebuilt clean). A `credit_wallet`
holds an **integer** balance; every grant/debit is an **append-only `credit_event` ledger row**.
The discipline is **debit-before-spend**: classify the cost, debit atomically, then do the work;
an empty balance returns **402** and stops. Idempotency is **DB-anchored** (partial unique index

- 23505→idempotent mapping) so a retried webhook or double-click never double-grants/debits.

Credits are granted by: purchase, **subscription monthly allotment**, or top-up pack. Credits are
debited by: a **`create-stack` generation** (codegen-credits, ADR-0004) and **AI-feature usage**
(the metering a buyer's shipped app uses for its own customers — token-metered with PG atomics).
Proven units to debit (from the corpus): per-generation, per-evidence-pack, per-eval-run,
per-caption/GPU-minute, per-audit-scan.

Rejected: float balances (rounding/audit failure — ADR-0002). Spend-then-reconcile (lets runaway
agent loops overspend; the market's named gap is exactly missing circuit-breakers). Per-call
Stripe metering with no local wallet (latency + no hard cap).

Binding: no spend without a prior atomic debit; the ledger is append-only and is the billing
source of truth; a per-tenant USD circuit-breaker caps runaway spend (AI Production Kit, P3).
