---
status: shipped (PR #304)
locked_by: ADR-0371
tags: [product]
date: 2026-07-20
---

# SPEC — Compliance drift monitor

**Goal.** `compliance-core` generates a deterministic evidence pack on demand — a point-in-time
snapshot. Every cross-validated competitor positions "continuous" as the actual buyer want. This
module adds a scheduled re-run of the existing collectors, a deterministic diff against the last
known-good snapshot, and an alert on regression. Composition, not invention: the collector
interface, the scheduling pattern, and the alert port all exist.

**SKU posture (ADR-0371):** extends `packages/compliance-core` in place — no new SKU; rides the
Compliance bundle and existing prices.

## Scope

1. `runComplianceSnapshot()` — a `TaskDefinition` (same shape as `defineRetentionTask` on the
   `JobQueue` port) re-running registered `EvidenceCollector`s on a schedule, persisting the
   result set. **Default schedule: daily** (buyer-configurable).
2. Deterministic diff: previous vs current snapshot, per-control status transition — a pure
   function, golden-testable.
3. Regression routing through the existing `AlertChannel` port — no new transport.
4. **Accepted-deviation state (typed, first-class):** a WORM-attested record
   (`controlId, reason, acceptor, expiresAt`) the diff engine honors — a known accepted gap does
   not re-alert until expiry or regression past the accepted baseline. Flag-never-guess applies:
   the deviation suppresses alerting, never flips a status to pass.
5. **Anchoring: EVERY snapshot** — each snapshot's digest goes through the existing anchoring
   seam (audit-worm chain + the external-anchor outbox), giving a provable continuous-posture
   timeline.

## Non-goals

- No new collector types. No infra/cloud scanning. No UI/dashboard in v1 — the diff + alert is
  the deliverable.

## Verification

- Golden test: snapshot → mutate one control's evidence → diff yields exactly one transition.
- Deviation test: accepted deviation suppresses the alert; expiry re-arms it; a regression past
  the accepted baseline alerts despite the deviation.
- Anchor test: every snapshot run appends exactly one anchor outbox row (deterministic digest).
