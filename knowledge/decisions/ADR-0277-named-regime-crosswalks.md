# ADR-0277 — Named-regime crosswalks: SOC 2, PCI-DSS, and GDPR exports in the compliance bundle

**Status:** accepted · 2026-07-07 (operator-locked, fourth picker round). Grounded in the
Cookiy deep analysis (cluster 4, 12/40: buyers want the control mapping tied to THEIR named
regime; FedRAMP was asked once and is deferred). Append-only; supersede with a later ADR,
never edit. **Tags:** `security`.

## Context

The compliance bundle ships OSCAL machinery and HIPAA/OSCAL mappings (Stream C, ADR-0160
lineage). Buyers evaluate against their own regime by name — SOC 2, PCI-DSS, GDPR — and a
generic OSCAL export forces them to build the crosswalk themselves, which reads as the exact
"generate your own mappings" liability the proof-artifact gate punishes.

## Decision

Extend the compliance bundle with **SOC 2, PCI-DSS, and GDPR crosswalk exports**: mapping
data + export routes over the existing OSCAL machinery, produced through the same export
pipeline as the HIPAA mapping. **FedRAMP is explicitly deferred** (single mention in the
corpus; heavyweight regime) — demand-driven later ADR.

## Consequences

- The crosswalks land inside the ADR-0275 evidence pack when both ship.
- Mapping data is versioned, golden-file-tested like existing compliance logic (ADR-0013),
  and regime claims on the site stay limited to what the exports actually cover (copy laws).
- No new module or SKU: this deepens the compliance bundle's existing surface.
