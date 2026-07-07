# ADR-0276 — EULA continuity clause: codified self-maintenance rights if patches stop

**Status:** accepted · 2026-07-07 (operator-locked, fourth picker round — the clause, NOT the
auto-open-source dead-man). Grounded in the Cookiy deep analysis (continuity/abandonware is
the largest objection cluster, 25/40; the sharpest data point is a buyer who walked from a
vendor that "couldn't guarantee security patch delivery after the first year"). Append-only;
supersede with a later ADR, never edit. **Tags:** `secrets`.

## Context

The abandonware fear is mostly answered by what is already architecturally true — offline
perpetual license verification (tokens verify with no server, forever) and source the buyer
keeps. But those guarantees live in prose, not terms. Procurement/legal gates want the
commitment in writing. The bolder auto-open-source dead-man clause was considered and
declined: an irreversible commercial commitment whose risk is unpriced pre-launch.

## Decision

Add a **vendor-continuity clause** to the EULA codifying:

1. **Perpetual offline verification** — license tokens verify offline forever; no server
   dependency for continued use of a purchased version.
2. **Source retention** — the buyer keeps the delivered source under the license, regardless
   of the vendor's status.
3. **Self-maintenance conversion** — if security-patch delivery ceases for **N consecutive
   months** (N set in the EULA text, operator-owned), the buyer's commercial license terms
   convert to a perpetual **internal-use** license with self-maintenance rights explicitly
   blessed: fork-and-patch internally, including engaging third-party contractors, with the
   existing **no-redistribution** boundary unchanged.

Legal-text work plus one EULA release; no code changes. The pricing-surface terms rework
(ADR-0272 §5) references the clause once it ships.

## Consequences

- The EULA change is a legal document release: operator reviews and approves the final text
  before it goes live (the `secrets`/legal tag gates SHIP).
- The clause strengthens the ADR-0272 "source you keep forever" copy from claim to term.
- The auto-open-source escrow remains open as a possible later ADR if procurement pressure
  demands it post-launch; nothing here forecloses it.
