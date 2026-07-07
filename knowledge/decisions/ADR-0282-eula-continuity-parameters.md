# ADR-0282 — EULA continuity clause parameters: variant A, 12-month trigger

**Status:** accepted · 2026-07-07 (operator-locked, fifth sitting — the Track L fork).
Refines ADR-0276 with the clause's variant and knob values. Final wording approval stays
with the operator at the EULA release. Append-only; supersede with a later ADR, never edit.
**Tags:** `security`.

## Context

ADR-0276 locked a business-continuity clause in the EULA; the Track L draft
(`outputs/specs/research-response/eula-continuity-draft.md`) produced three variants and two
knobs and left the choice to the operator.

## Decision

- **Variant A — "confirmatory self-help".** The clause contractually CONFIRMS what already
  survives (the perpetual license, offline Ed25519 verification with no Caisson server, the
  owned entitlement, the right to operate/distribute the buyer's products) and ADDITIONALLY
  grants, on a Continuity Event: internal self-maintenance (fork/patch, including via
  contractors), an internal-org-only waiver of the no-redistribution term, and the right to
  self-host the registry artifacts already received. Exclusions: trademarks, future
  updates/patches/support, updates-window reinstatement, warranty revival, any source or
  access beyond what was delivered (no escrow duty). Variant C (escrow-backed) is the
  sanctioned later upgrade, revenue-permitting; variant B is rejected.
- **Trigger N = 12 months** of cessation of security patches to licensees GENERALLY (a
  buyer's own lapsed updates window is never a trigger), alongside the other Continuity
  Events: formal discontinuation/EOL, insolvency/bankruptcy, and acquisition where the
  successor does not assume the obligations within **90 days** (successor-binding provision).
- Both windows (12-month, 90-day) remain adjustable by the operator until the EULA release
  ships; after that, changes follow the EULA's own amendment terms.

## Consequences

- The clause text integrates at the draft's insertion point (after the Term-and-termination
  section, with the "Continuity Event" defined term added) and ships with/after the Track S
  pricing-terms rework (ADR-0272 §5), pending the operator's final wording approval.
- Consistent with ADR-0269 (perpetual owned entitlements) and the ADR-0260 updates-window
  model — the clause creates no new update obligations.
