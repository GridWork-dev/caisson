# ADR-0181 — OSCAL collector + framework scope + manual attestation

**Status:** accepted · 2026-07-01 (edition seam-completion, operator-locked) · relates **ADR-0058**
(evidence collectors), **ADR-0043** (field-crypto per-tenant), **ADR-0162** (BYOK), **ADR-0179** (version +
catalog binding), **ADR-0057** (control model / crosswalk floor). Append-only; supersede with a later ADR,
never edit. **Tags:** `compliance`, `ai`.

## Context

Three collectors are live (`substrate.chain-verify`, `substrate.worm-retention`, `substrate.rls-force`) and
are framework-agnostic. Three framework catalogs are built + crosswalked (SOC2 28+, HIPAA 30+, EU-AI-Act
25+), but the recon flagged gaps: no HIPAA-specific field-crypto evidence collector (PHI encryption is a
HIPAA Technical Safeguard — `@caisson/field-crypto` exists but no collector reads it), no EU-AI-Act
risk-register traversal collector, and `manualSlots[]` are schema-supported but unfillable (no UI/API/import
path). This ADR bounds T-OSCAL-5.

## Decision

The operator chose the broadest scope — **all three frameworks get a validate-conformant export now:**

- **Framework scope: all 3.** SOC2, HIPAA, and EU-AI-Act each get a schema-conformant, `oscal-cli
validate`-gated export this initiative (three golden fixtures, three validate targets), not SOC2-first.
- **HIPAA field-crypto collector: build it.** Add `substrate.field-crypto-policy` — reads tenant encryption
  scope from `@caisson/field-crypto`, fail-closed and tenant-scoped, mirroring the three existing
  framework-agnostic collectors. HIPAA PHI-encryption evidence becomes real, not asserted.
- **EU-AI-Act risk-register traversal: build it.** Add a collector traversing the `ai-config` risk store so
  the EU-AI-Act export carries real risk-register evidence.
- **Manual attestation: the full dashboard wizard.** Build the attestation wizard as dashboard UI in
  `apps/site` to fill `manualSlots[]` — not the thin write-only API. Reuses the buyer session + `withTenant`
  RLS context (same tree as the BYOK edge, ADR-0183).

## Consequences

- T-OSCAL-5 hardens all three export paths (SOC2/HIPAA/EU-AI-Act) to `validate`-conformant + UUID-disciplined,
  each validate-gated in CI.
- Two new collectors land: `substrate.field-crypto-policy` (HIPAA PHI) and the EU-AI-Act risk-register
  traversal — both fail-closed, tenant-scoped, golden-tested like the existing three.
- The attestation wizard is a `frontend`/`ui` surface in `apps/site` writing `manualSlots[]` inside
  `withTenant`; it re-enters the operator at SHIP via the `ui` tag. Design-track owns the form craft; the
  behavior floor (tenant-scoped, write-through to the slots) is the contract here.
- Broadest surface = most to get right at once; the three golden fixtures + validate targets are the
  regression floor.
