# ADR-0179 — OSCAL version + catalog (import-ap) binding

**Status:** accepted · 2026-07-01 (edition seam-completion, operator-locked) · relates **ADR-0058**
(evidence-pack determinism / T15 OSCAL seam), **ADR-0057** (crosswalk licensing floor), **ADR-0181**
(collector + framework scope). Append-only; supersede with a later ADR, never edit. **Tags:** `compliance`.

## Context

The OSCAL export adapter (`packages/compliance/src/evidence/oscal-export.ts`) hardcoded `oscal-version`
= **v1.1.3** and defaulted `import-ap` to a local fragment `#caisson-assessment-plan` that resolves to
nothing real. NIST's current release is **v1.2.2** (2026-04-30; adds the Control Mapping model, SAR/POA&M
shapes otherwise stable since 1.1.x); the real-world FedRAMP target is pinned to NIST OSCAL **1.0.4** (GSA
`fedramp-automation`, RFC-0024 machine-readable OSCAL for SSP/CompDef/SAR from Sept 30 2026). Version choice
is the highest-value fork in this seam, and a GRC consumer expects `import-ap` to point at the Assessment
Plan that was executed.

## Decision

**(A) Emit `oscal-version` = v1.2.2 (latest stable).** The canonical internal model is the newest schema —
cleanest long-term, matches NIST tooling. A FedRAMP-package buyer down-converts (the 1.0.4-compat dual-target
mode is explicitly **not** built now; open a later ADR if a design-partner names a FedRAMP-package need).
`oscal-cli validate` runs the single 1.2.2 conformance target for T-OSCAL-1/3.

**(B) Ship a canonical per-framework Assessment-Plan (AP) fragment.** Caisson emits a resolvable `import-ap`
per SOC2 / HIPAA / EU-AI-Act, so the exported artifact is complete and importable without buyer wiring. We
author + maintain the three AP stubs. The overridable local fragment is dropped as the default.

The Caisson prop namespace `https://caisson.sh/ns/oscal` is registered explicitly on every non-core prop
(never omit `ns` — research pitfall #4).

## Consequences

- Locks the `oscal-version` literal (`1.2.2`) and the `import-ap` resolution path in the emitter; one
  `oscal-cli validate` target (1.2.2 schemas pulled from the NIST release assets).
- Adds three per-framework AP fixtures under the compliance evidence fixtures; each framework's export
  resolves its own `import-ap`.
- Downstream of this lock, ADR-0181 fixes which frameworks + collectors fill those exports.
