# ADR-0211 — ai-meter: pre-call MinHash/LSH dedup-before-meter gate

**Status:** accepted · 2026-07-02 (harvest slice-2 wave, ADR-0204 scope lock).
**Relates:** ADR-0060 (ai-meter reserve/reconcile), ADR-0133 (ai-meter clean-lift), lift-sweep #12
(throughframe pattern, rebuild-clean), ADR-0007 (integer money — untouched).

## Context

ai-meter's circuit-breaker/reserve-reconcile core is confirmed strictly ahead of every surveyed
alternative. The one missing surveyed capability: detecting that a new prompt is _near-identical_ to a
recently metered one and short-circuiting before the provider call and meter reservation happen. The
existing exact-`callId` idempotency only dedupes literal retries of the same call; provider-side
`cached_input_tokens` is a billing-rate field — neither addresses two different-but-near-identical prompts.

## Decision

A MinHash-signature + LSH-bucket gate wired into the metering path _before_ the price-book
estimate/debit: signature over the normalized prompt, LSH bucket lookup against a bounded recent-window
store (injected port, in-memory default — no new hard Postgres dependency), similarity threshold policy
(caller-configurable, default conservative), and a typed gate result (`proceed` | `duplicate-of` with the
prior call reference) so callers choose to skip, reuse, or force. ai-meter stays a base primitive — no
edition coupling.

## Rejected

- **sqlite-vec/ANN-backed store as the default** — heavier than the need; the port admits one later
  without deciding it now.
- **Silent auto-skip on similarity hit** — a metering gate must never silently answer with a stale result;
  the caller owns that policy, the gate only detects.
