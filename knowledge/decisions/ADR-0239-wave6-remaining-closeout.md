# ADR-0239 — Wave-6 remaining close-out: build the 9, close the ledger

**Status:** accepted · 2026-07-03 (deploy-closeout session, operator picker). **Amends ADR-0229
§disposition and ADR-0210 §4:** the wave-6 harvest bucket moves from "rest roadmap-only" to
**CLOSED** — the 9 remaining `build-next` rows build now as one spec/workflow/PR set (the same
shape as the ADR-0229 wave-6a subset), the 28 `build-on-trigger` rows stay parked by design on
their recorded per-row triggers, and the disposition ledger goes terminal. Append-only; supersede
with a later ADR, never edit. **Tags:** none (REVIEW-only; the built rows carry their own package
tests through the standards gate).

## Decision

1. **Build now (9 rows, one wave — "wave-6b"):** #1 tenancy-rls 404-not-403 existence-leak guard +
   FORCE-RLS introspection test · #2 pgbouncer empty-string-GUC guard verification · #18
   field-crypto versioned-KDF rotation-without-remigration idiom · #25 ai-evals
   backtest-via-live-code-path replay harness (explicit decision time, no `Date.now()`) · #27
   guardrails evidence-gated claim-ceiling primitive · #28 compliance regulatory-exemption →
   output-constraint worksheet type + exemplar · #38 ai-kit `structuredGenerate<T>()`
   structured-output-or-throw · #40 agent-kernel secret-redacting JSONL event logger (composes the
   kernel scrub primitives where they cover) · #46 kernel operator-allowlist gate — **check-first**:
   wave-6a's `verifyAllowlisted` may already satisfy it; a satisfied row records
   satisfied-by-existing instead of new code.
2. **The 28 `build-on-trigger` rows stay parked** — each keeps its recorded trigger in the
   disposition SPEC; electing one later needs no new ADR (the trigger firing IS the election),
   but building one without its trigger does.
3. **Ledger goes terminal:** the lift-sweep evidence report (previously sitting one directory
   ABOVE the repo root — a live evidence-drift risk flagged in the disposition SPEC Task 1) is
   folded into `outputs/research/caisson-lift-sweep-REPORT.md`, and the disposition SPEC is marked
   terminal. Wave-6 is no longer an open bucket on the opportunity backlog.

## Why

The operator elected close-out over indefinite parking: the 9 rows are XS–M, high/medium value,
with no competing live priority, and leaving the bucket half-built keeps a permanent "wave-6
remaining" line on every backlog snapshot. Building all 37 was rejected (the trigger rows'
per-row triggers are the design, not a deferral); building only the high-value 4 was rejected
(leaves the ledger open for 5 XS rows).

## Consequences

- The opportunity backlog's wave-6 rows collapse to one line (trigger rows parked, ledger closed).
- Any future harvest sweep starts a NEW ledger; this one is evidence, not a queue.
